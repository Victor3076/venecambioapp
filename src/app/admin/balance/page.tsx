"use client"

import { useState, useEffect } from "react"
import { TransactionsService, Transaction } from "@/services/transactions"
import { BankDepositsService, BankDeposit } from "@/services/bank-deposits"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Scale, Landmark, TrendingUp, TrendingDown, Wallet, Calendar } from "lucide-react"
import Link from "next/link"
import { CURRENCY_LABELS } from "@/lib/constants"
import { formatCurrency } from "@/lib/rates-utils"

import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function AdminBalancePage() {
    const router = useRouter()
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [deposits, setDeposits] = useState<BankDeposit[]>([])
    const [loading, setLoading] = useState(true)
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])

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
    }, [filterDate])

    const loadData = async () => {
        setLoading(true)
        try {
            // In a real app we might want to filter server-side
            const [txs, deps] = await Promise.all([
                TransactionsService.getAll(),
                BankDepositsService.getAll()
            ])

            // Filter by date
            const filteredTxs = (txs as Transaction[]).filter(tx => tx.created_at?.startsWith(filterDate))
            const filteredDeps = (deps as BankDeposit[]).filter(d => d.created_at?.startsWith(filterDate))

            setTransactions(filteredTxs)
            setDeposits(filteredDeps)
        } catch (error) {
            console.error("Error loading balance data:", error)
        } finally {
            setLoading(false)
        }
    }

    // Process data to group by bank and currency
    const processBalance = () => {
        const balanceMap: Record<string, { income: number, outflow: number, currency: string, bank: string }> = {}

        // Income from deposits (by bank/currency)
        deposits.forEach(dep => {
            const key = `${dep.bank_name || 'OTROS'}_${dep.currency}`
            if (!balanceMap[key]) {
                balanceMap[key] = { income: 0, outflow: 0, currency: dep.currency, bank: dep.bank_name || 'OTROS' }
            }
            balanceMap[key].income += Number(dep.amount)
        })

        // Outflow from transactions (only verified/completed)
        // Note: For Cuadre we look at 'amount_sent' which is what the user paid (income) 
        // OR 'amount_received' which is what we sent?
        // Usually "Cuadre" means: How much did I receive vs how much I have in deposits (matching).
        // AND how much did I pay out.

        // Let's stick to the user's request: "Cuadre de cuentas".
        // Income = Deposits received.
        // Outflow = Transactions sent (received_amount in VES/other).

        // However, usually we balance SOURCE accounts separately from TARGET accounts.
        // Source Accounts (where we receive PEN, CLP, etc.): Deposits should match Transactions (amount_sent).
        // Target Accounts (where we send VES): Total amount_received.

        return Object.values(balanceMap)
    }

    const balances = processBalance()

    // Group by currency for summary cards
    const summaryByCurrency = deposits.reduce((acc: any, dep) => {
        acc[dep.currency] = (acc[dep.currency] || 0) + Number(dep.amount)
        return acc
    }, {})

    const outflowByCurrency = transactions
        .filter(tx => tx.status === 'verified' || tx.status === 'completed')
        .reduce((acc: any, tx) => {
            acc[tx.currency_sent] = (acc[tx.currency_sent] || 0) + Number(tx.amount_sent)
            return acc
        }, {})

    return (
        <div className="space-y-6 p-2 sm:p-4 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/admin">
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                            Cuadre de Cuentas
                        </h1>
                        <p className="text-muted-foreground text-sm">Resumen de ingresos vs egresos del día.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 self-end md:self-auto">
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="date"
                            className="h-10 pl-9 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" size="icon" onClick={() => loadData()} disabled={loading} className="rounded-lg">
                        <Scale className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Summary Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Object.keys(summaryByCurrency).map(curr => (
                    <Card key={curr} className="overflow-hidden border-none shadow-md ring-1 ring-black/5">
                        <CardHeader className="pb-2 bg-muted/30">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <TrendingUp className="w-3 h-3 text-green-500" /> Totales {curr}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="text-xl font-bold">{formatCurrency(summaryByCurrency[curr])}</div>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t text-[10px]">
                                <span className="text-muted-foreground">Ocupado en Ops:</span>
                                <span className="font-bold text-primary">{formatCurrency(outflowByCurrency[curr] || 0)}</span>
                            </div>
                            <div className="flex items-center justify-between mt-1 text-[10px]">
                                <span className="text-muted-foreground">Diferencia:</span>
                                <span className={`font-bold ${summaryByCurrency[curr] - (outflowByCurrency[curr] || 0) < 0 ? 'text-destructive' : 'text-green-600'}`}>
                                    {formatCurrency(summaryByCurrency[curr] - (outflowByCurrency[curr] || 0))}
                                </span>
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

            <div className="grid md:grid-cols-2 gap-6">
                {/* Income by Bank Table */}
                <Card className="shadow-lg border-none">
                    <CardHeader className="border-b">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Wallet className="w-5 h-5 text-green-600" /> Ingresos por Banco (Depósitos)
                        </CardTitle>
                        <CardDescription>Depósitos manuales registrados como recibidos.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
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
                                    <tr key={i} className="hover:bg-muted/20 group">
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
                    </CardContent>
                </Card>

                {/* Outflow / Ops Summary */}
                <Card className="shadow-lg border-none">
                    <CardHeader className="border-b">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <TrendingDown className="w-5 h-5 text-primary" /> Egresos / Operaciones (Venta)
                        </CardTitle>
                        <CardDescription>Total que el cliente envió (debería coincidir con ingresos).</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
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
                                            {transactions.filter(tx => tx.currency_sent === curr).length} ops
                                        </td>
                                        <td className="p-4 text-right font-mono font-bold text-primary">
                                            {formatCurrency(outflowByCurrency[curr])}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                    <div className="p-4 bg-primary/5 text-[11px] text-primary border-t">
                        <strong>Nota:</strong> Este cuadro compara lo que ingresó físicamente al banco (Depósitos) vs lo que los clientes registraron en sus órdenes.
                    </div>
                </Card>
            </div>

            {/* Global Summary for VES (Payment side) */}
            <Card className="shadow-lg border-none bg-indigo-600 text-white overflow-hidden">
                <div className="p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                            <Landmark className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">Total a Pagar (Egresos VES)</h3>
                            <p className="text-indigo-100 text-sm">Monto total que sale de nuestras cuentas de Venezuela.</p>
                        </div>
                    </div>
                    <div className="text-4xl font-black font-mono">
                        {formatCurrency(transactions
                            .filter(tx => tx.status === 'verified' || tx.status === 'completed')
                            .filter(tx => tx.currency_received === 'VES')
                            .reduce((acc, tx) => acc + Number(tx.amount_received), 0)
                        )} <span className="text-lg font-normal">VES</span>
                    </div>
                </div>
            </Card>
        </div>
    )
}
