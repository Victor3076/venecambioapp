"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { RatesService, RatesData } from "@/services/rates"
import { AccountsService, UserAccount } from "@/services/accounts"
import { PaymentMethodsService, PaymentMethod } from "@/services/payment-methods"
import { TransactionsService } from "@/services/transactions"
import { AdminSettingsService, AdminSettings } from "@/services/admin-settings"
import { calculateRate, formatRate, getRateDecimals } from "@/lib/rates-utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Landmark, Upload, Info, ArrowLeft, Check, ChevronRight, AlertCircle, Plus, Clock } from "lucide-react"
import { CURRENCY_LABELS, SUPPORTED_REGIONS, MINIMUM_AMOUNTS } from "@/lib/constants"
import { BeneficiaryForm, BeneficiaryData } from "@/components/BeneficiaryForm"

export default function NewTransactionPage() {
    const router = useRouter()
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)

    const [amountInput, setAmountInput] = useState("100")
    const [amountReceivedInput, setAmountReceivedInput] = useState("")
    const [amountBcvInput, setAmountBcvInput] = useState("")
    const amountSent = parseFloat(amountInput) || 0
    const [sourceCurrency, setSourceCurrency] = useState("PERU")
    const [targetCurrency, setTargetCurrency] = useState("VES")
    const [rates, setRates] = useState<RatesData | null>(null)
    const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null)

    const minAmount = MINIMUM_AMOUNTS[sourceCurrency] || 0
    const isBelowMin = amountSent < minAmount

    // Data from Step 1-2
    const [pendingTransfers, setPendingTransfers] = useState<{ account: UserAccount, amountSent: number, rate: number, amountReceived: number }[]>([])
    const [accounts, setAccounts] = useState<UserAccount[]>([])
    const [companyAccounts, setCompanyAccounts] = useState<PaymentMethod[]>([])
    const [selectedAccount, setSelectedAccount] = useState<UserAccount | null>(null)
    const [file, setFile] = useState<File | null>(null)
    const [createdTxId, setCreatedTxId] = useState<string | null>(null)
    const [createdTxIds, setCreatedTxIds] = useState<string[]>([])

    // State for New Account form
    const [isAddingAccount, setIsAddingAccount] = useState(false)
    const [newAccount, setNewAccount] = useState<BeneficiaryData>({
        alias: '',
        country: 'VENEZUELA',
        bank_name: '',
        account_number: '',
        details: {}
    })

    useEffect(() => {
        const loadInitial = async () => {
            const [r, a, { data: { user } }, settings] = await Promise.all([
                RatesService.getLatest(),
                AccountsService.getMyAccounts(),
                supabase.auth.getUser(),
                AdminSettingsService.getSettings()
            ])

            if (settings) setAdminSettings(settings)
            if (r) setRates(r)
            if (a) {
                setAccounts(a)
                if (a.length === 0) setIsAddingAccount(true)
            }

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

    const updateCalculation = (value: string, direction: 'sent' | 'received' | 'bcv') => {
        if (!rates) return

        const getPrice = (code: string) => {
            const key = code === 'VES' ? 'VENEZUELA' : code
            return rates.usdt_prices[key as keyof typeof rates.usdt_prices] || 0
        }

        const sourcePrice = getPrice(sourceCurrency)
        const targetPrice = getPrice(targetCurrency)
        const bcvRate = rates.usdt_prices.BCV || 1

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
            if (targetCurrency === 'VES') {
                setAmountBcvInput((res / bcvRate).toFixed(2))
            }
        } else if (direction === 'received') {
            const cleanValue = value.replace(/[^0-9.,]/g, '').replace(',', '.')
            setAmountReceivedInput(value)
            const amountRec = parseFloat(cleanValue) || 0
            const res = rate > 0 ? amountRec / rate : 0
            setAmountInput(res.toFixed(2))
            if (targetCurrency === 'VES') {
                setAmountBcvInput((amountRec / bcvRate).toFixed(2))
            }
        } else if (direction === 'bcv') {
            setAmountBcvInput(value)
            if (targetCurrency === 'VES') {
                const amountBcvVal = parseFloat(value) || 0
                const amountRec = amountBcvVal * bcvRate
                setAmountReceivedInput(formatRate(amountRec, targetCurrency, sourceCurrency))
                const resultSent = rate > 0 ? amountRec / rate : 0
                setAmountInput(resultSent.toFixed(2))
            }
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

            if (targetCurrency === 'VES') {
                const bcvRate = rates.usdt_prices.BCV || 1
                setAmountBcvInput((res / bcvRate).toFixed(2))
            }
        }
    }, [sourceCurrency, targetCurrency, rates])

    // Sync newAccount country when targetCurrency changes
    useEffect(() => {
        const country = targetCurrency === 'VES' ? 'VENEZUELA' : targetCurrency
        setNewAccount(prev => ({
            ...prev,
            country: country
        }))
    }, [targetCurrency])

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

    const handleConfirmTransfer = (accOverride?: UserAccount, shouldFinish?: boolean) => {
        const account = accOverride || selectedAccount
        if (!account || !rates) return

        const newTransfer = {
            account: account,
            amountSent,
            rate,
            amountReceived: received
        }

        const updatedTransfers = [...pendingTransfers, newTransfer]
        setPendingTransfers(updatedTransfers)

        if (shouldFinish) {
            handleCreateTransaction(updatedTransfers)
        } else {
            setSelectedAccount(null)
            setAmountInput("100")
            setStep(1)
        }
    }

    const handleSaveNewAccount = async (shouldFinish: boolean) => {
        if (!newAccount.alias || !newAccount.bank_name || !newAccount.account_number) {
            alert("Por favor completa los campos obligatorios")
            return
        }

        setLoading(true)
        try {
            const acc = await AccountsService.createAccount(newAccount)

            setAccounts([acc, ...accounts])
            // Pass the new account directly to advance to step 3
            handleConfirmTransfer(acc, shouldFinish)
        } catch (error: any) {
            console.error(error)
            alert("Error al guardar la cuenta")
            setLoading(false) // Only stop loading on error if we are not advancing
        }
        // Notice we don't have a finally { setLoading(false) } here 
        // because handleConfirmTransfer -> handleCreateTransaction will handle it
    }

    const totalToPay = pendingTransfers.reduce((sum, t) => sum + t.amountSent, 0)

    const handleCreateTransaction = async (transfersOverride?: any[]) => {
        const transfersToProcess = transfersOverride || pendingTransfers
        if (transfersToProcess.length === 0 || !rates) return

        setLoading(true)
        try {
            const marginKey = `${sourceCurrency}_${targetCurrency}`
            const profit_percentage = rates.margins[marginKey] || rates.margins["GENERIC"] || 0

            const getPrice = (code: string) => {
                const key = code === 'VES' ? 'VENEZUELA' : code
                return rates.usdt_prices[key as keyof typeof rates.usdt_prices] || 1
            }
            const sourceUsdtPrice = getPrice(sourceCurrency)

            const txs = transfersToProcess.map(t => ({
                amount_sent: t.amountSent,
                currency_sent: sourceCurrency,
                amount_received: t.amountReceived,
                currency_received: targetCurrency,
                exchange_rate: t.rate,
                profit_percentage,
                profit_amount: ((t.amountSent * profit_percentage) / 100) / sourceUsdtPrice,
                beneficiary_data: {
                    alias: t.account.alias,
                    country: t.account.country,
                    bank_name: t.account.bank_name,
                    account_number: t.account.account_number,
                    details: t.account.details
                }
            }))

            const created = await TransactionsService.createBulk(txs)
            setCreatedTxIds(created.map((t: any) => t.id))
            setCreatedTxId(created[0].id)
            setStep(3)
        } catch (error: any) {
            console.error(error)
            alert(`Error al crear transacciones: ${error.message || 'Error desconocido'}`)
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
    // If closed, show a professional blocked screen
    if (adminSettings?.is_open === false) {
        return (
            <div className="max-w-md mx-auto py-20 text-center space-y-6">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto text-muted-foreground border-4 border-dashed">
                    <Clock className="w-10 h-10" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold">Operaciones Cerradas</h2>
                    <p className="text-muted-foreground">
                        {adminSettings.closed_message}
                    </p>
                </div>
                <div className="pt-4">
                    <Button variant="outline" className="w-full" onClick={() => router.push('/dashboard')}>
                        Volver al Dashboard
                    </Button>
                </div>
            </div>
        )
    }

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
                                        className={isBelowMin ? "border-red-500" : ""}
                                    />
                                    <select
                                        value={sourceCurrency}
                                        onChange={e => setSourceCurrency(e.target.value)}
                                        disabled={pendingTransfers.length > 0}
                                        className={`h-10 border rounded-md px-2 bg-background text-sm ${pendingTransfers.length > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {SUPPORTED_REGIONS.filter(r => r !== 'VENEZUELA').map(region => (
                                            <option key={region} value={region}>
                                                {CURRENCY_LABELS[region]}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {isBelowMin && (
                                    <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 animate-pulse mt-1">
                                        <AlertCircle className="w-3 h-3" />
                                        Monto mínimo: {minAmount} {sourceCurrency === 'USA' ? 'USD' : (sourceCurrency === 'PERU' ? 'PEN' : (sourceCurrency === 'CHILE' ? 'CLP' : 'COP'))}
                                    </p>
                                )}
                                {pendingTransfers.length > 0 && !isBelowMin && (
                                    <p className="text-[10px] text-primary font-bold mt-1">
                                        * La moneda de origen está bloqueada para este grupo de transferencias.
                                    </p>
                                )}
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

                        {targetCurrency === 'VES' && (
                            <div className="p-4 bg-muted/20 border-2 border-dashed rounded-lg space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
                                <label className="text-sm font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                                    <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded text-[10px]">Cálculo BCV</span>
                                    Equivale a:
                                </label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                                        <Input
                                            type="text"
                                            value={amountBcvInput}
                                            onChange={e => updateCalculation(e.target.value, 'bcv')}
                                            onClick={(e) => (e.target as HTMLInputElement).select()}
                                            className="pl-7 bg-background font-bold border-primary/20"
                                            placeholder="Monto en $"
                                        />
                                    </div>
                                    <div className="w-[120px] h-10 rounded-md border border-input bg-muted/10 px-3 py-2 text-xs flex items-center justify-center font-bold text-muted-foreground uppercase">
                                        Dólares
                                    </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground italic">
                                    * Este valor es solo referencial basado en la tasa oficial BCV de hoy ({rates?.usdt_prices.BCV}).
                                </p>
                            </div>
                        )}

                        <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 flex justify-between items-center text-sm">
                            <span className="font-medium">Tasa de cambio:</span>
                            <span className="font-bold">
                                1 {sourceCurrency === 'VENEZUELA' ? 'VES' : (sourceCurrency === 'PERU' ? 'PEN' : (sourceCurrency === 'CHILE' ? 'CLP' : (sourceCurrency === 'COLOMBIA' ? 'COP' : 'USD')))} = {formatRate(rate, targetCurrency, sourceCurrency)} {targetCurrency === 'VENEZUELA' ? 'VES' : (targetCurrency === 'PERU' ? 'PEN' : (targetCurrency === 'CHILE' ? 'CLP' : (targetCurrency === 'COLOMBIA' ? 'COP' : 'USD')))}
                            </span>
                        </div>
                    </CardContent>
                    <CardFooter className="flex-col gap-3">
                        {pendingTransfers.length > 0 && (
                            <div className="w-full space-y-2 mb-2">
                                <h4 className="text-xs font-bold uppercase text-muted-foreground">Envíos en este depósito:</h4>
                                {pendingTransfers.map((t, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm p-2 bg-muted rounded-md border">
                                        <div className="flex flex-col">
                                            <span className="font-bold">{t.account.alias}</span>
                                            <span className="text-[10px] text-muted-foreground">{t.amountSent} {CURRENCY_LABELS[sourceCurrency]}</span>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => setPendingTransfers(pendingTransfers.filter((_, idx) => idx !== i))}>
                                            <Landmark className="w-3 h-3" />
                                        </Button>
                                    </div>
                                ))}
                                <div className="pt-1 border-t flex justify-between font-bold text-sm">
                                    <span>Total Parcial:</span>
                                    <span>{totalToPay} {CURRENCY_LABELS[sourceCurrency]}</span>
                                </div>
                            </div>
                        )}
                        <Button className="w-full" onClick={() => setStep(2)} disabled={isBelowMin}>
                            {pendingTransfers.length > 0 ? "Añadir otro destinatario" : "Continuar"} <ChevronRight className="ml-2 w-4 h-4" />
                        </Button>
                        {pendingTransfers.length > 0 && !isBelowMin && (
                            <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => handleCreateTransaction()} disabled={loading}>
                                {loading ? "Procesando..." : `Finalizar y depositar ${totalToPay} ${CURRENCY_LABELS[sourceCurrency]}`}
                            </Button>
                        )}
                    </CardFooter>
                </Card>
            )}

            {step === 2 && (
                <Card className="border-2">
                    <CardHeader>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4" /></Button>
                                <CardTitle>Paso 2: Beneficiario</CardTitle>
                            </div>
                            {accounts.length > 0 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsAddingAccount(!isAddingAccount)}
                                    className={isAddingAccount ? "text-primary border-primary" : ""}
                                >
                                    {isAddingAccount ? "Ver mis cuentas" : "Nueva Cuenta"}
                                </Button>
                            )}
                        </div>
                        <CardDescription>
                            {isAddingAccount ? "Ingresa los datos del nuevo destinatario." : "Selecciona a quién envías el dinero."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isAddingAccount ? (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                <BeneficiaryForm
                                    data={newAccount}
                                    onChange={setNewAccount}
                                    fixedCountry={targetCurrency === 'VES' ? 'VENEZUELA' : targetCurrency}
                                />
                            </div>
                        ) : accounts.length === 0 ? (
                            <div className="text-center py-6 border rounded-lg border-dashed">
                                <p className="text-muted-foreground mb-4">No tienes cuentas guardadas.</p>
                                <Button onClick={() => setIsAddingAccount(true)}>Agregar Cuenta</Button>
                            </div>
                        ) : (
                            <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2">
                                {accounts.map(acc => (
                                    <div
                                        key={acc.id}
                                        onClick={() => {
                                            setSelectedAccount(acc)
                                        }}
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
                    <CardFooter className="flex flex-col gap-3">
                        {isAddingAccount ? (
                            <>
                                <Button
                                    className="w-full bg-green-600 hover:bg-green-700"
                                    disabled={loading}
                                    onClick={() => handleSaveNewAccount(true)}
                                >
                                    {loading ? "Guardando..." : "Guardar y Continuar al Pago"} <ChevronRight className="ml-2 w-4 h-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    disabled={loading}
                                    onClick={() => handleSaveNewAccount(false)}
                                >
                                    {loading ? "Guardando..." : "Añadir otro destinatario"}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    className="w-full bg-green-600 hover:bg-green-700"
                                    disabled={!selectedAccount || loading}
                                    onClick={() => handleConfirmTransfer(undefined, true)}
                                >
                                    Continuar al Pago <ChevronRight className="ml-2 w-4 h-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    disabled={!selectedAccount || loading}
                                    onClick={() => handleConfirmTransfer(undefined, false)}
                                >
                                    Añadir otro destinatario
                                </Button>
                            </>
                        )}
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
                                    Total a pagar: {totalToPay} {CURRENCY_LABELS[sourceCurrency] || sourceCurrency}
                                </div>
                                <div className="text-[10px] text-blue-800 text-center mt-2 italic">
                                    Este depósito cubrirá {pendingTransfers.length} transferencia(s).
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
