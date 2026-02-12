"use client"

import { useState, useEffect } from "react"
import { TransactionsService, Transaction } from "@/services/transactions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Eye, Check, X, ImageIcon, Upload, ClipboardPaste, ArrowLeft } from "lucide-react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

type AdminTx = Transaction & { profiles: { email: string, full_name: string } }

export default function AdminTransactionsPage() {
    const [transactions, setTransactions] = useState<AdminTx[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedTx, setSelectedTx] = useState<AdminTx | null>(null)
    const [completionFile, setCompletionFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)

    useEffect(() => {
        loadTransactions()
    }, [])

    const loadTransactions = async () => {
        setLoading(true)
        const data = await TransactionsService.getAll()
        setTransactions(data as AdminTx[])
        setLoading(false)
    }

    useEffect(() => {
        const handleGlobalPaste = (e: ClipboardEvent) => {
            if (!selectedTx || selectedTx.status === 'completed') return

            const items = e.clipboardData?.items
            if (!items) return

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("image") !== -1) {
                    const blob = items[i].getAsFile()
                    if (blob) {
                        const file = new File([blob], `pasted_image_${Date.now()}.png`, { type: blob.type })
                        setCompletionFile(file)
                    }
                }
            }
        }

        window.addEventListener('paste', handleGlobalPaste)
        return () => window.removeEventListener('paste', handleGlobalPaste)
    }, [selectedTx])

    const handleStatusUpdate = async (id: string, status: Transaction['status'], completionProofUrl?: string) => {
        if (status === 'completed' && !completionFile && !selectedTx?.completion_proof_url) {
            alert("Por favor, carga o pega un comprobante para completar la operación.")
            return
        }

        if (!confirm(`¿Cambiar estado a ${status}?`)) return

        setIsUploading(true)
        try {
            let proofUrl = selectedTx?.completion_proof_url

            if (completionFile) {
                const fileExt = completionFile.name.split('.').pop() || 'png'
                const fileName = `settlements/${id}/${Math.random()}.${fileExt}`

                const { error: uploadError } = await supabase.storage
                    .from('payments')
                    .upload(fileName, completionFile)

                if (uploadError) throw uploadError

                const { data } = supabase.storage
                    .from('payments')
                    .getPublicUrl(fileName)

                proofUrl = data.publicUrl
            }

            await TransactionsService.updateStatus(id, status, proofUrl)
            setCompletionFile(null)
            setSelectedTx(null)
            loadTransactions()
        } catch (error) {
            console.error(error)
            alert("Error al actualizar estado")
        } finally {
            setIsUploading(false)
        }
    }

    const StatusBadge = ({ status }: { status: Transaction['status'] }) => {
        const variants: Record<string, string> = {
            verifying: "bg-yellow-100 text-yellow-800",
            verified: "bg-blue-100 text-blue-800",
            completed: "bg-green-100 text-green-800",
            rejected: "bg-red-100 text-red-800",
        }
        return (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[status]}`}>
                {status.toUpperCase()}
            </span>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/admin">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold">Panel de Operaciones</h1>
                        <p className="text-muted-foreground">Gestiona las remesas entrantes y aprueba pagos.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/admin/payment-methods">Gestionar Cuentas</Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <Link href="/admin/users">Gestionar Usuarios</Link>
                    </Button>
                    <Button variant="outline" onClick={loadTransactions}>Actualizar Lista</Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted text-muted-foreground font-medium border-b">
                                <tr>
                                    <th className="p-4">Fecha</th>
                                    <th className="p-4">Usuario</th>
                                    <th className="p-4">Operación</th>
                                    <th className="p-4">Estado</th>
                                    <th className="p-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y bg-background">
                                {loading ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Cargando transacciones...</td></tr>
                                ) : transactions.length === 0 ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No hay operaciones registradas.</td></tr>
                                ) : transactions.map(tx => (
                                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="p-4 whitespace-nowrap">
                                            {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : ''}
                                            <div className="text-[10px] text-muted-foreground">{tx.created_at ? new Date(tx.created_at).toLocaleTimeString() : ''}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-semibold text-foreground">{tx.profiles?.full_name || 'Sin nombre'}</div>
                                            <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">{tx.profiles?.email}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-primary">
                                                {tx.amount_sent} {tx.currency_sent} → {tx.amount_received.toLocaleString()} {tx.currency_received}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground">Tasa: {tx.exchange_rate}</div>
                                        </td>
                                        <td className="p-4">
                                            <StatusBadge status={tx.status} />
                                        </td>
                                        <td className="p-4 text-right">
                                            <Button variant="ghost" size="sm" onClick={() => setSelectedTx(tx)} className="h-8">
                                                <Eye className="w-4 h-4 mr-2" /> Revisar
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Admin Detail Modal Backdrop */}
            {selectedTx && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                        <CardHeader className="border-b bg-background p-4 sm:p-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-xl">Operación #{selectedTx.id?.split('-')[0]}</CardTitle>
                                    <CardDescription>Revisión detallada y aprobación de fondos.</CardDescription>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setSelectedTx(null)} className="rounded-full">
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 overflow-y-auto">
                            <div className="p-4 sm:p-6 grid md:grid-cols-2 gap-8">
                                <div className="space-y-8">
                                    <div className="space-y-4">
                                        <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground border-b pb-1">Detalles de Operación</h3>
                                        <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-muted-foreground">Monto enviado:</span>
                                                <span className="font-bold text-lg">{selectedTx.amount_sent} {selectedTx.currency_sent}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-muted-foreground">Monto a pagar:</span>
                                                <span className="font-bold text-lg text-primary">{selectedTx.amount_received.toLocaleString()} {selectedTx.currency_received}</span>
                                            </div>
                                            <div className="pt-2 border-t flex justify-between items-center text-xs">
                                                <span className="text-muted-foreground text-[10px]">TASA APLICADA: {selectedTx.exchange_rate}</span>
                                                <StatusBadge status={selectedTx.status} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground border-b pb-1">Acciones Operador</h3>

                                        {selectedTx.status !== 'completed' && (
                                            <div
                                                className="border-2 border-dashed rounded-lg p-4 text-center bg-muted/20 hover:bg-muted/30 transition-all group relative outline-none"
                                            >
                                                <input
                                                    type="file"
                                                    id="operator-proof"
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                    accept="image/*"
                                                    onChange={(e) => setCompletionFile(e.target.files?.[0] || null)}
                                                />
                                                <div className="space-y-2 pointer-events-none">
                                                    <div className="flex justify-center gap-2 text-primary">
                                                        <Upload className="w-5 h-5" />
                                                        <ClipboardPaste className="w-5 h-5" />
                                                    </div>
                                                    <div className="text-xs font-medium">
                                                        {completionFile ? completionFile.name : "Pega (Ctrl+V) o haz clic para subir comprobante de pago"}
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground italic">Sube el comprobante de la transferencia realizada al cliente</p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-3">
                                            <Button
                                                className="bg-green-600 hover:bg-green-700 h-11"
                                                onClick={() => handleStatusUpdate(selectedTx.id!, 'completed')}
                                                disabled={selectedTx.status === 'completed' || isUploading}
                                            >
                                                <Check className="w-4 h-4 mr-2" />
                                                {isUploading ? "Subiendo..." : "Completar y Enviar"}
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                className="h-11"
                                                onClick={() => handleStatusUpdate(selectedTx.id!, 'rejected')}
                                                disabled={selectedTx.status === 'rejected' || isUploading}
                                            >
                                                <X className="w-4 h-4 mr-2" /> Rechazar
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="col-span-2 h-10"
                                                onClick={() => handleStatusUpdate(selectedTx.id!, 'verified')}
                                                disabled={selectedTx.status === 'verified' || selectedTx.status === 'completed' || isUploading}
                                            >
                                                Confirmar Recepción de Fondos
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6 text-foreground">
                                    <div className="space-y-2">
                                        <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground border-b pb-1">Comprobante Cliente (Origen)</h3>
                                        {selectedTx.payment_proof_url ? (
                                            <div className="group relative border rounded-xl overflow-hidden bg-black aspect-[3/4] flex items-center justify-center">
                                                <img
                                                    src={selectedTx.payment_proof_url}
                                                    alt="Comprobante"
                                                    className="max-w-full max-h-full object-contain"
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <Button variant="secondary" size="sm" onClick={() => window.open(selectedTx.payment_proof_url, '_blank')}>
                                                        Ver Pantalla Completa
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="border border-dashed rounded-lg p-6 text-center text-muted-foreground flex flex-col items-center gap-2 bg-muted/10">
                                                <ImageIcon className="w-8 h-8 opacity-20" />
                                                <span className="text-xs">Sin comprobante del cliente</span>
                                            </div>
                                        )}
                                    </div>

                                    {(selectedTx.completion_proof_url || completionFile) && (
                                        <div className="space-y-2">
                                            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground border-b pb-1">Comprobante Operador (Liquidación)</h3>
                                            <div className="group relative border rounded-xl overflow-hidden bg-black/5 aspect-[3/4] flex items-center justify-center">
                                                {completionFile ? (
                                                    <img
                                                        src={URL.createObjectURL(completionFile)}
                                                        alt="Vista previa"
                                                        className="max-w-full max-h-full object-contain"
                                                    />
                                                ) : (
                                                    <img
                                                        src={selectedTx.completion_proof_url}
                                                        alt="Liquidación"
                                                        className="max-w-full max-h-full object-contain"
                                                    />
                                                )}
                                                {completionFile && (
                                                    <div className="absolute top-2 right-2">
                                                        <Button variant="destructive" size="icon" className="h-8 w-8 rounded-full" onClick={() => setCompletionFile(null)}>
                                                            <X className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
