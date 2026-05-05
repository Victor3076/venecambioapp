"use client"

import { useState, useEffect } from "react"
import { TransactionsService, Transaction } from "@/services/transactions"
import { RatesService } from "@/services/rates"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, TrendingUp, DollarSign, PieChart, Landmark } from "lucide-react"
import Link from "next/link"
import { CURRENCY_LABELS } from "@/lib/constants"
const REGION_TO_ISO: Record<string, string> = {
    'PERU': 'PEN',
    'CHILE': 'CLP',
    'COLOMBIA': 'COP',
    'USA': 'USD',
    'VENEZUELA': 'VES'
}

export default function AdminProfitsPage() {
    const today = new Date().toISOString().split('T')[0];
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [stats, setStats] = useState<any>({ totalProfit: 0, volumeByCurrency: {}, profitByCurrency: {}, marginSumByCurrency: {} })

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            const [data, latestRates] = await Promise.all([
                TransactionsService.getAll({ startDate, endDate }),
                RatesService.getLatest()
            ])

            // Filter by date range if selected (additional client-side safety)
            let rawTxs = data as Transaction[]
            if (startDate || endDate) {
                rawTxs = rawTxs.filter(tx => {
                    if (!tx.created_at) return false
                    const txDate = tx.created_at.split('T')[0]
                    if (startDate && txDate < startDate) return false
                    if (endDate && txDate > endDate) return false
                    return true
                })
            }

            // Only consider 'completed' transactions for real profit
            const completed = rawTxs.filter(tx => tx.status === 'completed')

            const summary = completed.reduce((acc: any, tx) => {
                // STANDARDIZE CURRENCY
                const rawCurrency = tx.currency_sent
                const currency = REGION_TO_ISO[rawCurrency] || rawCurrency

                let profit = tx.profit_amount || 0
                const volume = tx.amount_sent || 0
                let margin = tx.profit_percentage || 0

                // SMART FALLBACK: Si no hay ganancia guardada (operaciones antiguas), 
                // estimamos usando las tasas actuales para no mostrar 0.
                if (profit === 0 && volume > 0 && latestRates) {
                    const fallbackMargin = latestRates.margins[`${currency}_VES`] || latestRates.margins["GENERIC"] || 5
                    const fallbackPrice = latestRates.usdt_prices[currency as keyof typeof latestRates.usdt_prices] || 1
                    margin = fallbackMargin
                    profit = ((volume * margin) / 100) / fallbackPrice
                }

                acc.totalProfit += profit
                acc.volumeByCurrency[currency] = (acc.volumeByCurrency[currency] || 0) + volume
                acc.profitByCurrency[currency] = (acc.profitByCurrency[currency] || 0) + profit
                acc.marginSumByCurrency[currency] = (acc.marginSumByCurrency[currency] || 0) + (margin * volume)

                return acc
            }, { totalProfit: 0, volumeByCurrency: {}, profitByCurrency: {}, marginSumByCurrency: {} })

            setTransactions(completed)
            setStats(summary)
        } catch (error) {
            console.error("Error loading profits:", error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6 p-4 sm:p-8 max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/admin">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold">Manejo de Ganancias</h1>
                        <p className="text-muted-foreground">Resumen de volumen y margen generado por moneda.</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase text-[10px]">Desde:</span>
                        <input
                            type="date"
                            className="h-10 rounded-md border border-input bg-background px-2 py-1 text-xs"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase text-[10px]">Hasta:</span>
                        <input
                            type="date"
                            className="h-10 rounded-md border border-input bg-background px-2 py-1 text-xs"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setStartDate("")
                            setEndDate("")
                        }}
                        disabled={!startDate && !endDate}
                    >
                        Limpiar
                    </Button>
                    <Button size="sm" onClick={loadData}>Filtrar</Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-primary" /> Ganancia Total Estimada
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">
                            USDT {stats.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Basado en transacciones completadas.</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-green-600" /> Operaciones Exitosas
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{transactions.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">Total acumulado histórico.</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <PieChart className="w-4 h-4 text-orange-500" /> Moneda Más Rentable
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {Object.entries(stats.profitByCurrency).length > 0
                                ? Object.entries(stats.profitByCurrency).sort((a: any, b: any) => b[1] - a[1])[0][0]
                                : "---"}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Mayor aporte a la ganancia total (USDT).</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Desglose por Moneda</CardTitle>
                    <CardDescription>Volumen total y ganancia estimada retenida.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted text-muted-foreground font-medium border-b">
                                <tr>
                                    <th className="p-4">Moneda (Origen)</th>
                                    <th className="p-4">Volumen Enviado</th>
                                    <th className="p-4 text-green-600">Ganancia (USDT)</th>
                                    <th className="p-4 text-muted-foreground">Margen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y bg-background">
                                {loading ? (
                                    <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Calculando estadísticas...</td></tr>
                                ) : Object.keys(stats.volumeByCurrency).length === 0 ? (
                                    <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No hay datos para mostrar.</td></tr>
                                ) : Object.keys(stats.volumeByCurrency).sort().map(curr => (
                                    <tr key={curr} className="hover:bg-muted/30 transition-colors">
                                        <td className="p-4">
                                            <div className="font-bold">{CURRENCY_LABELS[curr as keyof typeof CURRENCY_LABELS] || curr}</div>
                                            {(REGION_TO_ISO[curr] || curr) !== curr && <div className="text-[10px] text-muted-foreground">Legacy: {curr}</div>}
                                        </td>
                                        <td className="p-4">{stats.volumeByCurrency[curr].toLocaleString()} {curr}</td>
                                        <td className="p-4 text-green-600 font-bold">+{stats.profitByCurrency[curr].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="p-4 text-muted-foreground">
                                            {stats.volumeByCurrency[curr] > 0
                                                ? (stats.marginSumByCurrency[curr] / stats.volumeByCurrency[curr]).toFixed(1) + "% de ganancia"
                                                : "0%"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg flex gap-3 text-yellow-800">
                <PieChart className="w-5 h-5 mt-0.5 shrink-0" />
                <div className="text-sm">
                    <strong>Nota sobre Cálculos:</strong> La ganancia se basa en el margen configurado al momento de la orden. Para transacciones históricas sin este dato, el sistema utiliza un <strong>Estimado Inteligente</strong> basado en tus márgenes actuales para asegurar que el resumen sea completo y útil.
                </div>
            </div>
        </div>
    )
}
// build trigger 
