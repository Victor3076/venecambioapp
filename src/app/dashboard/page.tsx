"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { PlusCircle, ArrowRightLeft, CreditCard, ExternalLink, Clock, CheckCircle2, Share2 } from "lucide-react"
import { useEffect, useState } from "react"
import { TransactionsService, Transaction } from "@/services/transactions"
import { AccountsService } from "@/services/accounts"
import { DashboardTour } from "@/components/DashboardTour"

export default function DashboardPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [accountsCount, setAccountsCount] = useState(0)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadData = async () => {
            try {
                const [txs, accounts] = await Promise.all([
                    TransactionsService.getMyTransactions(),
                    AccountsService.getMyAccounts()
                ])
                setTransactions(txs || [])
                setAccountsCount(accounts?.length || 0)
            } catch (error) {
                console.error(error)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [])

    const handleShare = async (tx: Transaction) => {
        const text = `*Venecambio - Detalle de Operación*\n\n` +
            `🔹 *Estado:* ${tx.status.toUpperCase()}\n` +
            `💵 *Enviado:* ${tx.amount_sent} ${tx.currency_sent}\n` +
            `💰 *Recibido:* ${tx.amount_received.toLocaleString()} ${tx.currency_received}\n` +
            `📈 *Tasa:* ${tx.exchange_rate}\n` +
            (tx.completion_proof_url ? `📄 *Comprobante:* ${tx.completion_proof_url}` : '')

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Operación Venecambio',
                    text: text,
                })
            } catch (err) {
                console.log('Error al compartir:', err)
            }
        } else {
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`
            window.open(whatsappUrl, '_blank')
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'text-green-600 bg-green-50'
            case 'verifying': return 'text-blue-600 bg-blue-50'
            case 'rejected': return 'text-red-600 bg-red-50'
            default: return 'text-muted-foreground bg-muted'
        }
    }

    return (
        <div className="space-y-6">
            <DashboardTour />
            <div className="flex items-center justify-between">
                <h1 id="tour-welcome" className="text-3xl font-bold">Resumen Diario</h1>
                <Button id="tour-new-operation" asChild>
                    <Link href="/dashboard/transactions/new">
                        <PlusCircle className="mr-2 h-4 w-4" /> Nueva Operación
                    </Link>
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card id="tour-history" className="border-l-4 border-l-primary">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Historial</CardTitle>
                        <ArrowRightLeft className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{transactions.length}</div>
                        <p className="text-xs text-muted-foreground">Operaciones registradas</p>
                    </CardContent>
                </Card>
                <Card id="tour-accounts" className="border-l-4 border-l-blue-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Beneficiarios</CardTitle>
                        <CreditCard className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{accountsCount}</div>
                        <p className="text-xs text-muted-foreground">Cuentas para enviar dinero</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Operaciones Recientes</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-10 text-muted-foreground italic">Cargando tus movimientos...</div>
                    ) : transactions.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            Aún no has realizado ninguna operación.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {transactions.map(tx => (
                                <div key={tx.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/30 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-full ${getStatusColor(tx.status)}`}>
                                            {tx.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <div className="font-bold">
                                                {tx.amount_sent} {tx.currency_sent} → {tx.amount_received.toLocaleString()} {tx.currency_received}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : 'Pendiente'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => handleShare(tx)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                                            <Share2 className="w-4 h-4" />
                                        </Button>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${getStatusColor(tx.status)}`}>
                                                {tx.status}
                                            </span>
                                            {tx.completion_proof_url && (
                                                <Button variant="outline" size="sm" asChild className="h-8 text-xs">
                                                    <a href={tx.completion_proof_url} target="_blank" rel="noopener noreferrer">
                                                        <ExternalLink className="w-3 h-3 mr-1" /> Comprobante
                                                    </a>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
