"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { RatesService, RatesData } from "@/services/rates"
import { AccountsService, UserAccount } from "@/services/accounts"
import { PaymentMethodsService, PaymentMethod } from "@/services/payment-methods"
import { TransactionsService } from "@/services/transactions"
import { calculateRate, formatRate, getRateDecimals } from "@/lib/rates-utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Landmark, Upload, Info, ArrowLeft, Check, ChevronRight } from "lucide-react"
import { CURRENCY_LABELS, SUPPORTED_REGIONS } from "@/lib/constants"

export default function NewTransactionPage() {
    const router = useRouter()
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)

    const [amountInput, setAmountInput] = useState("100")
    const [amountReceivedInput, setAmountReceivedInput] = useState("")
    const amountSent = parseFloat(amountInput) || 0
    const [sourceCurrency, setSourceCurrency] = useState("PERU")
    const [targetCurrency, setTargetCurrency] = useState("VES")
    const [rates, setRates] = useState<RatesData | null>(null)

    // Data from Step 2
    const [accounts, setAccounts] = useState<UserAccount[]>([])
    const [companyAccounts, setCompanyAccounts] = useState<PaymentMethod[]>([])
    const [selectedAccount, setSelectedAccount] = useState<UserAccount | null>(null)

    // Data from Step 3
    const [file, setFile] = useState<File | null>(null)
    const [createdTxId, setCreatedTxId] = useState<string | null>(null)

    useEffect(() => {
        const loadInitial = async () => {
            const [r, a, { data: { user } }] = await Promise.all([
                RatesService.getLatest(),
                AccountsService.getMyAccounts(),
                supabase.auth.getUser()
            ])

            if (r) setRates(r)
            if (a) setAccounts(a)

            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('phone')
                    .eq('id', user.id)
                    .single()

                if (profile?.phone) {
                    let defaultSource = 'PERU'
                    if (profile.phone.startsWith('+51')) defaultSource = 'PERU'
                    else if (profile.phone.startsWith('+56')) defaultSource = 'CHILE'
                    else if (profile.phone.startsWith('+57')) defaultSource = 'COLOMBIA'
                    else if (profile.phone.startsWith('+1')) defaultSource = 'USA'

                    setSourceCurrency(defaultSource)
                    const cAccounts = await PaymentMethodsService.getByCountry(defaultSource)
                    setCompanyAccounts(cAccounts)
                }
            }
        }
        loadInitial()
    }, [])

    useEffect(() => {
        const loadCountryAccounts = async () => {
            if (sourceCurrency) {
                const data = await PaymentMethodsService.getByCountry(sourceCurrency)
                setCompanyAccounts(data)
            }
        }
        loadCountryAccounts()
    }, [sourceCurrency])

    const updateCalculation = (value: string, direction: 'sent' | 'received') => {
        if (!rates) return

        const getPrice = (code: string) => {
            const key = code === 'VES' ? 'VENEZUELA' : code
            return rates.usdt_prices[key as keyof typeof rates.usdt_prices] || 0
        }

        const sourcePrice = getPrice(sourceCurrency)
        const targetPrice = getPrice(targetCurrency)

        const marginKey = `${sourceCurrency}_${targetCurrency}`
        const margin = rates.margins[marginKey] || rates.margins["GENERIC"] || 0
        const rawRate = calculateRate(targetCurrency, sourceCurrency, targetPrice, sourcePrice, margin)

        const decimals = getRateDecimals(targetCurrency, sourceCurrency)
        // IMPORTANT: Round rate to displayed precision for exact calculations (e.g., 100 × 149.65 = 14965)
        const rate = Number(rawRate.toFixed(decimals))

        if (direction === 'sent') {
            setAmountInput(value)
            const res = (parseFloat(value) || 0) * rate
            setAmountReceivedInput(formatRate(res, targetCurrency, sourceCurrency))
        } else {
            const cleanValue = value.replace(/[^0-9.,]/g, '').replace(',', '.')
            setAmountReceivedInput(value)
            const amountRec = parseFloat(cleanValue) || 0
            const res = rate > 0 ? amountRec / rate : 0
            setAmountInput(res.toFixed(2))
        }
    }

    // Effect to handle currency/rate changes (sync from 'sent' amount)
    useEffect(() => {
        if (rates) {
            const getPrice = (code: string) => {
                const key = code === 'VES' ? 'VENEZUELA' : code
                return rates.usdt_prices[key as keyof typeof rates.usdt_prices] || 0
            }
            const sp = getPrice(sourceCurrency)
            const tp = getPrice(targetCurrency)
            const mk = `${sourceCurrency}_${targetCurrency}`
            const m = rates.margins[mk] || rates.margins["GENERIC"] || 0
            const rr = calculateRate(targetCurrency, sourceCurrency, tp, sp, m)
            const dec = getRateDecimals(targetCurrency, sourceCurrency)
            // IMPORTANT: Round rate to displayed precision for exact calculations
            const r = Number(rr.toFixed(dec))

            const res = amountSent * r
            setAmountReceivedInput(formatRate(res, targetCurrency, sourceCurrency))
        }
    }, [sourceCurrency, targetCurrency, rates])

    // Re-calculating derived values for display
    const getSnapshot = () => {
        if (!rates) return { rate: 0, received: 0 }

        const getPrice = (code: string) => {
            const key = code === 'VES' ? 'VENEZUELA' : code
            return rates.usdt_prices[key as keyof typeof rates.usdt_prices] || 0
        }
        const sourcePrice = getPrice(sourceCurrency)
        const targetPrice = getPrice(targetCurrency)
        const marginKey = `${sourceCurrency}_${targetCurrency}`
        const margin = rates.margins[marginKey] || rates.margins["GENERIC"] || 0
        const rawRate = calculateRate(targetCurrency, sourceCurrency, targetPrice, sourcePrice, margin)
        const decimals = getRateDecimals(targetCurrency, sourceCurrency)
        // IMPORTANT: Round rate to displayed precision for exact calculations
        const rate = Number(rawRate.toFixed(decimals))
        return { rate, received: amountSent * rate }
    }

    const { rate, received } = getSnapshot()

    const handleCreateTransaction = async () => {
        if (!selectedAccount) return
        setLoading(true)
        try {
            const tx = await TransactionsService.create({
                amount_sent: amountSent,
                currency_sent: sourceCurrency,
                amount_received: received,
                currency_received: targetCurrency,
                exchange_rate: rate,
            })
            setCreatedTxId(tx.id!)
            setStep(3)
        } catch (error) {
            console.error(error)
            alert("Error al crear transacción")
        } finally {
            setLoading(false)
        }
    }

    const handleUpload = async () => {
        if (!file || !createdTxId) return
        setLoading(true)
        try {
            await TransactionsService.uploadProof(file, createdTxId)
            setStep(4)
        } catch (error) {
            console.error(error)
            alert("Error al subir comprobante. Nota: Asegúrate de que el bucket 'payments' exista en Supabase Storage y sea público.")
        } finally {
            setLoading(false)
        }
    }

    // Render Steps
    return (
        <div className="max-w-3xl mx-auto space-y-6 py-6">
            {/* Progress Header */}
            <div className="flex justify-between items-center px-4 max-w-md mx-auto">
                {[1, 2, 3, 4].map(s => (
                    <div key={s} className="flex items-center last:flex-1 last:justify-end">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                            {step > s ? <Check className="w-4 h-4" /> : s}
                        </div>
                        {s < 4 && <div className={`w-12 sm:w-20 h-1 mx-1 ${step > s ? 'bg-primary' : 'bg-muted'}`} />}
                    </div>
                ))}
            </div>

            {step === 1 && (
                <Card className="border-2">
                    <CardHeader>
                        <CardTitle>Paso 1: Cotización</CardTitle>
                        <CardDescription>¿Cuánto dinero deseas enviar?</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Envías</label>
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        value={amountInput}
                                        onChange={e => updateCalculation(e.target.value, 'sent')}
                                        onClick={(e) => (e.target as HTMLInputElement).select()}
                                    />
                                    <select value={sourceCurrency} onChange={e => setSourceCurrency(e.target.value)} className="h-10 border rounded-md px-2 bg-background text-sm">
                                        {SUPPORTED_REGIONS.filter(r => r !== 'VENEZUELA').map(region => (
                                            <option key={region} value={region}>
                                                {CURRENCY_LABELS[region]}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Reciben</label>
                                <div className="flex gap-2">
                                    <Input
                                        type="text"
                                        value={amountReceivedInput}
                                        onChange={e => updateCalculation(e.target.value, 'received')}
                                        onClick={(e) => (e.target as HTMLInputElement).select()}
                                        className="bg-background font-bold text-lg"
                                    />
                                    <select value={targetCurrency} onChange={e => setTargetCurrency(e.target.value)} className="h-10 border rounded-md px-2 bg-background text-sm">
                                        {SUPPORTED_REGIONS.map(region => (
                                            <option key={region} value={region === 'VENEZUELA' ? 'VES' : region}>
                                                {CURRENCY_LABELS[region]}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 flex justify-between items-center text-sm">
                            <span className="font-medium">Tasa de cambio:</span>
                            <span className="font-bold">
                                1 {sourceCurrency === 'VENEZUELA' ? 'VES' : (sourceCurrency === 'PERU' ? 'PEN' : (sourceCurrency === 'CHILE' ? 'CLP' : (sourceCurrency === 'COLOMBIA' ? 'COP' : 'USD')))} = {formatRate(rate, targetCurrency, sourceCurrency)} {targetCurrency === 'VENEZUELA' ? 'VES' : (targetCurrency === 'PERU' ? 'PEN' : (targetCurrency === 'CHILE' ? 'CLP' : (targetCurrency === 'COLOMBIA' ? 'COP' : 'USD')))}
                            </span>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full" onClick={() => setStep(2)}>Continuar <ChevronRight className="ml-2 w-4 h-4" /></Button>
                    </CardFooter>
                </Card>
            )}

            {step === 2 && (
                <Card className="border-2">
                    <CardHeader>
                        <div className="flex items-center gap-2 mb-2">
                            <Button variant="ghost" size="sm" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4" /></Button>
                            <CardTitle>Paso 2: Beneficiario</CardTitle>
                        </div>
                        <CardDescription>Selecciona a quién envías el dinero.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {accounts.length === 0 ? (
                            <div className="text-center py-6 border rounded-lg border-dashed">
                                <p className="text-muted-foreground mb-4">No tienes cuentas guardadas.</p>
                                <Button onClick={() => router.push('/dashboard/accounts')}>Agregar Cuenta</Button>
                            </div>
                        ) : (
                            <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2">
                                {accounts.map(acc => (
                                    <div
                                        key={acc.id}
                                        onClick={() => setSelectedAccount(acc)}
                                        className={`p-4 border rounded-lg cursor-pointer transition-all flex items-center gap-4 ${selectedAccount?.id === acc.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted bg-background font-medium'}`}
                                    >
                                        <div className="bg-primary/10 p-2 rounded-full text-primary">
                                            <Landmark className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-bold">{acc.alias}</div>
                                            <div className="text-xs text-muted-foreground">{acc.bank_name} - {acc.account_number}</div>
                                        </div>
                                        {selectedAccount?.id === acc.id && <Check className="text-primary w-5 h-5" />}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full" disabled={!selectedAccount || loading} onClick={handleCreateTransaction}>
                            {loading ? "Iniciando..." : "Confirmar y Continuar"} <ChevronRight className="ml-2 w-4 h-4" />
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {step === 3 && (
                <Card className="border-2">
                    <CardHeader>
                        <CardTitle>Paso 3: Instrucciones de Pago</CardTitle>
                        <CardDescription>Realiza la transferencia y sube el comprobante.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-4">
                            <h3 className="font-bold flex items-center gap-2 text-blue-800"><Info className="w-4 h-4" /> Datos para transferir</h3>
                            <div className="text-sm space-y-3 text-blue-900">
                                {companyAccounts.length > 0 ? (
                                    companyAccounts.map((acc, idx) => (
                                        <div key={acc.id} className="p-3 bg-white rounded-md border border-blue-100 shadow-sm relative overflow-hidden">
                                            <div className="absolute top-0 right-0 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary rounded-bl">
                                                Opción {idx + 1}
                                            </div>
                                            <p className="font-bold text-primary mb-1">{acc.bank_name}</p>
                                            <p><strong>Número:</strong> {acc.account_number}</p>
                                            <p><strong>Titular:</strong> {acc.holder_name}</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-3 bg-white rounded-md border border-blue-100 shadow-sm">
                                        <p className="font-bold text-primary mb-1">Instrucciones de Pago</p>
                                        <p>Por favor contacta al administrador vía WhatsApp para obtener los datos de transferencia para {CURRENCY_LABELS[sourceCurrency] || sourceCurrency}.</p>
                                    </div>
                                )}

                                <div className="mt-4 p-3 bg-primary text-white rounded-md font-bold text-center text-xl shadow-md">
                                    Total a pagar: {amountSent} {CURRENCY_LABELS[sourceCurrency] || sourceCurrency}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Sube tu comprobante (Foto/PDF)</label>
                            <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-3 hover:bg-muted/50 transition-colors">
                                <input
                                    type="file"
                                    id="proof"
                                    className="hidden"
                                    accept="image/*,.pdf"
                                    onChange={e => setFile(e.target.files?.[0] || null)}
                                />
                                <label htmlFor="proof" className="cursor-pointer block">
                                    <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
                                    <div className="text-sm mt-2 font-medium">{file ? file.name : "Haz clic para subir archivo"}</div>
                                    <p className="text-xs text-muted-foreground mt-1">Máximo 5MB</p>
                                </label>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full" size="lg" disabled={!file || loading} onClick={handleUpload}>
                            {loading ? "Subiendo..." : "Enviar Comprobante"}
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {step === 4 && (
                <Card className="text-center py-12 border-2 shadow-xl">
                    <CardContent className="space-y-4">
                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in duration-300">
                            <Check className="w-10 h-10" />
                        </div>
                        <CardTitle className="text-2xl">¡Operación Recibida!</CardTitle>
                        <CardDescription className="text-base max-w-sm mx-auto">
                            Tu transacción <strong>#{createdTxId?.split('-')[0]}</strong> está siendo verificada.
                            Te avisaremos en cuanto el dinero sea enviado.
                        </CardDescription>
                        <div className="pt-8">
                            <Button size="lg" onClick={() => router.push('/dashboard')}>Volver al Panel</Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
