import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { X, Loader2, Search, User, Landmark, Calculator, Check, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { AccountsService, UserAccount } from "@/services/accounts"
import { TransactionsService } from "@/services/transactions"
import { RatesService, RatesData } from "@/services/rates"
import { BankDepositsService, BankDeposit } from "@/services/bank-deposits"
import { calculateRate, formatRate, getRateDecimals, formatCurrency, parseFormattedNumber, isInversePair } from "@/lib/rates-utils"
import { CURRENCY_LABELS, SUPPORTED_REGIONS } from "@/lib/constants"

interface ManualTransactionDialogProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

const REGION_TO_CURRENCY: Record<string, string> = {
    'PERU': 'PEN',
    'CHILE': 'CLP',
    'COLOMBIA': 'COP',
    'USA': 'USD',
    'VENEZUELA': 'VES'
}

export function ManualTransactionDialog({ isOpen, onClose, onSuccess }: ManualTransactionDialogProps) {
    const [step, setStep] = useState(1) // 1: Select User, 2: Select Beneficiary, 3: Transaction Details
    const [loading, setLoading] = useState(false)
    const [users, setUsers] = useState<any[]>([])
    const [userSearch, setUserSearch] = useState("")
    const [selectedUser, setSelectedUser] = useState<any>(null)
    const [accounts, setAccounts] = useState<UserAccount[]>([])
    const [selectedAccount, setSelectedAccount] = useState<UserAccount | null>(null)
    const [rates, setRates] = useState<RatesData | null>(null)

    // Form fields
    const [sourceCurrency, setSourceCurrency] = useState("CHILE")
    const [targetCurrency, setTargetCurrency] = useState("VES")
    const [amountSent, setAmountSent] = useState("100.000")
    const [amountReceived, setAmountReceived] = useState("0")
    const [exchangeRate, setExchangeRate] = useState(0)
    const [reconcileNow, setReconcileNow] = useState(true)
    const [availableDeposits, setAvailableDeposits] = useState<BankDeposit[]>([])
    const [selectedDepositId, setSelectedDepositId] = useState<string | null>(null)

    useEffect(() => {
        if (isOpen) {
            loadUsers()
            loadRates()
        } else {
            // Reset
            setStep(1)
            setSelectedUser(null)
            setSelectedAccount(null)
            setUserSearch("")
            setSelectedDepositId(null)
            setReconcileNow(true)
        }
    }, [isOpen])

    const loadUsers = async () => {
        const { data } = await supabase.from('profiles').select('id, full_name, email, phone, client_code').order('full_name')
        setUsers(data || [])
    }

    const loadRates = async () => {
        const data = await RatesService.getLatest()
        setRates(data)
    }

    const loadUserAccounts = async (userId: string) => {
        setLoading(true)
        const data = await AccountsService.getUserAccounts(userId)
        setAccounts(data)
        setLoading(false)
    }

    useEffect(() => {
        if (selectedUser) {
            loadUserAccounts(selectedUser.id)
        }
    }, [selectedUser])

    useEffect(() => {
        if (reconcileNow && step === 3) {
            const amount = parseFormattedNumber(amountSent)
            if (amount > 0) {
                const currencyCode = REGION_TO_CURRENCY[sourceCurrency] || sourceCurrency
                BankDepositsService.getAvailable(currencyCode)
                    .then(deps => {
                        const matches = deps.filter(d => Number(d.amount) === amount)
                        setAvailableDeposits(matches)
                        if (matches.length === 1) setSelectedDepositId(matches[0].id!)
                        else setSelectedDepositId(null)
                    })
                    .catch(err => console.error("Error loading deposits:", err))
            } else {
                setAvailableDeposits([])
            }
        }
    }, [amountSent, sourceCurrency, reconcileNow, step])

    // Calculator Logic
    useEffect(() => {
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
        const rate = Number(rawRate.toFixed(decimals))
        setExchangeRate(rate)

        const isInverse = isInversePair(targetCurrency, sourceCurrency)
        const numericSource = parseFormattedNumber(amountSent)
        const result = isInverse ? (rate > 0 ? numericSource / rate : 0) : numericSource * rate
        setAmountReceived(formatCurrency(result))
    }, [sourceCurrency, targetCurrency, amountSent, rates])

    const handleCreate = async () => {
        if (!selectedUser || !selectedAccount) return
        if (reconcileNow && !selectedDepositId) {
            alert("Por favor selecciona un depósito para conciliar.")
            return
        }

        setLoading(true)
        try {
            const mappedSource = REGION_TO_CURRENCY[sourceCurrency] || sourceCurrency
            const mappedTarget = REGION_TO_CURRENCY[targetCurrency] || targetCurrency

            const tx = await TransactionsService.createForUser(selectedUser.id, {
                amount_sent: parseFormattedNumber(amountSent),
                currency_sent: mappedSource,
                amount_received: parseFormattedNumber(amountReceived),
                currency_received: mappedTarget,
                exchange_rate: exchangeRate,
                status: reconcileNow ? 'verified' : 'verifying',
                beneficiary_data: selectedAccount
            })

            if (reconcileNow && selectedDepositId && tx.id) {
                await BankDepositsService.match(selectedDepositId, tx.id)
            }

            alert(reconcileNow ? "Operación creada y conciliada con éxito" : "Operación creada con éxito (pendiente de conciliación)")
            onSuccess()
            onClose()
        } catch (error: any) {
            alert("Error: " + error.message)
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    const filteredUsers = users.filter(u =>
        u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.phone?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.client_code?.toLowerCase().includes(userSearch.toLowerCase())
    )

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border-none">
                <CardHeader className="border-b bg-card">
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="text-xl">Nueva Operación Manual</CardTitle>
                            <CardDescription>Carga una operación recibida por WhatsApp u otro medio.</CardDescription>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                    {/* Stepper */}
                    <div className="flex gap-2 mt-4">
                        {[1, 2, 3].map(s => (
                            <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${step >= s ? 'bg-primary' : 'bg-muted'}`} />
                        ))}
                    </div>
                </CardHeader>

                <CardContent className="p-0 overflow-y-auto">
                    {step === 1 && (
                        <div className="p-6 space-y-4">
                            <h3 className="font-bold flex items-center gap-2"><User className="w-4 h-4 text-primary" /> Paso 1: Seleccionar Cliente</h3>
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por nombre, código o teléfono..."
                                    className="pl-9 h-12"
                                    value={userSearch}
                                    onChange={e => setUserSearch(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                                {filteredUsers.map(u => (
                                    <div
                                        key={u.id}
                                        className={`p-4 border rounded-xl cursor-pointer transition-all hover:border-primary hover:bg-primary/5 flex items-center justify-between ${selectedUser?.id === u.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''}`}
                                        onClick={() => {
                                            setSelectedUser(u)
                                            setStep(2)
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                {u.full_name?.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-bold flex items-center gap-1">
                                                    {u.client_code && <span className="text-[10px] bg-primary/10 px-1.5 py-0.5 rounded text-primary font-mono">{u.client_code}</span>}
                                                    {u.full_name}
                                                </div>
                                                <div className="text-xs text-muted-foreground">{u.phone} • {u.email}</div>
                                            </div>
                                        </div>
                                        <Check className={`w-5 h-5 text-primary ${selectedUser?.id === u.id ? 'opacity-100' : 'opacity-0'}`} />
                                    </div>
                                ))}
                                {filteredUsers.length === 0 && (
                                    <div className="text-center py-10 border-2 border-dashed rounded-xl text-muted-foreground">
                                        No se encontraron clientes.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold flex items-center gap-2"><Landmark className="w-4 h-4 text-primary" /> Paso 2: Destinatario de {selectedUser?.full_name}</h3>
                                <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="text-xs">Cambiar Cliente</Button>
                            </div>

                            {loading ? (
                                <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
                            ) : (
                                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                                    {accounts.map(acc => (
                                        <div
                                            key={acc.id}
                                            className={`p-4 border rounded-xl cursor-pointer transition-all hover:border-primary hover:bg-primary/5 flex items-center justify-between ${selectedAccount?.id === acc.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''}`}
                                            onClick={() => {
                                                setSelectedAccount(acc)
                                                setTargetCurrency(acc.country === 'VENEZUELA' ? 'VES' : acc.country)
                                                setStep(3)
                                            }}
                                        >
                                            <div>
                                                <div className="font-bold text-lg">{acc.alias}</div>
                                                <div className="text-xs text-muted-foreground uppercase">{acc.bank_name} • {acc.account_number}</div>
                                                <div className="text-[10px] mt-1 bg-muted px-2 py-0.5 rounded-full inline-block">{acc.country}</div>
                                            </div>
                                            <Check className={`w-5 h-5 text-primary ${selectedAccount?.id === acc.id ? 'opacity-100' : 'opacity-0'}`} />
                                        </div>
                                    ))}
                                    {accounts.length === 0 && (
                                        <div className="text-center py-10 border-2 border-dashed rounded-xl">
                                            <p className="text-muted-foreground mb-4">El cliente no tiene beneficiarios registrados.</p>
                                            <Button variant="outline" asChild>
                                                <a href={`/admin/users`} target="_blank">Registrar uno en Usuarios</a>
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="p-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold flex items-center gap-2"><Calculator className="w-4 h-4 text-primary" /> Paso 3: Datos de la Remesa</h3>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="text-xs">Cliente</Button>
                                    <Button variant="ghost" size="sm" onClick={() => setStep(2)} className="text-xs">Destinatario</Button>
                                </div>
                            </div>

                            <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 space-y-1">
                                <div className="text-xs text-muted-foreground">Destinatario Seleccionado</div>
                                <div className="font-bold">{selectedAccount?.alias} ({selectedAccount?.country})</div>
                                <div className="text-xs font-mono">{selectedAccount?.bank_name} - {selectedAccount?.account_number}</div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Origen</label>
                                    <select
                                        className="w-full h-12 rounded-lg border px-3 bg-background"
                                        value={sourceCurrency}
                                        onChange={e => setSourceCurrency(e.target.value)}
                                    >
                                        {SUPPORTED_REGIONS.map(region => (
                                            <option key={region} value={region}>{region}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2 text-right">
                                    <label className="text-sm font-medium">Tasa Actual</label>
                                    <div className="h-12 flex items-center justify-end font-bold text-primary font-mono text-xl">
                                        {exchangeRate}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">
                                        Envía ({sourceCurrency === 'PERU' ? 'Soles' : (sourceCurrency === 'CHILE' ? 'Pesos' : (sourceCurrency === 'COLOMBIA' ? 'Pesos' : sourceCurrency))})
                                    </label>
                                    <Input
                                        value={amountSent}
                                        onChange={e => setAmountSent(e.target.value)}
                                        className="h-12 text-lg font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Recibe ({targetCurrency})</label>
                                    <Input
                                        value={amountReceived}
                                        readOnly
                                        className="h-12 text-lg font-bold bg-muted"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t">
                                <label className="text-sm font-medium block">Estado Inicial</label>
                                <div className="flex gap-4">
                                    <div
                                        className={`flex-1 p-3 border rounded-xl cursor-pointer transition-all flex items-center gap-3 ${reconcileNow ? 'border-primary bg-primary/5' : ''}`}
                                        onClick={() => setReconcileNow(true)}
                                    >
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${reconcileNow ? 'border-primary' : 'border-muted-foreground'}`}>
                                            {reconcileNow && <div className="w-2 h-2 rounded-full bg-primary" />}
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm">Conciliar</div>
                                            <div className="text-[10px] text-muted-foreground">Ya recibí el depósito.</div>
                                        </div>
                                    </div>
                                    <div
                                        className={`flex-1 p-3 border rounded-xl cursor-pointer transition-all flex items-center gap-3 ${!reconcileNow ? 'border-yellow-500 bg-yellow-50/50' : ''}`}
                                        onClick={() => {
                                            setReconcileNow(false)
                                            setSelectedDepositId(null)
                                        }}
                                    >
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${!reconcileNow ? 'border-yellow-500' : 'border-muted-foreground'}`}>
                                            {!reconcileNow && <div className="w-2 h-2 rounded-full bg-yellow-500" />}
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm">Por conciliar</div>
                                            <div className="text-[10px] text-muted-foreground">Se conciliará luego.</div>
                                        </div>
                                    </div>
                                </div>

                                {reconcileNow && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                            <Landmark className="w-3 h-3 text-primary" /> Depósitos Disponibles ({REGION_TO_CURRENCY[sourceCurrency] || sourceCurrency})
                                        </label>
                                        <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                                            {availableDeposits.map(dep => (
                                                <div
                                                    key={dep.id}
                                                    className={`p-2 border rounded-lg cursor-pointer flex justify-between items-center text-sm transition-all ${selectedDepositId === dep.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'}`}
                                                    onClick={() => setSelectedDepositId(dep.id!)}
                                                >
                                                    <div>
                                                        <div className="font-bold">{formatCurrency(dep.amount)} {dep.currency}</div>
                                                        <div className="text-[10px] text-muted-foreground">Ref: {dep.reference_number} • {dep.bank_name || '-'}</div>
                                                    </div>
                                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedDepositId === dep.id ? 'bg-primary border-primary' : 'border-muted'}`}>
                                                        {selectedDepositId === dep.id && <Check className="w-3 h-3 text-white" />}
                                                    </div>
                                                </div>
                                            ))}
                                            {availableDeposits.length === 0 && (
                                                <div className="p-3 bg-muted/20 border rounded-lg text-xs text-center flex flex-col items-center gap-2">
                                                    <AlertCircle className="w-4 h-4 text-muted-foreground" />
                                                    No hay depósitos de {formatCurrency(parseFormattedNumber(amountSent))} {REGION_TO_CURRENCY[sourceCurrency] || sourceCurrency} disponibles.
                                                    <Button variant="link" className="h-auto p-0 text-[10px]" asChild>
                                                        <a href="/admin/deposits" target="_blank">Registrar depósito nuevo</a>
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>

                <CardFooter className="border-t bg-muted/30 p-4 gap-3">
                    <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancelar</Button>
                    <Button
                        className="flex-1 bg-primary hover:bg-primary/90"
                        disabled={loading || (step < 3 && !selectedUser) || (step === 3 && !selectedAccount) || (step === 3 && reconcileNow && !selectedDepositId)}
                        onClick={step === 3 ? handleCreate : () => setStep(step + 1)}
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        {step === 3 ? (reconcileNow ? 'Conciliar y Crear' : 'Crear Operación') : 'Siguiente'}
                        {step < 3 && <Check className="w-4 h-4 ml-2" />}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
