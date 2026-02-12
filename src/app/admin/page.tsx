"use client"

import { useState, useEffect } from "react"
import { TransactionsService, Transaction } from "@/services/transactions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, RefreshCw, Eye, Check, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import { CURRENCY_LABELS } from "@/lib/constants"

type AdminTx = Transaction & { profiles: { email: string, full_name: string } }

export default function AdminDashboardPage() {
    const router = useRouter()
    const [transactions, setTransactions] = useState<AdminTx[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")

    useEffect(() => {
        loadTransactions()
    }, [])

    const loadTransactions = async () => {
        setLoading(true)
        const data = await TransactionsService.getAll()
        setTransactions(data as AdminTx[])
        setLoading(false)
    }

    const filteredTransactions = transactions.filter(tx => {
        const query = searchQuery.toLowerCase()
        return (
            tx.profiles?.full_name?.toLowerCase().includes(query) ||
            tx.profiles?.email?.toLowerCase().includes(query) ||
            tx.id?.toLowerCase().includes(query) ||
            tx.amount_sent.toString().includes(query) ||
            tx.amount_received.toString().includes(query)
        )
    })

    const StatusBadge = ({ status }: { status: Transaction['status'] }) => {
        const variants: Record<string, { variant: any, label: string }> = {
            verifying: { variant: "warning", label: "Verificando" },
            verified: { variant: "default", label: "Verificado" },
            completed: { variant: "success", label: "Completado" },
            rejected: { variant: "destructive", label: "Rechazado" },
        }
        const config = variants[status] || variants.verifying
        return <Badge variant={config.variant as any}>{config.label}</Badge>
    }

    return (
        <div className="min-h-screen bg-muted/40 p-6 flex flex-col gap-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Operaciones</h1>
                    <p className="text-muted-foreground">Gestión de envíos y pagos.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={loadTransactions}>
                        <RefreshCw className="mr-2 h-4 w-4" /> Actualizar Lista
                    </Button>
                </div>
            </header>

            {/* OPERATIONS TABLE */}
            <Card>
                <CardHeader>
                    <CardTitle>Operaciones Recientes</CardTitle>
                    <CardDescription>Control de envíos y validación de pagos.</CardDescription>
                    <div className="pt-4">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Buscar por cliente, referencia o monto..."
                                className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px]"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted text-muted-foreground font-medium border-b">
                                <tr>
                                    <th className="p-4">Estado</th>
                                    <th className="p-4">Monto Envío</th>
                                    <th className="p-4">Moneda</th>
                                    <th className="p-4">Recibe (Bs)</th>
                                    <th className="p-4">Cliente</th>
                                    <th className="p-4">Ref. Operación</th>
                                    <th className="p-4">Origen</th>
                                    <th className="p-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-muted-foreground">
                                            Cargando operaciones...
                                        </td>
                                    </tr>
                                ) : filteredTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-muted-foreground">
                                            {searchQuery ? "No se encontraron resultados." : "No hay operaciones registradas."}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTransactions.map(tx => (
                                        <tr key={tx.id} className="hover:bg-muted/50">
                                            <td className="p-4">
                                                <StatusBadge status={tx.status} />
                                            </td>
                                            <td className="p-4 font-medium">{tx.amount_sent.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                                            <td className="p-4">{CURRENCY_LABELS[tx.currency_sent] || tx.currency_sent}</td>
                                            <td className="p-4 text-green-600 font-bold">{tx.amount_received.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                                            <td className="p-4">{tx.profiles?.full_name || 'Sin nombre'}</td>
                                            <td className="p-4 text-muted-foreground">{tx.id?.substring(0, 7)}</td>
                                            <td className="p-4">
                                                <Badge variant="outline">{tx.profiles?.email?.split('@')[0] || 'N/A'}</Badge>
                                            </td>
                                            <td className="p-4 text-right">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="mr-2"
                                                    onClick={() => router.push('/admin/transactions')}
                                                >
                                                    Ver
                                                </Button>
                                                {tx.status === 'verified' && (
                                                    <Button size="sm">Pagar</Button>
                                                )}
                                                {tx.status === 'verifying' && (
                                                    <Button size="sm" variant="default"><Check className="h-4 w-4" /></Button>
                                                )}
                                                {tx.status === 'completed' && (
                                                    <Button size="sm" variant="outline"><Upload className="h-4 w-4" /></Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
