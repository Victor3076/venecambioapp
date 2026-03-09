"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { RatesService, RatesData } from "@/services/rates"
import { AccountsService, UserAccount } from "@/services/accounts"
import { PaymentMethodsService, PaymentMethod } from "@/services/payment-methods"
import { TransactionsService } from "@/services/transactions"
import { AdminSettingsService, AdminSettings } from "@/services/admin-settings"
import { calculateRate, formatRate, getRateDecimals, formatCurrency, parseFormattedNumber, isInversePair, performCalculation } from "@/lib/rates-utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Landmark, Upload, Info, ArrowLeft, Check, ChevronRight, AlertCircle, Plus, Clock, ChevronsDown } from "lucide-react"
import { CURRENCY_LABELS, SUPPORTED_REGIONS, MINIMUM_AMOUNTS } from "@/lib/constants"
import { BeneficiaryForm, BeneficiaryData } from "@/components/BeneficiaryForm"

export default function NewTransactionPage() {
    const router = useRouter()
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)

    const [amountInput, setAmountInput] = useState("100")
    const [amountReceivedInput, setAmountReceivedInput] = useState("")
    const [amountBcvInput, setAmountBcvInput] = useState("")
    const amountSent = parseFormattedNumber(amountInput)
    const [sourceCurrency, setSourceCurrency] = useState("PEN")
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
        country: 'VES',
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
                    if (profile.phone.startsWith('+51')) defaultSource = 'PEN'
                    else if (profile.phone.startsWith('+56')) defaultSource = 'CLP'
                    else if (profile.phone.startsWith('+57')) defaultSource = 'COP'
                    else if (profile.phone.startsWith('+1')) defaultSource = 'USD'

                    setSourceCurrency(defaultSource)
                    const cAccounts = await PaymentMethodsService.getByCountry(defaultSource)
                    setCompanyAccounts(cAccounts)
                }
            }
        }
        loadInitial()

        // Subscribe to realtime rate changes
        const unsubscribe = RatesService.subscribe((newRates) => {
            setRates(newRates)
        })

        return () => unsubscribe()
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
            return rates.usdt_prices[code as keyof typeof rates.usdt_prices] || 0
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

        const isInverse = isInversePair(targetCurrency, sourceCurrency)

        if (direction === 'sent') {
            const numericValue = parseFormattedNumber(value)
            setAmountInput(value)
            const res = performCalculation(numericValue, rate, isInverse)
            setAmountReceivedInput(formatCurrency(res, targetCurrency))
            if (targetCurrency === 'VES') {
                setAmountBcvInput(formatCurrency(res / bcvRate, 'USD'))
            }
        } else if (direction === 'received') {
            const numericValue = parseFormattedNumber(value)
            setAmountReceivedInput(value)
            // Reverse direction: if normal, divide. If inverse (source is cheaper), multiply.
            const res = performCalculation(numericValue, rate, !isInverse)
            setAmountInput(formatCurrency(res, sourceCurrency))
            if (targetCurrency === 'VES') {
                setAmountBcvInput(formatCurrency(numericValue / bcvRate, 'USD'))
            }
        } else if (direction === 'bcv') {
            const numericValue = parseFormattedNumber(value)
            setAmountBcvInput(value)
            if (targetCurrency === 'VES') {
                const amountRec = numericValue * bcvRate
                setAmountReceivedInput(formatCurrency(amountRec, targetCurrency))
                const resultSent = performCalculation(amountRec, rate, !isInverse)
                setAmountInput(formatCurrency(resultSent, sourceCurrency))
            }
        }
    }

    // Effect to handle currency/rate changes (sync from 'sent' amount)
    useEffect(() => {
        if (rates) {
            const getPrice = (code: string) => {
                return rates.usdt_prices[code as keyof typeof rates.usdt_prices] || 0
            }
            const sp = getPrice(sourceCurrency)
            const tp = getPrice(targetCurrency)
            const mk = `${sourceCurrency}_${targetCurrency}`
            const m = rates.margins[mk] || rates.margins["GENERIC"] || 0
            const rr = calculateRate(targetCurrency, sourceCurrency, tp, sp, m)
            const dec = getRateDecimals(targetCurrency, sourceCurrency)
            // IMPORTANT: Round rate to displayed precision for exact calculations
            const r = Number(rr.toFixed(dec))

            const isInv = isInversePair(targetCurrency, sourceCurrency)
            const res = performCalculation(amountSent, r, isInv)
            setAmountReceivedInput(formatCurrency(res, targetCurrency))

            if (targetCurrency === 'VES') {
                const bcvRate = rates.usdt_prices.BCV || 1
                setAmountBcvInput(formatCurrency(res / bcvRate, 'USD'))
            }
        }
    }, [sourceCurrency, targetCurrency, rates])

    // Sync newAccount country when targetCurrency changes
    useEffect(() => {
        setNewAccount(prev => ({
            ...prev,
            country: targetCurrency
        }))
    }, [targetCurrency])

    // Re-calculating derived values for display
    const getSnapshot = () => {
        if (!rates) return { rate: 0, received: 0 }

        const getPrice = (code: string) => {
            return rates.usdt_prices[code as keyof typeof rates.usdt_prices] || 0
        }
        const sourcePrice = getPrice(sourceCurrency)
        const targetPrice = getPrice(targetCurrency)
        const marginKey = `${sourceCurrency}_${targetCurrency}`
        const margin = rates.margins[marginKey] || rates.margins["GENERIC"] || 0
        const rawRate = calculateRate(targetCurrency, sourceCurrency, targetPrice, sourcePrice, margin)
        const decimals = getRateDecimals(targetCurrency, sourceCurrency)
        // IMPORTANT: Round rate to displayed precision for exact calculations
        const rate = Number(rawRate.toFixed(decimals))
        const isInv = isInversePair(targetCurrency, sourceCurrency)
        return { rate, received: performCalculation(amountSent, rate, isInv) }
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
            // No longer calling handleCreateTransaction here
            // Instead, we just go to the payment instructions step
            setStep(3)
        } else {
            setSelectedAccount(null)
            setAmountInput("100")
            setStep(1)
        }
    }

    const handleSaveNewAccount = async (shouldFinish: boolean) => {
        if (!newAccount.alias || !newAccount.bank_name || !newAccount.account_number) {
            toast.warning("Por favor completa los campos obligatorios")
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
            toast.error("Error al guardar la cuenta")
            setLoading(false) // Only stop loading on error if we are not advancing
        }
        // Notice we don't have a finally { setLoading(false) } here 
        // because handleConfirmTransfer -> handleCreateTransaction will handle it
    }

    const totalToPay = pendingTransfers.reduce((sum, t) => sum + t.amountSent, 0)

    const handleCreateTransaction = async (transfersOverride?: any[]) => {
        const transfersToProcess = transfersOverride || pendingTransfers
        if (transfersToProcess.length === 0 || !rates) return

        try {
            const marginKey = `${sourceCurrency}_${targetCurrency}`
            const profit_percentage = rates.margins[marginKey] || rates.margins["GENERIC"] || 0

            const getPrice = (code: string) => {
                return rates.usdt_prices[code as keyof typeof rates.usdt_prices] || 1
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
            return created[0].id // Return the first ID for the upload
        } catch (error: any) {
            console.error(error)
            toast.error(`Error al crear transacciones: ${error.message || 'Error desconocido'}`)
            throw error
        }
    }

    const handleUpload = async () => {
        if (!file) {
            toast.warning("Por favor selecciona un comprobante")
            return
        }

        // Limit size validation to prevent UI freeze
        if (file.size > 15 * 1024 * 1024) {
            toast.error("El archivo es demasiado gigantesco. Por favor recórtalo o usa otra foto.")
            return
        }

        setLoading(true)
        console.log("Starting upload process for file:", file.name, "size:", file.size)

        // Create a timeout promise
        const uploadTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout: La subida está tardando demasiado. Revisa tu internet.")), 45000)
        )

        try {
            await Promise.race([
                (async () => {
                    let fileToUpload = file

                    if (!file.type.startsWith('image/') && fileToUpload.size > 5 * 1024 * 1024) {
                        toast.warning("Los documentos PDF deben ser menores a 5MB.")
                        setLoading(false)
                        return
                    }

                    // 1. Create the transaction records first in the DB
                    console.log("Creating transaction record in DB...")
                    const txId = await handleCreateTransaction()

                    if (!txId) {
                        throw new Error("No se pudo iniciar la transacción")
                    }
                    console.log("Transaction record created:", txId)

                    // 2. Upload the file
                    console.log("Uploading proof to storage...")
                    await TransactionsService.uploadProof(fileToUpload, txId)
                    console.log("Upload complete!")

                    setStep(4)
                })(),
                uploadTimeout
            ])
        } catch (error: any) {
            console.error("Full upload error:", error)
            const message = error.message?.includes("Timeout")
                ? error.message
                : "Error al procesar la operación. Por favor revisa tu conexión e intenta de nuevo."
            toast.error(message)
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
                                        type="text"
                                        value={amountInput}
                                        onBlur={() => setAmountInput(formatCurrency(parseFormattedNumber(amountInput), sourceCurrency))}
                                        onChange={e => updateCalculation(e.target.value, 'sent')}
                                        onClick={(e) => (e.target as HTMLInputElement).select()}
                                        className={isBelowMin ? "border-red-500" : ""}
                                    />
                                    <select
                                        value={sourceCurrency}
                                        onChange={e => {
                                            const newSource = e.target.value
                                            setSourceCurrency(newSource)
                                            if (newSource === targetCurrency) {
                                                setTargetCurrency(newSource === 'VES' ? 'PEN' : 'VES')
                                            }
                                        }}
                                        disabled={pendingTransfers.length > 0}
                                        className={`h-10 border rounded-md px-2 bg-background text-sm ${pendingTransfers.length > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {SUPPORTED_REGIONS.filter(r => r !== 'VES').map(region => (
                                            <option key={region} value={region}>
                                                {CURRENCY_LABELS[region]} {region}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {isBelowMin && (
                                    <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 animate-pulse mt-1">
                                        <AlertCircle className="w-3 h-3" />
                                        Monto mínimo: {formatCurrency(minAmount, sourceCurrency)} {sourceCurrency}
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
                                    <select
                                        value={targetCurrency}
                                        onChange={e => setTargetCurrency(e.target.value)}
                                        className="h-10 border rounded-md px-2 bg-background text-sm"
                                    >
                                        {SUPPORTED_REGIONS.filter(region => region !== sourceCurrency).map(region => (
                                            <option key={region} value={region}>
                                                {CURRENCY_LABELS[region]} {region}
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
                                            onBlur={() => setAmountBcvInput(formatCurrency(parseFormattedNumber(amountBcvInput), 'USD'))}
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
                                1 {isInversePair(targetCurrency, sourceCurrency) ? targetCurrency : sourceCurrency} = {formatRate(rate, targetCurrency, sourceCurrency)} {isInversePair(targetCurrency, sourceCurrency) ? sourceCurrency : targetCurrency}
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
                                            <span className="text-[10px] text-muted-foreground">{formatCurrency(t.amountSent, sourceCurrency)} {CURRENCY_LABELS[sourceCurrency]}</span>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => setPendingTransfers(pendingTransfers.filter((_, idx) => idx !== i))}>
                                            <Landmark className="w-3 h-3" />
                                        </Button>
                                    </div>
                                ))}
                                <div className="pt-1 border-t flex justify-between font-bold text-sm">
                                    <span>Total Parcial:</span>
                                    <span>{formatCurrency(totalToPay, sourceCurrency)} {CURRENCY_LABELS[sourceCurrency]}</span>
                                </div>
                            </div>
                        )}
                        <Button className="w-full" onClick={() => setStep(2)} disabled={isBelowMin}>
                            {pendingTransfers.length > 0 ? "Añadir otro destinatario" : "Continuar"} <ChevronRight className="ml-2 w-4 h-4" />
                        </Button>
                        {pendingTransfers.length > 0 && !isBelowMin && (
                            <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => setStep(3)} disabled={loading}>
                                {loading ? "Procesando..." : `Finalizar y depositar ${formatCurrency(totalToPay, sourceCurrency)} ${CURRENCY_LABELS[sourceCurrency]}`}
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
                                    fixedCountry={targetCurrency}
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
                    <CardContent className="space-y-4 p-4 sm:p-6">
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 space-y-3">
                            <h3 className="font-bold flex items-center gap-2 text-blue-800 text-sm"><Info className="w-4 h-4" /> Datos para transferir</h3>
                            <div className="text-sm space-y-2 text-blue-900">
                                {companyAccounts.length > 0 ? (
                                    companyAccounts.map((acc, idx) => (
                                        <div key={acc.id} className="p-3 bg-white rounded-md border border-blue-100 shadow-sm relative overflow-hidden">
                                            <div className="absolute top-0 right-0 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary rounded-bl">
                                                Opción {idx + 1}
                                            </div>
                                            <p className="font-bold text-primary text-xs mb-1">{acc.bank_name}</p>
                                            <div className="space-y-0 text-[11px]">
                                                <p><strong>Número:</strong> {acc.account_number}</p>
                                                <p><strong>Titular:</strong> {acc.holder_name}</p>
                                                {(acc.holder_id || acc.details?.rut || acc.details?.id_number) && (
                                                    <p><strong>{acc.country === 'CLP' ? 'RUT' : (acc.country === 'COP' ? 'Cédula' : 'ID')}:</strong> {acc.holder_id || acc.details?.rut || acc.details?.id_number}</p>
                                                )}
                                                {acc.details?.account_type && (
                                                    <p><strong>Tipo:</strong> {acc.details.account_type}</p>
                                                )}
                                                {acc.details?.email && (
                                                    <p className="text-[11px] text-primary/70 mt-1"><strong>Aviso:</strong> {acc.details.email}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-3 bg-white rounded-md border border-blue-100 shadow-sm text-xs">
                                        <p className="font-bold text-primary mb-1">Instrucciones de Pago</p>
                                        <p>Por favor contacta al administrador vía WhatsApp para obtener los datos de transferencia para {CURRENCY_LABELS[sourceCurrency] || sourceCurrency}.</p>
                                    </div>
                                )}

                                <div className="mt-2 p-2 bg-primary text-white rounded-md font-bold text-center text-lg shadow-md">
                                    Total a pagar: {formatCurrency(totalToPay, sourceCurrency)} {CURRENCY_LABELS[sourceCurrency] || sourceCurrency}
                                </div>
                                <div className="text-[10px] text-blue-800 text-center mt-1 italic">
                                    Este depósito cubrirá {pendingTransfers.length} transferencia(s).
                                </div>

                                {sourceCurrency === 'PEN' && (
                                    <div className="mt-2 bg-amber-100 p-2 rounded-md border border-amber-300 text-amber-900 text-[11px] text-center shadow-sm">
                                        <span className="font-bold text-amber-700">⚠️ ADVERTENCIA:</span> Si es depósito por <strong className="font-bold">Agente</strong>, al ticket físico escríbele con lapicero "<strong className="font-black text-amber-950">Venecambio.com</strong>" antes de tomarle la foto.
                                    </div>
                                )}
                                {sourceCurrency === 'CLP' && (
                                    <div className="mt-2 bg-amber-100 p-2 rounded-md border border-amber-300 text-amber-900 text-[11px] text-center shadow-sm">
                                        <span className="font-bold text-amber-700">⚠️ ADVERTENCIA:</span> Si es depósito por <strong className="font-bold">Caja Vecina</strong>, al ticket físico escríbele con lapicero "<strong className="font-black text-amber-950">Venecambio.com</strong>" antes de tomarle la foto.
                                    </div>
                                )}
                                {sourceCurrency === 'COP' && (
                                    <div className="mt-2 bg-amber-100 p-2 rounded-md border border-amber-300 text-amber-900 text-[11px] text-center shadow-sm">
                                        <span className="font-bold text-amber-700">⚠️ ADVERTENCIA:</span> Si es depósito por <strong className="font-bold">Corresponsal</strong>, al ticket físico escríbele con lapicero "<strong className="font-black text-amber-950">Venecambio.com</strong>" antes de tomarle la foto.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col items-center justify-center py-1 text-primary animate-bounce">
                            <span className="text-[10px] font-black mb-0.5 uppercase tracking-tighter">Deslizar para subir comprobante ↓</span>
                        </div>

                        <div className="space-y-1">
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
