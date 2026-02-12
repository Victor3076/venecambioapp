"use client"

import { useState, useEffect } from "react"
import { TransactionsService, Transaction } from "@/services/transactions"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRightLeft, Clock, CheckCircle2, XCircle } from "lucide-react"

export default function TransactionsHistoryPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const load = async () => {
            const data = await TransactionsService.getMyTransactions()
            setTransactions(data)
            setLoading(false)
        }
        load()
    }, [])

    const StatusBadge = ({ status }: { status: Transaction['status'] }) => {
        const config = {
            verifying: { label: 'Verificando', icon: Clock, className: 'bg-yellow-100 text-yellow-800' },
            verified: { label: 'Verificado', icon: CheckCircle2, className: 'bg-blue-100 text-blue-800' },
            completed: { label: 'Completado', icon: CheckCircle2, className: 'bg-green-100 text-green-800' },
            rejected: { label: 'Rechazado', icon: XCircle, className: 'bg-red-100 text-red-800' },
        }
        const { label, icon: Icon, className } = config[status]
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
                <Icon className="w-3 h-3" /> {label}
            </span>
        )
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Mis Transacciones</h1>

            {loading ? (
                <div className="text-center py-10">Cargando historial...</div>
            ) : transactions.length === 0 ? (
                <Card>
                    <CardContent className="py-10 text-center text-muted-foreground">
                        No has realizado ninguna transacción aún.
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {transactions.map(tx => (
                        <Card key={tx.id}>
                            <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="bg-primary/10 p-2 rounded-full text-primary hidden sm:block">
                                        <ArrowRightLeft className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="font-bold">ID: #{tx.id?.split('-')[0]}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : ''} {tx.created_at ? new Date(tx.created_at).toLocaleTimeString() : ''}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 flex flex-col items-center sm:items-start text-center sm:text-left">
                                    <div className="text-lg font-bold">
                                        {tx.amount_sent} {tx.currency_sent} → {tx.amount_received.toLocaleString()} {tx.currency_received}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Tasa: {tx.exchange_rate}</div>
                                </div>

                                <StatusBadge status={tx.status} />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
