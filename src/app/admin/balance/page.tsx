"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { TransactionsService, Transaction } from "@/services/transactions"
import { BankDepositsService, BankDeposit } from "@/services/bank-deposits"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Scale, Landmark, TrendingUp, TrendingDown, Wallet, Calendar, Trash2, Edit } from "lucide-react"
import Link from "next/link"
import { CURRENCY_LABELS } from "@/lib/constants"
import { formatCurrency } from "@/lib/rates-utils"

import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { AdjustmentsService, CashflowAdjustment } from "@/services/adjustments"
import { AdjustmentDialog } from "@/components/admin/adjustment-dialog"

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
        <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 max-w-7xl mx-auto overflow-x-hidden">
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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Object.keys(CURRENCY_LABELS).filter(k =>
                    incomeByCurrency[k] ||
                    startBalanceByCurrency[k] ||
                    outflowByCurrency[k] ||
                    withdrawalsByCurrency[k] ||
                    k === 'USD' || k === 'VES' || k === 'COP' || k === 'CLP' || k === 'PEN'
                ).map(curr => (
                    <Card key={curr} className="overflow-hidden border-none shadow-md ring-1 ring-black/5">
                        <CardHeader className="pb-2 bg-muted/30">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <Scale className="w-3 h-3 text-primary" /> Totales {curr}
                                </span>
                                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">DÍA</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-2.5">
                            <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="text-muted-foreground shrink-0">Saldo Inicial (+)</span>
                                <span className="font-medium text-right truncate">{formatCurrency(startBalanceByCurrency[curr] || 0)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="text-muted-foreground flex items-center gap-1.5 shrink-0"><TrendingUp className="w-3 h-3 text-green-500" /> Ingresos (+)</span>
                                <span className="font-medium text-green-600 text-right truncate">
                                    {formatCurrency(summaryByCurrency[curr] || 0)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="text-muted-foreground flex items-center gap-1.5 shrink-0"><TrendingDown className="w-3 h-3 text-primary" /> Ops / Ventas (-)</span>
                                <span className="font-medium text-primary text-right truncate">{formatCurrency(outflowByCurrency[curr] || 0)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="text-muted-foreground flex items-center gap-1.5 shrink-0"><TrendingDown className="w-3 h-3 text-destructive" /> Retiros (-)</span>
                                <span className="font-medium text-destructive text-right truncate">{formatCurrency(withdrawalsByCurrency[curr] || 0)}</span>
                            </div>

                            <div className="pt-3 border-t mt-3">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Saldo Final</span>
                                    <div className="text-2xl font-black font-mono break-words mt-0.5">
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
                <Card className="shadow-lg border-none">
                    <CardHeader className="border-b">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Wallet className="w-5 h-5 text-green-600" /> Ingresos por Banco (Depósitos)
                        </CardTitle>
                        <CardDescription>Depósitos manuales registrados como recibidos.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-muted/50 text-muted-foreground font-medium">
                                        <th className="p-4 text-left">Banco / Cuenta</th>
                                        <th className="p-4 text-right">Monto Recaudado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {balances.length === 0 ? (
                                        <tr><td colSpan={2} className="p-8 text-center text-muted-foreground italic">Sin depósitos registrados</td></tr>
                                    ) : balances.map((b, i) => (
                                        <tr key={i} className="hover:bg-muted/20">
                                            <td className="p-4">
                                                <div className="font-bold">{b.bank}</div>
                                                <div className="text-[10px] text-muted-foreground uppercase">{b.currency}</div>
                                            </td>
                                            <td className="p-4 text-right font-mono font-bold text-green-600">
                                                {formatCurrency(b.income)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* Outflow / Ops Summary */}
                <Card className="shadow-lg border-none">
                    <CardHeader className="border-b">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <TrendingDown className="w-5 h-5 text-primary" /> Egresos / Operaciones (Venta)
                        </CardTitle>
                        <CardDescription>Total pagado a beneficiarios (salidas reales).</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-muted/50 text-muted-foreground font-medium">
                                        <th className="p-4 text-left">Moneda</th>
                                        <th className="p-4 text-center">Cantidad</th>
                                        <th className="p-4 text-right">Monto Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {Object.keys(outflowByCurrency).length === 0 ? (
                                        <tr><td colSpan={3} className="p-8 text-center text-muted-foreground italic">Sin operaciones para esta fecha</td></tr>
                                    ) : Object.keys(outflowByCurrency).map(curr => (
                                        <tr key={curr} className="hover:bg-muted/20">
                                            <td className="p-4">
                                                <div className="font-bold">{CURRENCY_LABELS[curr] || curr}</div>
                                            </td>
                                            <td className="p-4 text-center text-muted-foreground">
                                                {transactions.filter(tx => (REGION_TO_CURRENCY[tx.currency_received] || tx.currency_received) === curr).length} ops
                                            </td>
                                            <td className="p-4 text-right font-mono font-bold text-primary">
                                                {formatCurrency(outflowByCurrency[curr])}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                    <div className="p-4 bg-primary/5 text-[11px] text-primary border-t">
                        <strong>Nota:</strong> Este cuadro muestra lo que hemos **pagado** a beneficiarios.
                    </div>
                </Card>
            </div>

            {/* Recent Adjustments Table */}
            {adjustments.length > 0 && (
                <Card className="shadow-lg border-none mt-6">
                    <CardHeader className="border-b">
                        <CardTitle className="text-lg flex items-center gap-2">
                            Ajustes y Retiros Recientes
                        </CardTitle>
                        <CardDescription>Detalle de inicialización de saldos y salidas manuales.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {/* Desktop table */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-muted/50 text-muted-foreground font-medium">
                                        <th className="p-4 text-left">Fecha/Hora</th>
                                        <th className="p-4 text-left">Tipo</th>
                                        <th className="p-4 text-left">Descripción</th>
                                        <th className="p-4 text-right">Monto</th>
                                        <th className="p-4 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-xs">
                                    {adjustments.map((adj) => (
                                        <tr key={adj.id} className="hover:bg-muted/20">
                                            <td className="p-4 text-muted-foreground">{new Date(adj.created_at!).toLocaleTimeString()}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${adj.type === 'initialization' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {adj.type === 'initialization' ? 'Inicialización' : 'Retiro'}
                                                </span>
                                            </td>
                                            <td className="p-4 italic text-muted-foreground">{adj.description || '-'}</td>
                                            <td className={`p-4 text-right font-bold ${adj.type === 'initialization' ? 'text-green-600' : 'text-destructive'}`}>
                                                {adj.type === 'initialization' ? '+' : '-'} {formatCurrency(adj.amount)} {adj.currency}
                                            </td>
                                            <td className="p-4 text-right">
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
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${adj.type === 'initialization' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {adj.type === 'initialization' ? 'Inicialización' : 'Retiro'}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">{new Date(adj.created_at!).toLocaleTimeString()}</span>
                                        </div>
                                        <div className={`font-black text-base ${adj.type === 'initialization' ? 'text-green-600' : 'text-destructive'}`}>
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
        </div>
    )
}
