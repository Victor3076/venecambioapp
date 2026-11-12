"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { TransactionsService, Transaction } from "@/services/transactions"
import { BankDepositsService, BankDeposit } from "@/services/bank-deposits"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Scale, Landmark, TrendingUp, TrendingDown, Wallet, Calendar, Trash2, Edit, X, Search, FileUp, RotateCcw, Loader2, CheckCircle2, AlertCircle, Info, ChevronDown, ChevronUp } from "lucide-react"
import Link from "next/link"
import { CURRENCY_LABELS } from "@/lib/constants"
import { formatCurrency } from "@/lib/rates-utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"

import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { AdjustmentsService, CashflowAdjustment } from "@/services/adjustments"
import { AdjustmentDialog } from "@/components/admin/adjustment-dialog"
import { extractAmountsFromBankPdf } from "@/lib/pdf-reconciliation"

const REGION_TO_CURRENCY: Record<string, string> = {
    'PERU': 'PEN',
    'CHILE': 'CLP',
    'COLOMBIA': 'COP',
    'USA': 'USD',
    'VENEZUELA': 'VES'
}

export default function AdminBalancePage() {
    const router = useRouter()
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [deposits, setDeposits] = useState<BankDeposit[]>([])
    const [adjustments, setAdjustments] = useState<CashflowAdjustment[]>([])
    const [loading, setLoading] = useState(true)
    const [filterDate, setFilterDate] = useState(new Date().toLocaleDateString('en-CA'))

    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false)
    const [adjustType, setAdjustType] = useState<'withdrawal' | 'initialization'>('withdrawal')
    const [adjustmentToEdit, setAdjustmentToEdit] = useState<CashflowAdjustment | null>(null)

    const [reconciliationCurrency, setReconciliationCurrency] = useState<string | null>(null)
    const [crossedOutTxs, setCrossedOutTxs] = useState<Set<string>>(new Set())
    const [reconciliationSearch, setReconciliationSearch] = useState("")
    const [isUploadingPdf, setIsUploadingPdf] = useState(false)
    const [pdfResults, setPdfResults] = useState<{
        filename: string
        totalFound: number
        matchedCount: number
        unmatchedBankItems: { amount: number; filename: string }[]
    }[]>([])
    const [showUnmatchedDetails, setShowUnmatchedDetails] = useState(true)
    const [isDraggingFile, setIsDraggingFile] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Cargar marcas guardadas en localStorage para la fecha y moneda seleccionada
    useEffect(() => {
        if (!reconciliationCurrency) {
            setPdfResults([])
            return
        }
        const storageKey = `reconciliation_crossed_${filterDate}_${reconciliationCurrency}`
        try {
            const saved = localStorage.getItem(storageKey)
            if (saved) {
                const parsed = JSON.parse(saved)
                if (Array.isArray(parsed)) {
                    setCrossedOutTxs(new Set(parsed))
                }
            } else {
                setCrossedOutTxs(new Set())
            }
        } catch {
            setCrossedOutTxs(new Set())
        }
        setPdfResults([])
    }, [reconciliationCurrency, filterDate])

    const updateCrossedOut = (newSet: Set<string>) => {
        setCrossedOutTxs(newSet)
        if (reconciliationCurrency) {
            const storageKey = `reconciliation_crossed_${filterDate}_${reconciliationCurrency}`
            try {
                localStorage.setItem(storageKey, JSON.stringify(Array.from(newSet)))
            } catch (e) {
                console.error("Error guardando marcas en localStorage", e)
            }
        }
    }

    const handleClearMarks = () => {
        if (crossedOutTxs.size === 0) return
        if (confirm("¿Deseas desmarcar todas las transferencias de esta lista?")) {
            updateCrossedOut(new Set())
            setPdfResults([])
            toast.success("Se han desmarcado todas las transferencias.")
        }
    }

    const processBankPdfFiles = async (files: FileList | File[]) => {
        const fileList = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf')
        if (fileList.length === 0) {
            toast.error("Por favor selecciona archivos PDF válidos.")
            return
        }

        setIsUploadingPdf(true)
        const toastId = toast.loading(`Leyendo ${fileList.length === 1 ? 'PDF bancario...' : `${fileList.length} PDFs bancarios...`}`)

        try {
            // Operaciones relevantes para esta moneda
            const relevantTxs = transactions.filter(tx => 
                (tx.status === 'verified' || tx.status === 'completed') && 
                tx.beneficiary_data?.type !== 'cash' && 
                (REGION_TO_CURRENCY[tx.currency_received] || tx.currency_received) === reconciliationCurrency
            )

            // Usamos el Set actual como punto de partida y vamos acumulando
            const workingSet = new Set(crossedOutTxs)
            const newResults: {
                filename: string
                totalFound: number
                matchedCount: number
                unmatchedBankItems: { amount: number; filename: string }[]
            }[] = []

            let totalNewlyMarked = 0

            for (const file of fileList) {
                const bankAmounts = await extractAmountsFromBankPdf(file)

                if (bankAmounts.length === 0) {
                    newResults.push({
                        filename: file.name,
                        totalFound: 0,
                        matchedCount: 0,
                        unmatchedBankItems: []
                    })
                    continue
                }

                let fileNewlyMarked = 0
                const fileUnmatched: { amount: number; filename: string }[] = []

                // Para cada monto presente en este extracto bancario:
                // Buscamos una operación en el sistema que aún NO esté tachada
                for (const amt of bankAmounts) {
                    const key = amt.toFixed(2)
                    const matchingTx = relevantTxs.find(tx => 
                        !workingSet.has(tx.id!) && 
                        Number(tx.amount_received).toFixed(2) === key
                    )

                    if (matchingTx) {
                        workingSet.add(matchingTx.id!)
                        fileNewlyMarked++
                        totalNewlyMarked++
                    } else {
                        // Este monto del banco no tiene operación pendiente en el sistema (sobra en el PDF)
                        fileUnmatched.push({
                            amount: amt,
                            filename: file.name
                        })
                    }
                }

                newResults.push({
                    filename: file.name,
                    totalFound: bankAmounts.length,
                    matchedCount: fileNewlyMarked,
                    unmatchedBankItems: fileUnmatched
                })
            }

            updateCrossedOut(workingSet)
            setPdfResults(prev => [...prev, ...newResults])
            setShowUnmatchedDetails(true)

            toast.dismiss(toastId)
            const totalUnmatchedCount = newResults.reduce((s, r) => s + r.unmatchedBankItems.length, 0)

            if (totalNewlyMarked > 0) {
                toast.success(`¡Listo! Se tacharon ${totalNewlyMarked} transferencias.${totalUnmatchedCount > 0 ? ` Hay ${totalUnmatchedCount} montos sobrantes en el banco.` : ''}`)
            } else if (totalUnmatchedCount > 0) {
                toast.warning(`No se encontraron transferencias pendientes para los montos leídos (${totalUnmatchedCount} sobran en el banco).`)
            } else {
                toast.info("Las operaciones correspondientes al PDF ya estaban tachadas.")
            }
        } catch (err: any) {
            console.error(err)
            toast.dismiss(toastId)
            toast.error(err.message || "Error al procesar los archivos PDF")
        } finally {
            setIsUploadingPdf(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files && files.length > 0) {
            processBankPdfFiles(files)
        }
    }

    // Verificar rol una sola vez al montar el componente
    useEffect(() => {
        const checkRole = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push("/login")
                return
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single()

            if (!profile || profile.role !== 'admin') {
                router.push("/admin/transactions")
                return
            }

            loadData()
        }
        checkRole()
    }, []) // Solo al montar

    // Recargar datos cuando cambia la fecha
    useEffect(() => {
        loadData()
    }, [filterDate])

    const loadData = async () => {
        setLoading(true)
        try {
            // Filtrado server-side: solo se descargan los registros del día seleccionado
            const dateFilter = filterDate
                ? { startDate: filterDate, endDate: filterDate }
                : undefined

            const [txs, deps, adjs] = await Promise.all([
                TransactionsService.getAll(dateFilter),
                BankDepositsService.getAll(dateFilter),
                AdjustmentsService.getByDate(filterDate)
            ])

            setTransactions(txs as Transaction[])
            setDeposits(deps as BankDeposit[])
            setAdjustments(adjs as CashflowAdjustment[])
        } catch (error) {
            console.error("Error loading balance data:", error)
        } finally {
            setLoading(false)
        }
    }

    const processBalance = () => {
        const balanceMap: Record<string, { income: number, outflow: number, currency: string, bank: string }> = {}

        // Income from deposits (by bank/currency)
        deposits.forEach(dep => {
            const standardCurr = REGION_TO_CURRENCY[dep.currency] || dep.currency
            const key = `${dep.bank_name || 'OTROS'}_${standardCurr}`
            if (!balanceMap[key]) {
                balanceMap[key] = { income: 0, outflow: 0, currency: standardCurr, bank: dep.bank_name || 'OTROS' }
            }
            balanceMap[key].income += Number(dep.amount)
        })

        return Object.values(balanceMap)
    }

    const balances = processBalance()

    // Group by currency for summary cards - Standardize all to ISO codes
    const summaryByCurrency = deposits.reduce((acc: any, dep) => {
        const curr = REGION_TO_CURRENCY[dep.currency] || dep.currency
        acc[curr] = (acc[curr] || 0) + Number(dep.amount)
        return acc
    }, {})

    // 1. Income from Operations (What the client SENDS us in source currency)
    const incomeByCurrency = transactions
        .filter(tx => tx.status === 'verified' || tx.status === 'completed')
        .reduce((acc: any, tx) => {
            const curr = REGION_TO_CURRENCY[tx.currency_sent] || tx.currency_sent
            acc[curr] = (acc[curr] || 0) + Number(tx.amount_sent)
            return acc
        }, {})

    // 2. Outflow/Sales from Operations (What we PAY to beneficiaries in target currency)
    const outflowByCurrency = transactions
        .filter(tx => (tx.status === 'verified' || tx.status === 'completed') && tx.beneficiary_data?.type !== 'cash')
        .reduce((acc: any, tx) => {
            const curr = REGION_TO_CURRENCY[tx.currency_received] || tx.currency_received
            acc[curr] = (acc[curr] || 0) + Number(tx.amount_received)
            return acc
        }, {})

    const startBalanceByCurrency = adjustments
        .filter(a => a.type === 'initialization')
        .reduce((acc: any, a) => {
            const curr = REGION_TO_CURRENCY[a.currency] || a.currency
            acc[curr] = (acc[curr] || 0) + Number(a.amount)
            return acc
        }, {})

    const withdrawalsByCurrency = adjustments
        .filter(a => a.type === 'withdrawal')
        .reduce((acc: any, a) => {
            const curr = REGION_TO_CURRENCY[a.currency] || a.currency
            acc[curr] = (acc[curr] || 0) + Number(a.amount)
            return acc
        }, {})

    const openAdjustment = (type: 'withdrawal' | 'initialization', adjustment?: CashflowAdjustment) => {
        setAdjustType(type)
        setAdjustmentToEdit(adjustment || null)
        setIsAdjustModalOpen(true)
    }

    const handleDeleteAdjustment = async (id: string) => {
        if (!confirm("¿Estás seguro de que deseas eliminar este registro? Esto afectará el saldo final.")) return

        try {
            await AdjustmentsService.delete(id)
            setAdjustments(adjustments.filter(a => a.id !== id))
            toast.success("Registro eliminado exitosamente")
            loadData()
        } catch (error: any) {
            console.error(error)
            toast.error("Error al eliminar: " + error.message)
        }
    }

    return (
        <div className="w-full min-w-0 space-y-4 sm:space-y-6 p-3 sm:p-4 max-w-7xl mx-auto overflow-x-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center justify-between gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-3">
                        <Link href="/admin">
                            <Button variant="ghost" size="icon" className="rounded-full shrink-0">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div className="min-w-0">
                            <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-2 truncate">
                                Cuadre de Cuentas
                            </h1>
                            <p className="text-muted-foreground text-[11px] sm:text-sm leading-tight truncate">Resumen de ingresos vs egresos.</p>
                        </div>
                    </div>
                    <Button variant="outline" size="icon" onClick={() => loadData()} disabled={loading} className="rounded-lg h-9 w-9 shrink-0 md:hidden">
                        <Scale className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
                <div className="flex items-center gap-2 self-start md:self-auto w-full md:w-auto mt-1 md:mt-0">
                    <Button variant="outline" size="sm" onClick={() => openAdjustment('initialization')} className="hidden sm:flex items-center gap-2 shrink-0">
                        <TrendingUp className="w-4 h-4 text-green-600" /> Inicializar Saldo
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openAdjustment('withdrawal')} className="hidden sm:flex items-center gap-2 text-destructive border-destructive/20 hover:bg-destructive/10 shrink-0">
                        <TrendingDown className="w-4 h-4" /> Registrar Retiro
                    </Button>
                    <div className="relative flex-1 w-full">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="date"
                            className="h-10 w-full pl-9 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" size="icon" onClick={() => loadData()} disabled={loading} className="hidden md:flex rounded-lg h-10 w-10 shrink-0">
                        <Scale className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            <div className="sm:hidden flex flex-col gap-2">
                <Button variant="outline" size="sm" onClick={() => openAdjustment('initialization')} className="flex items-center justify-center gap-2 h-10">
                    <TrendingUp className="w-4 h-4 text-green-600" /> Inicializar
                </Button>
                <Button variant="outline" size="sm" onClick={() => openAdjustment('withdrawal')} className="flex items-center justify-center gap-2 h-10 text-destructive border-destructive/20">
                    <TrendingDown className="w-4 h-4" /> Retiro
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 w-full min-w-0">
                {Object.keys(CURRENCY_LABELS).filter(k =>
                    incomeByCurrency[k] ||
                    startBalanceByCurrency[k] ||
                    outflowByCurrency[k] ||
                    withdrawalsByCurrency[k] ||
                    k === 'USD' || k === 'VES' || k === 'COP' || k === 'CLP' || k === 'PEN'
                ).map(curr => (
                    <Card key={curr} className="overflow-hidden border-none shadow-md ring-1 ring-black/5 min-w-0">
                        <CardHeader className="pb-2 bg-muted/30">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between min-w-0">
                                <span className="flex items-center gap-2 truncate">
                                    <Scale className="w-3 h-3 text-primary shrink-0" /> <span className="truncate">Totales {curr}</span>
                                </span>
                                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full shrink-0">DÍA</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-2.5">
                            <div className="flex items-center justify-between gap-2 text-xs min-w-0 w-full">
                                <span className="text-muted-foreground shrink-0">Saldo Inicial (+)</span>
                                <span className="font-medium text-right truncate min-w-0">{formatCurrency(startBalanceByCurrency[curr] || 0)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-xs min-w-0 w-full">
                                <span className="text-muted-foreground flex items-center gap-1.5 shrink-0"><TrendingUp className="w-3 h-3 text-green-500" /> Ingresos (+)</span>
                                <span className="font-medium text-green-600 text-right truncate min-w-0">
                                    {formatCurrency(summaryByCurrency[curr] || 0)}
                                </span>
                            </div>
                            <div 
                                className="flex items-center justify-between gap-2 text-xs min-w-0 w-full cursor-pointer hover:bg-muted/50 p-1 -mx-1 rounded transition-colors"
                                onClick={() => setReconciliationCurrency(curr)}
                            >
                                <span className="text-muted-foreground flex items-center gap-1.5 shrink-0"><TrendingDown className="w-3 h-3 text-primary" /> Ops / Ventas (-)</span>
                                <span className="font-medium text-primary text-right truncate min-w-0">{formatCurrency(outflowByCurrency[curr] || 0)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-xs min-w-0 w-full">
                                <span className="text-muted-foreground flex items-center gap-1.5 shrink-0"><TrendingDown className="w-3 h-3 text-destructive" /> Retiros (-)</span>
                                <span className="font-medium text-destructive text-right truncate min-w-0">{formatCurrency(withdrawalsByCurrency[curr] || 0)}</span>
                            </div>

                            <div className="pt-3 border-t mt-3 min-w-0">
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Saldo Final</span>
                                    <div className="text-xl sm:text-2xl font-black font-mono break-all mt-0.5">
                                        {formatCurrency(
                                            (startBalanceByCurrency[curr] || 0) +
                                            (summaryByCurrency[curr] || 0) -
                                            (outflowByCurrency[curr] || 0) -
                                            (withdrawalsByCurrency[curr] || 0)
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {Object.keys(summaryByCurrency).length === 0 && (
                    <Card className="md:col-span-2 lg:col-span-4 p-8 text-center text-muted-foreground bg-muted/20 border-dashed">
                        No hay movimientos registrados para esta fecha.
                    </Card>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* Income by Bank Table */}
                <Card className="shadow-lg border-none overflow-hidden min-w-0">
                    <CardHeader className="border-b">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Wallet className="w-5 h-5 text-green-600" /> Ingresos por Banco
                        </CardTitle>
                        <CardDescription>Depósitos manuales registrados como recibidos.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {/* Desktop table */}
                        <div className="hidden sm:block overflow-x-auto max-w-full">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-muted/50 text-muted-foreground font-medium">
                                        <th className="p-4 text-left whitespace-nowrap">Banco / Cuenta</th>
                                        <th className="p-4 text-right whitespace-nowrap">Monto Recaudado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {balances.length === 0 ? (
                                        <tr><td colSpan={2} className="p-8 text-center text-muted-foreground italic">Sin depósitos registrados</td></tr>
                                    ) : balances.map((b, i) => (
                                        <tr key={i} className="hover:bg-muted/20">
                                            <td className="p-4 whitespace-nowrap">
                                                <div className="font-bold">{b.bank}</div>
                                                <div className="text-[10px] text-muted-foreground uppercase">{b.currency}</div>
                                            </td>
                                            <td className="p-4 text-right font-mono font-bold text-green-600 whitespace-nowrap">
                                                {formatCurrency(b.income)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* Mobile list */}
                        <div className="sm:hidden divide-y">
                            {balances.length === 0 ? (
                                <div className="p-6 text-center text-muted-foreground text-sm italic">Sin depósitos registrados</div>
                            ) : balances.map((b, i) => (
                                <div key={i} className="p-4 flex items-center justify-between gap-3 text-sm">
                                    <div className="min-w-0">
                                        <div className="font-bold truncate">{b.bank}</div>
                                        <div className="text-[10px] text-muted-foreground uppercase">{b.currency}</div>
                                    </div>
                                    <div className="font-mono font-bold text-green-600 text-right shrink-0">
                                        {formatCurrency(b.income)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Outflow / Ops Summary */}
                <Card className="shadow-lg border-none overflow-hidden min-w-0">
                    <CardHeader className="border-b">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <TrendingDown className="w-5 h-5 text-primary" /> Egresos / Ventas
                        </CardTitle>
                        <CardDescription>Total pagado a beneficiarios (salidas reales).</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {/* Desktop table */}
                        <div className="hidden sm:block overflow-x-auto max-w-full">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-muted/50 text-muted-foreground font-medium">
                                        <th className="p-4 text-left whitespace-nowrap">Moneda</th>
                                        <th className="p-4 text-center whitespace-nowrap">Cantidad</th>
                                        <th className="p-4 text-right whitespace-nowrap">Monto Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {Object.keys(outflowByCurrency).length === 0 ? (
                                        <tr><td colSpan={3} className="p-8 text-center text-muted-foreground italic">Sin operaciones para esta fecha</td></tr>
                                    ) : Object.keys(outflowByCurrency).map(curr => (
                                        <tr key={curr} className="hover:bg-muted/20 cursor-pointer" onClick={() => setReconciliationCurrency(curr)}>
                                            <td className="p-4 whitespace-nowrap">
                                                <div className="font-bold">{CURRENCY_LABELS[curr] || curr}</div>
                                            </td>
                                            <td className="p-4 text-center text-muted-foreground whitespace-nowrap">
                                                {transactions.filter(tx => (REGION_TO_CURRENCY[tx.currency_received] || tx.currency_received) === curr && (tx.status === 'verified' || tx.status === 'completed') && tx.beneficiary_data?.type !== 'cash').length} ops
                                            </td>
                                            <td className="p-4 text-right font-mono font-bold text-primary whitespace-nowrap">
                                                {formatCurrency(outflowByCurrency[curr])}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* Mobile list */}
                        <div className="sm:hidden divide-y">
                            {Object.keys(outflowByCurrency).length === 0 ? (
                                <div className="p-6 text-center text-muted-foreground text-sm italic">Sin operaciones para esta fecha</div>
                            ) : Object.keys(outflowByCurrency).map(curr => (
                                <div key={curr} className="p-4 flex items-center justify-between gap-3 text-sm cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => setReconciliationCurrency(curr)}>
                                    <div className="min-w-0">
                                        <div className="font-bold truncate">{CURRENCY_LABELS[curr] || curr}</div>
                                        <div className="text-[10px] text-muted-foreground">
                                            {transactions.filter(tx => (REGION_TO_CURRENCY[tx.currency_received] || tx.currency_received) === curr && (tx.status === 'verified' || tx.status === 'completed') && tx.beneficiary_data?.type !== 'cash').length} ops
                                        </div>
                                    </div>
                                    <div className="font-mono font-bold text-primary text-right shrink-0">
                                        {formatCurrency(outflowByCurrency[curr])}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                    <div className="p-4 bg-primary/5 text-[11px] text-primary border-t">
                        <strong>Nota:</strong> Este cuadro muestra lo que hemos **pagado** a beneficiarios.
                    </div>
                </Card>
            </div>

            {/* Recent Adjustments Table */}
            {adjustments.length > 0 && (
                <Card className="shadow-lg border-none mt-6 overflow-hidden min-w-0">
                    <CardHeader className="border-b">
                        <CardTitle className="text-lg flex items-center gap-2">
                            Ajustes y Retiros Recientes
                        </CardTitle>
                        <CardDescription>Detalle de inicialización de saldos y salidas manuales.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {/* Desktop table */}
                        <div className="hidden sm:block overflow-x-auto max-w-full">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-muted/50 text-muted-foreground font-medium">
                                        <th className="p-4 text-left whitespace-nowrap">Fecha/Hora</th>
                                        <th className="p-4 text-left whitespace-nowrap">Tipo</th>
                                        <th className="p-4 text-left whitespace-nowrap">Descripción</th>
                                        <th className="p-4 text-right whitespace-nowrap">Monto</th>
                                        <th className="p-4 text-right whitespace-nowrap">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-xs">
                                    {adjustments.map((adj) => (
                                        <tr key={adj.id} className="hover:bg-muted/20">
                                            <td className="p-4 text-muted-foreground whitespace-nowrap">{new Date(adj.created_at!).toLocaleTimeString()}</td>
                                            <td className="p-4 whitespace-nowrap">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${adj.type === 'initialization' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {adj.type === 'initialization' ? 'Inicialización' : 'Retiro'}
                                                </span>
                                            </td>
                                            <td className="p-4 italic text-muted-foreground whitespace-nowrap">{adj.description || '-'}</td>
                                            <td className={`p-4 text-right font-bold whitespace-nowrap ${adj.type === 'initialization' ? 'text-green-600' : 'text-destructive'}`}>
                                                {adj.type === 'initialization' ? '+' : '-'} {formatCurrency(adj.amount)} {adj.currency}
                                            </td>
                                            <td className="p-4 text-right whitespace-nowrap">
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => openAdjustment(adj.type, adj)}><Edit className="w-3.5 h-3.5" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => adj.id && handleDeleteAdjustment(adj.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* Mobile cards */}
                        <div className="sm:hidden divide-y">
                            {adjustments.map((adj) => (
                                <div key={adj.id} className="p-4 flex items-start justify-between gap-3">
                                    <div className="min-w-0 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold shrink-0 ${adj.type === 'initialization' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {adj.type === 'initialization' ? 'Inicialización' : 'Retiro'}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground truncate">{new Date(adj.created_at!).toLocaleTimeString()}</span>
                                        </div>
                                        <div className={`font-black text-base truncate ${adj.type === 'initialization' ? 'text-green-600' : 'text-destructive'}`}>
                                            {adj.type === 'initialization' ? '+' : '-'} {formatCurrency(adj.amount)} {adj.currency}
                                        </div>
                                        {adj.description && <div className="text-xs italic text-muted-foreground truncate">{adj.description}</div>}
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => openAdjustment(adj.type, adj)}><Edit className="w-3.5 h-3.5" /></Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => adj.id && handleDeleteAdjustment(adj.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            <AdjustmentDialog
                isOpen={isAdjustModalOpen}
                onClose={() => { setIsAdjustModalOpen(false); setAdjustmentToEdit(null); }}
                type={adjustType}
                onSuccess={() => loadData()}
                adjustmentToEdit={adjustmentToEdit}
            />

            {/* Modal de Reconciliación */}
            {reconciliationCurrency && (() => {
                const currencyTransactions = transactions.filter(tx => 
                    (tx.status === 'verified' || tx.status === 'completed') && 
                    tx.beneficiary_data?.type !== 'cash' && 
                    (REGION_TO_CURRENCY[tx.currency_received] || tx.currency_received) === reconciliationCurrency
                )
                const crossedCount = currencyTransactions.filter(tx => crossedOutTxs.has(tx.id!)).length
                const totalCount = currencyTransactions.length
                const percentChecked = totalCount > 0 ? Math.round((crossedCount / totalCount) * 100) : 0

                const filteredList = currencyTransactions.filter(tx => {
                    if (!reconciliationSearch) return true
                    const searchLower = reconciliationSearch.toLowerCase()
                    const amountStr = tx.amount_received.toString()
                    const formattedAmountStr = formatCurrency(tx.amount_received).toLowerCase()
                    const bankStr = (tx.beneficiary_data?.bank_name || '').toLowerCase()
                    const accountStr = (tx.beneficiary_data?.account_number || tx.beneficiary_data?.phone_number || '').toLowerCase()
                    const nameStr = (tx.beneficiary_data?.name || tx.beneficiary_data?.full_name || '').toLowerCase()
                    const docStr = (tx.beneficiary_data?.doc_id || '').toLowerCase()

                    return amountStr.includes(searchLower) || 
                           formattedAmountStr.includes(searchLower) ||
                           bankStr.includes(searchLower) || 
                           accountStr.includes(searchLower) ||
                           nameStr.includes(searchLower) ||
                           docStr.includes(searchLower)
                })

                return (
                    <div 
                        className="fixed inset-0 bg-black/60 flex items-center justify-center p-3 sm:p-4 z-50 backdrop-blur-sm animate-in fade-in duration-200"
                        onDragOver={(e) => {
                            e.preventDefault()
                            setIsDraggingFile(true)
                        }}
                        onDragLeave={(e) => {
                            e.preventDefault()
                            setIsDraggingFile(false)
                        }}
                        onDrop={(e) => {
                            e.preventDefault()
                            setIsDraggingFile(false)
                            const files = e.dataTransfer.files
                            if (files && files.length > 0) {
                                processBankPdfFiles(files)
                            }
                        }}
                    >
                        <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border-none relative overflow-hidden">
                            {/* Drag & Drop Overlay */}
                            {isDraggingFile && (
                                <div className="absolute inset-0 z-50 bg-primary/90 text-primary-foreground flex flex-col items-center justify-center gap-3 backdrop-blur-sm p-6 text-center animate-in fade-in">
                                    <FileUp className="w-12 h-12 animate-bounce" />
                                    <div className="text-xl font-bold">Suelta aquí el PDF del banco</div>
                                    <p className="text-sm opacity-90">Se leerán los movimientos y se tacharán las transferencias automáticamente.</p>
                                </div>
                            )}

                            <CardHeader className="border-b relative shrink-0 pb-3">
                                <div className="flex items-start justify-between gap-3 pr-8">
                                    <div>
                                        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl flex-wrap">
                                            <TrendingDown className="w-5 h-5 text-primary" /> 
                                            <span>Operaciones en {CURRENCY_LABELS[reconciliationCurrency as keyof typeof CURRENCY_LABELS] || reconciliationCurrency}</span>
                                            <Badge variant={crossedCount === totalCount && totalCount > 0 ? "success" : "secondary"} className="font-mono text-xs">
                                                {crossedCount} / {totalCount} ({percentChecked}%)
                                            </Badge>
                                        </CardTitle>
                                        <CardDescription className="text-xs mt-1">
                                            Verifica las transferencias contra tu banco. Marca manualmente o sube el PDF del banco para tachado automático.
                                        </CardDescription>
                                    </div>
                                </div>

                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => { setReconciliationCurrency(null); setReconciliationSearch(""); setPdfResults([]); }} 
                                    className="absolute right-3 top-3 rounded-full h-8 w-8" 
                                    type="button"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                                
                                <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input 
                                            placeholder="Buscar por monto, banco o cuenta..." 
                                            className="pl-9 pr-8 h-9 text-xs sm:text-sm"
                                            value={reconciliationSearch}
                                            onChange={(e) => setReconciliationSearch(e.target.value)}
                                        />
                                        {reconciliationSearch && (
                                            <button 
                                                type="button" 
                                                onClick={() => setReconciliationSearch("")} 
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            accept="application/pdf" 
                                            multiple
                                            className="hidden" 
                                            onChange={handlePdfUpload} 
                                        />
                                        <Button 
                                            variant="default" 
                                            size="sm" 
                                            onClick={() => fileInputRef.current?.click()} 
                                            disabled={isUploadingPdf}
                                            className="h-9 px-3 text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-sm"
                                        >
                                            {isUploadingPdf ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span>Leyendo PDF...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <FileUp className="w-4 h-4" />
                                                    <span>Cargar PDF Banco</span>
                                                </>
                                            )}
                                        </Button>

                                        {crossedCount > 0 && (
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={handleClearMarks}
                                                disabled={isUploadingPdf}
                                                className="h-9 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                title="Desmarcar todas las transferencias"
                                            >
                                                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                                <span className="hidden sm:inline">Desmarcar</span>
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>

                            {/* Banner con resultados de PDFs cargados y transferencias sobrantes */}
                            {pdfResults.length > 0 && (() => {
                                const totalMatched = pdfResults.reduce((s, r) => s + r.matchedCount, 0)
                                const allUnmatched = pdfResults.flatMap(r => r.unmatchedBankItems)

                                // Agrupar sobrantes por monto para mostrar cantidades (ej. 0,30 x3)
                                const groupedUnmatched: Record<string, { amount: number; count: number; filenames: Set<string> }> = {}
                                for (const item of allUnmatched) {
                                    const key = item.amount.toFixed(2)
                                    if (!groupedUnmatched[key]) {
                                        groupedUnmatched[key] = { amount: item.amount, count: 0, filenames: new Set() }
                                    }
                                    groupedUnmatched[key].count++
                                    groupedUnmatched[key].filenames.add(item.filename)
                                }
                                const groupedList = Object.values(groupedUnmatched).sort((a, b) => b.amount - a.amount)

                                return (
                                    <div className="p-3 bg-muted/40 border-b text-xs space-y-2.5 animate-in fade-in">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-start gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                                                <div className="space-y-1">
                                                    <div className="font-semibold text-foreground">
                                                        {pdfResults.length === 1 ? '1 archivo procesado' : `${pdfResults.length} archivos bancarios procesados`}: <strong className="text-green-700 dark:text-green-400">{totalMatched} transferencias tachadas</strong> en total.
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                                                        {pdfResults.map((r, i) => (
                                                            <span key={i} className="inline-flex items-center gap-1">
                                                                <span className="font-mono font-medium text-foreground">{r.filename}</span>: 
                                                                <span>{r.totalFound} movs ({r.matchedCount} tachados{r.unmatchedBankItems.length > 0 ? `, ${r.unmatchedBankItems.length} sobran` : ''})</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-6 w-6 rounded-full shrink-0 -mr-1 -mt-1 text-muted-foreground hover:text-foreground" 
                                                onClick={() => setPdfResults([])}
                                                title="Cerrar resumen"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>

                                        {allUnmatched.length > 0 && (
                                            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold text-xs">
                                                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                                        <span>
                                                            Transferencias sobrantes en el PDF ({allUnmatched.length}):
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowUnmatchedDetails(!showUnmatchedDetails)}
                                                        className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
                                                    >
                                                        {showUnmatchedDetails ? 'Ocultar' : 'Ver detalle'}
                                                        {showUnmatchedDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                    </button>
                                                </div>

                                                <p className="text-muted-foreground text-[11px] leading-relaxed">
                                                    Salieron del banco en los PDFs, pero <strong>no tienen ninguna operación pendiente en el sistema</strong> (o exceden las registradas):
                                                </p>

                                                {showUnmatchedDetails && (
                                                    <div className="flex flex-wrap gap-1.5 pt-1 max-h-36 overflow-y-auto">
                                                        {groupedList.map((item, idx) => (
                                                            <div 
                                                                key={idx} 
                                                                className="px-2 py-1 rounded bg-background/90 border border-amber-300 dark:border-amber-800 flex items-center gap-1.5 text-[11px] shadow-2xs"
                                                                title={`Archivos: ${Array.from(item.filenames).join(', ')}`}
                                                            >
                                                                <span className="font-mono font-bold text-amber-950 dark:text-amber-100">
                                                                    {formatCurrency(item.amount)}
                                                                </span>
                                                                {item.count > 1 && (
                                                                    <span className="text-[10px] px-1 rounded bg-amber-200/80 dark:bg-amber-800/80 font-bold text-amber-900 dark:text-amber-200">
                                                                        x{item.count}
                                                                    </span>
                                                                )}
                                                                <span className="text-[9px] text-muted-foreground uppercase truncate max-w-[90px]">
                                                                    {Array.from(item.filenames)[0].split('.')[0]}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {allUnmatched.length === 0 && totalMatched > 0 && (
                                            <div className="pt-1.5 border-t border-border/50 flex items-center gap-1.5 text-green-700 dark:text-green-400 font-medium text-xs">
                                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                                <span>¡Todos los movimientos del banco coinciden exactamente con operaciones del sistema!</span>
                                            </div>
                                        )}
                                    </div>
                                )
                            })()}

                            <CardContent className="flex-1 overflow-y-auto p-0">
                                <div className="divide-y">
                                    {filteredList.map(tx => {
                                        const isCrossed = crossedOutTxs.has(tx.id!)
                                        return (
                                            <div 
                                                key={tx.id} 
                                                className={`p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-muted/10 transition-colors ${isCrossed ? 'opacity-50 grayscale bg-muted/5' : ''}`}
                                            >
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    <Checkbox 
                                                        checked={isCrossed} 
                                                        onCheckedChange={() => {
                                                            const newSet = new Set(crossedOutTxs)
                                                            if (isCrossed) newSet.delete(tx.id!)
                                                            else newSet.add(tx.id!)
                                                            updateCrossedOut(newSet)
                                                        }}
                                                    />
                                                    <div className={`min-w-0 ${isCrossed ? 'line-through' : ''}`}>
                                                        <div className="font-bold text-sm truncate">
                                                            {tx.beneficiary_data?.bank_name || 'Banco'} - {tx.beneficiary_data?.account_number || tx.beneficiary_data?.phone_number || 'N/A'}
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground truncate">
                                                            {tx.beneficiary_data?.name || tx.beneficiary_data?.full_name} {tx.beneficiary_data?.doc_id ? `(${tx.beneficiary_data.doc_id})` : ''}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className={`font-mono font-bold text-right shrink-0 ${isCrossed ? 'line-through text-muted-foreground' : 'text-primary'}`}>
                                                    {formatCurrency(tx.amount_received)}
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {currencyTransactions.length === 0 && (
                                        <div className="p-8 text-center text-muted-foreground text-sm">
                                            No hay operaciones registradas en esta moneda para la fecha seleccionada.
                                        </div>
                                    )}
                                    {currencyTransactions.length > 0 && filteredList.length === 0 && (
                                        <div className="p-8 text-center text-muted-foreground text-sm">
                                            No se encontraron transferencias que coincidan con la búsqueda.
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )
            })()}
        </div>
    )
}
