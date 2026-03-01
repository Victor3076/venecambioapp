"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { TransactionsService, Transaction } from "@/services/transactions"
import { BankDepositsService, BankDeposit } from "@/services/bank-deposits"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Eye, Check, X, ImageIcon, Upload, ClipboardPaste, ArrowLeft, Copy, User, Landmark, CreditCard, Mail, Phone, Hash, Search, FileUp, Plus, AlertCircle, Trash2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { formatCurrency } from "@/lib/rates-utils"
import { ManualTransactionDialog } from "@/components/admin/manual-transaction-dialog"
import { CURRENCY_LABELS } from "@/lib/constants"

type AdminTx = Transaction & { profiles: { email: string, full_name: string } }

export default function AdminTransactionsPage() {
    const [transactions, setTransactions] = useState<AdminTx[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedTx, setSelectedTx] = useState<AdminTx | null>(null)
    const [completionFile, setCompletionFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [potentialMatches, setPotentialMatches] = useState<BankDeposit[]>([])
    const [allDeposits, setAllDeposits] = useState<BankDeposit[]>([])
    const [isReconciliationOpen, setIsReconciliationOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [matching, setMatching] = useState(false)
    const [filterDate, setFilterDate] = useState(new Date().toLocaleDateString('en-CA'))
    const [filterStatus, setFilterStatus] = useState<Transaction['status'] | 'all'>('all')
    const [filterCurrency, setFilterCurrency] = useState<string>('all')
    const [isManualModalOpen, setIsManualModalOpen] = useState(false)
    const [preSelectedDepositId, setPreSelectedDepositId] = useState<string | null>(null)
    const [userRole, setUserRole] = useState<string | null>(null)


    useEffect(() => {
        if (selectedTx && selectedTx.status === 'verifying') {
            BankDepositsService.findPotentialMatches(selectedTx.id!)
                .then(data => setPotentialMatches(data || []))
                .catch(err => console.error(err))
        } else {
            setPotentialMatches([])
        }
    }, [selectedTx])

    const openReconciliation = async () => {
        setIsReconciliationOpen(true)
        try {
            // Load all available deposits for manual search
            const deposits = await BankDepositsService.getAvailable()
            setAllDeposits(deposits || [])
        } catch (error) {
            console.error("Error loading deposits:", error)
        }
    }

    const handleMatch = async (depositId: string) => {
        if (!selectedTx) return
        if (!confirm("¿Confirmar conciliación con este depósito? Esto verificará la operación automáticamente.")) return

        setMatching(true)
        try {
            await BankDepositsService.match(depositId, selectedTx.id!)
            toast.success("Operación conciliada y verificada exitosamente.")
            setIsReconciliationOpen(false)
            setSelectedTx(null)
            loadTransactions()
        } catch (e: any) {
            console.error(e)
            toast.error(`Error al conciliar: ${e.message}`)
        } finally {
            setMatching(false)
        }
    }

    const handleVerifyWithoutDeposit = async () => {
        if (!selectedTx) return
        if (!confirm("¿Estás seguro de verificar sin respaldo bancario asociado?")) return

        await handleStatusUpdate(selectedTx.id!, 'verified')
        setIsReconciliationOpen(false)
    }

    useEffect(() => {
        loadTransactions()

        // Get user role for restricted actions
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                supabase.from('profiles').select('role').eq('id', user.id).single()
                    .then(({ data }) => setUserRole(data?.role || null))
            }
        })

        // Real-time subscriptions - with silent refreshes to avoid UI flicker
        const unsubTransactions = TransactionsService.subscribe(() => {
            loadTransactions(true)
        })

        const unsubDeposits = BankDepositsService.subscribe(() => {
            loadTransactions(true)
        })

        return () => {
            unsubTransactions()
            unsubDeposits()
        }
    }, [])

    const loadTransactions = async (silent = false) => {
        if (!silent) setLoading(true)
        try {
            const [txData, depData] = await Promise.all([
                TransactionsService.getAll(),
                BankDepositsService.getAll()
            ])
            setTransactions(txData as AdminTx[])
            setAllDeposits(depData)
        } catch (error) {
            console.error("Error loading data:", error)
        } finally {
            if (!silent) setLoading(false)
        }
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
            toast.warning("Por favor, carga o pega un comprobante para completar la operación.")
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
            toast.error("Error al actualizar estado")
        } finally {
            setIsUploading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("¿Esta seguro de eliminar esta operacion?")) return

        setIsUploading(true)
        try {
            await TransactionsService.delete(id)
            toast.success("Operación eliminada exitosamente.")
            setSelectedTx(null)
            loadTransactions()
        } catch (error: any) {
            console.error(error)
            toast.error(`Error al eliminar: ${error.message}`)
        } finally {
            setIsUploading(false)
        }
    }


    const copyToClipboard = (text: string) => {
        if (!text) return
        navigator.clipboard.writeText(text)
        toast.success("¡Copiado al portapapeles!")
    }

    const StatusBadge = ({ status }: { status: Transaction['status'] }) => {
        const variants: Record<string, { className: string, label: string }> = {
            verifying: { className: "bg-yellow-100 text-yellow-800", label: "Verificando" },
            verified: { className: "bg-blue-100 text-blue-800", label: "Verificado" },
            completed: { className: "bg-green-100 text-green-800", label: "Completado" },
            rejected: { className: "bg-red-100 text-red-800", label: "Rechazado" },
        }
        const config = variants[status] || variants.verifying
        return (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
                {config.label}
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
                    <Button variant="outline" onClick={() => loadTransactions()}>Actualizar Lista</Button>
                    <Button className="bg-primary hover:bg-primary/90" onClick={() => setIsManualModalOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" /> Nueva Operación (WhatsApp)
                    </Button>
                </div>
            </div>

            {/* Pending Deposits Alert */}
            {(() => {
                const pending = allDeposits.filter(d => d.status === 'available' || !d.matched_transaction_id);
                if (pending.length === 0) return null;

                return (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-3 text-amber-900">
                            <div className="bg-amber-100 p-2 rounded-full text-amber-600 shrink-0">
                                <AlertCircle className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-sm">Depósitos pendientes por procesar</h4>
                                <p className="text-[11px] text-amber-700 leading-tight">
                                    Hay <b>{pending.length}</b> {pending.length === 1 ? 'entrada bancaria que no ha' : 'entradas bancarias que no han'} sido vinculadas a ninguna operación.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {pending.slice(0, 1).map(d => (
                                <Button
                                    key={d.id}
                                    variant="outline"
                                    size="sm"
                                    className="border-amber-300 bg-amber-100/50 hover:bg-amber-200 text-amber-800 text-[10px] h-8 font-bold"
                                    onClick={() => {
                                        setPreSelectedDepositId(d.id || null)
                                        setIsManualModalOpen(true)
                                    }}
                                >
                                    Procesar {formatCurrency(d.amount, d.currency)} {d.currency}
                                </Button>
                            ))}
                            {pending.length > 1 && (
                                <Link href="/admin/deposits">
                                    <Button variant="ghost" size="sm" className="text-amber-700 text-[10px] h-8">Ver todos</Button>
                                </Link>
                            )}
                        </div>
                    </div>
                );
            })()}

            <Card className="p-4 shadow-sm border-none ring-1 ring-black/5">
                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    <div className="lg:col-span-2">
                        <label className="text-sm font-medium mb-1 block">Buscar</label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cliente, monto, ID..."
                                className="pl-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1 block">Moneda</label>
                        <select
                            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={filterCurrency}
                            onChange={(e) => setFilterCurrency(e.target.value)}
                        >
                            <option value="all">Todas las monedas</option>
                            <option value="PEN">PEN (Soles)</option>
                            <option value="CLP">CLP (Pesos CLP)</option>
                            <option value="COP">COP (Pesos COP)</option>
                            <option value="USD">USD (Dólares)</option>
                            <option value="VES">VES (Bolívares)</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1 block">Estado</label>
                        <select
                            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as any)}
                        >
                            <option value="all">Todos los estados</option>
                            <option value="verifying">Verificando</option>
                            <option value="verified">Verificado</option>
                            <option value="completed">Completado</option>
                            <option value="rejected">Rechazado</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1 block">Fecha</label>
                        <Input
                            type="date"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex justify-end mt-4">
                    <Button variant="ghost" size="sm" onClick={() => { setFilterDate(new Date().toISOString().split('T')[0]); setFilterStatus("all"); setFilterCurrency("all"); setSearchTerm("") }}>
                        Limpiar Filtros
                    </Button>
                </div>
            </Card>

            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
                                <tr>
                                    <th className="p-4">Fecha</th>
                                    <th className="p-4">Usuario</th>
                                    <th className="p-4">Operación</th>
                                    <th className="p-4">Banco / Ref</th>
                                    <th className="p-4">Estado</th>
                                    <th className="p-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y bg-background">
                                {loading ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Cargando transacciones...</td></tr>
                                ) : (() => {
                                    const filtered = (transactions.map(tx => ({
                                        ...tx,
                                        deposit: allDeposits.find(d => d.matched_transaction_id === tx.id)
                                    })) as any[]).filter((tx: any) => {
                                        const matchesStatus = filterStatus === 'all' || tx.status === filterStatus
                                        const matchesCurrency = filterCurrency === 'all' || tx.currency_sent === filterCurrency
                                        const txDate = tx.created_at ? new Date(tx.created_at) : null;
                                        let matchesDate = true;
                                        if (filterDate && txDate) {
                                            // Convert UTC to local date string YYYY-MM-DD
                                            const localDateStr = new Date(txDate.getTime() - (txDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                                            matchesDate = localDateStr === filterDate;
                                        }

                                        const searchLower = searchTerm.toLowerCase()
                                        const matchesSearch = !searchTerm ||
                                            tx.profiles?.full_name?.toLowerCase().includes(searchLower) ||
                                            tx.amount_sent.toString().includes(searchTerm) ||
                                            tx.amount_received.toString().includes(searchTerm) ||
                                            tx.id?.toLowerCase().includes(searchLower) ||
                                            tx.deposit?.bank_name?.toLowerCase().includes(searchLower) ||
                                            tx.deposit?.reference_number?.toLowerCase().includes(searchLower)

                                        return matchesStatus && matchesDate && matchesSearch && matchesCurrency
                                    });

                                    if (filtered.length === 0) {
                                        return <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No hay operaciones que coincidan con los filtros.</td></tr>
                                    }

                                    return filtered.map(tx => {
                                        const deposit = tx.deposit
                                        return (
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
                                                        {formatCurrency(tx.amount_sent, tx.currency_sent)} {tx.currency_sent} → {formatCurrency(tx.amount_received, tx.currency_received)} {tx.currency_received}
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground">Tasa: {tx.exchange_rate}</div>
                                                </td>
                                                <td className="p-4">
                                                    {deposit ? (
                                                        <div className="space-y-0.5">
                                                            <div className="font-medium text-xs flex items-center gap-1.5">
                                                                <Landmark className="w-3 h-3 text-muted-foreground" />
                                                                {deposit.bank_name || 'Desconocido'}
                                                            </div>
                                                            <div className="text-[10px] flex items-center gap-1.5 text-muted-foreground text-ellipsis overflow-hidden max-w-[120px]">
                                                                <Hash className="w-3 h-3" />
                                                                {deposit.reference_number}
                                                            </div>
                                                            {deposit.notes && (
                                                                <div className="text-[10px] text-blue-600 font-medium truncate max-w-[120px]">
                                                                    {deposit.notes}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-muted-foreground italic">Sin conciliar</span>
                                                    )}
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
                                        )
                                    })
                                })()}
                            </tbody>
                            <tfoot className="bg-muted/20 border-t">
                                <tr>
                                    <td colSpan={2} className="p-4 font-bold text-right text-muted-foreground">
                                        Total {filterCurrency !== 'all' ? CURRENCY_LABELS[filterCurrency] || filterCurrency : ''} filtrado:
                                    </td>
                                    <td className="p-4">
                                        <div className="font-black text-lg text-primary">
                                            {filterCurrency !== 'all'
                                                ? formatCurrency(transactions
                                                    .map(tx => ({
                                                        ...tx,
                                                        deposit: allDeposits.find(d => d.matched_transaction_id === tx.id)
                                                    }))
                                                    .filter(tx => {
                                                        const matchesStatus = filterStatus === 'all' || tx.status === filterStatus
                                                        const matchesCurrency = tx.currency_sent === filterCurrency
                                                        const txDate = tx.created_at ? new Date(tx.created_at) : null;
                                                        let matchesDate = true;
                                                        if (filterDate && txDate) {
                                                            const localDateStr = new Date(txDate.getTime() - (txDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                                                            matchesDate = localDateStr === filterDate;
                                                        }

                                                        const searchLower = searchTerm.toLowerCase()
                                                        const matchesSearch = !searchTerm ||
                                                            tx.profiles?.full_name?.toLowerCase().includes(searchLower) ||
                                                            tx.amount_sent.toString().includes(searchTerm) ||
                                                            tx.id?.toLowerCase().includes(searchLower) ||
                                                            tx.deposit?.bank_name?.toLowerCase().includes(searchLower) ||
                                                            tx.deposit?.reference_number?.toLowerCase().includes(searchLower)

                                                        return matchesStatus && matchesDate && matchesSearch && matchesCurrency
                                                    })
                                                    .reduce((sum, tx) => sum + Number(tx.amount_sent), 0),
                                                    filterCurrency
                                                ) + " " + filterCurrency
                                                : "---"
                                            }
                                        </div>
                                    </td>
                                    <td colSpan={3}>
                                        {filterCurrency === 'all' && <span className="text-[10px] text-muted-foreground italic">Filtra por moneda para ver el total</span>}
                                    </td>
                                </tr>
                            </tfoot>
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
                                    <CardTitle className="text-xl text-foreground">Operación #{selectedTx.id?.split('-')[0]}</CardTitle>
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
                                    <div className="space-y-6">
                                        <div className="space-y-4">
                                            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground border-b pb-1">Detalles de Operación</h3>
                                            <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-muted-foreground">Ref:</span>
                                                    <span className="font-mono bg-muted px-2 py-0.5 rounded text-[10px] truncate max-w-[150px]">
                                                        {selectedTx.id}
                                                    </span>
                                                    {selectedTx.group_id && (
                                                        <Badge variant="secondary" className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-[10px] py-0 px-1.5 h-4 border-purple-200">
                                                            Múltiple
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-muted-foreground">Monto enviado:</span>
                                                    <span className="font-bold text-lg">{formatCurrency(selectedTx.amount_sent, selectedTx.currency_sent)} {selectedTx.currency_sent}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-muted-foreground">Monto a pagar:</span>
                                                    <span className="font-bold text-lg text-primary">{formatCurrency(selectedTx.amount_received, selectedTx.currency_received)} {selectedTx.currency_received}</span>
                                                </div>
                                                <div className="pt-2 border-t flex justify-between items-center text-xs">
                                                    <span className="text-muted-foreground">TASA: {selectedTx.exchange_rate}</span>
                                                    <StatusBadge status={selectedTx.status} />
                                                </div>
                                            </div>
                                        </div>

                                        {selectedTx.beneficiary_data && (
                                            <div className="space-y-4">
                                                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground border-b pb-1">Datos Beneficiario</h3>
                                                <div className="bg-muted/10 rounded-lg border p-4 space-y-4 shadow-sm">
                                                    <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                                                        <div className="bg-primary/10 p-1.5 rounded-full text-primary">
                                                            <User className="w-4 h-4" />
                                                        </div>
                                                        <span className="font-bold text-base">{selectedTx.beneficiary_data.alias}</span>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-muted-foreground ml-1"
                                                            onClick={() => copyToClipboard(selectedTx.beneficiary_data?.alias || '')}
                                                        >
                                                            <Copy className="w-3 h-3" />
                                                        </Button>
                                                        <div className="ml-auto text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground uppercase">{selectedTx.beneficiary_data.country}</div>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-3 text-sm">
                                                        <div className="flex justify-between items-center group">
                                                            <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                                                                <Landmark className="w-3.5 h-3.5" /> Banco:
                                                            </span>
                                                            <div className="flex items-center gap-1">
                                                                <span className="font-bold">{selectedTx.beneficiary_data.bank_name}</span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6"
                                                                    onClick={() => copyToClipboard(selectedTx.beneficiary_data?.bank_name || '')}
                                                                >
                                                                    <Copy className="w-3 h-3" />
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        <div className="flex justify-between items-center group">
                                                            <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                                                                <CreditCard className="w-3.5 h-3.5" /> Cuenta / Tel:
                                                            </span>
                                                            <div className="flex items-center gap-1">
                                                                <span className="font-black font-mono text-primary">{selectedTx.beneficiary_data.account_number}</span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6"
                                                                    onClick={() => copyToClipboard(selectedTx.beneficiary_data?.account_number || '')}
                                                                >
                                                                    <Copy className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        {/* Dynamic Details */}
                                                        {selectedTx.beneficiary_data.details?.rut && (
                                                            <div className="flex justify-between items-center group pt-2 border-t border-dashed">
                                                                <span className="text-muted-foreground font-medium">RUT:</span>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-bold">{selectedTx.beneficiary_data.details.rut}</span>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-6 w-6"
                                                                        onClick={() => copyToClipboard(selectedTx.beneficiary_data?.details?.rut || '')}
                                                                    >
                                                                        <Copy className="w-3 h-3" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {(selectedTx.beneficiary_data.details?.id_number) && (
                                                            <div className="flex justify-between items-center group pt-2 border-t border-dashed">
                                                                <span className="text-muted-foreground font-medium">Documento:</span>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-bold">{selectedTx.beneficiary_data.details.id_number}</span>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-6 w-6"
                                                                        onClick={() => copyToClipboard(selectedTx.beneficiary_data?.details?.id_number || '')}
                                                                    >
                                                                        <Copy className="w-3 h-3" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {selectedTx.beneficiary_data.details?.account_type && (
                                                            <div className="flex justify-between items-center bg-muted/30 px-2 py-1.5 rounded">
                                                                <span className="text-[10px] uppercase font-bold text-muted-foreground">Tipo de Cuenta</span>
                                                                <span className="text-xs font-black">{selectedTx.beneficiary_data.details.account_type}</span>
                                                            </div>
                                                        )}

                                                        {selectedTx.beneficiary_data.details?.email && (
                                                            <div className="flex justify-between items-center group pt-2 border-t border-dashed">
                                                                <span className="text-muted-foreground font-medium text-xs">Email:</span>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-xs text-muted-foreground max-w-[150px] truncate">{selectedTx.beneficiary_data.details.email}</span>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-6 w-6"
                                                                        onClick={() => copyToClipboard(selectedTx.beneficiary_data?.details?.email || '')}
                                                                    >
                                                                        <Copy className="w-3 h-3" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-4">
                                            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground border-b pb-1">Acciones Operador</h3>

                                            {/* Completion Proof Upload */}
                                            {selectedTx.status !== 'completed' && selectedTx.status !== 'rejected' && (
                                                <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <FileUp className="w-4 h-4 text-blue-600" />
                                                        <span className="text-xs font-medium text-blue-800">
                                                            {completionFile ? completionFile.name : "Subir comprobante de pago"}
                                                        </span>
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 text-[10px]"
                                                        onClick={() => document.getElementById('admin-completion-upload')?.click()}
                                                    >
                                                        {completionFile ? "Cambiar" : "Seleccionar"}
                                                    </Button>
                                                    <input
                                                        type="file"
                                                        id="admin-completion-upload"
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0]
                                                            if (file) setCompletionFile(file)
                                                        }}
                                                    />
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-3">
                                                <Button className="bg-green-600 hover:bg-green-700 h-11" onClick={() => handleStatusUpdate(selectedTx.id!, 'completed')} disabled={selectedTx.status === 'completed' || isUploading}>
                                                    <Check className="w-4 h-4 mr-2" /> Completar
                                                </Button>
                                                <Button variant="destructive" className="h-11" onClick={() => handleStatusUpdate(selectedTx.id!, 'rejected')} disabled={selectedTx.status === 'rejected' || isUploading}>
                                                    <X className="w-4 h-4 mr-2" /> Rechazar
                                                </Button>
                                                <Button variant="outline" className="col-span-2 h-10" onClick={openReconciliation} disabled={selectedTx.status === 'rejected' || !!(selectedTx as any).deposit}>
                                                    Conciliar Depósito
                                                </Button>

                                                {userRole === 'admin' && (
                                                    <Button variant="ghost" className="col-span-2 h-10 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(selectedTx.id!)} disabled={isUploading}>
                                                        <Trash2 className="w-4 h-4 mr-2" /> Eliminar Operación
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {selectedTx.group_id && (
                                            <div className="space-y-3 pt-4 border-t mt-4">
                                                <h3 className="font-bold text-sm uppercase tracking-wider text-purple-700 flex items-center gap-2">
                                                    <Landmark className="w-4 h-4" /> Otros envíos en este depósito
                                                </h3>
                                                <div className="space-y-2">
                                                    {transactions
                                                        .filter(t => t.group_id === selectedTx.group_id && t.id !== selectedTx.id)
                                                        .map(t => (
                                                            <div key={t.id} className="flex items-center justify-between p-2 border rounded bg-purple-50/30 border-purple-100">
                                                                <div className="text-xs">
                                                                    <div className="font-bold">{t.beneficiary_data?.alias || 'S/N'}</div>
                                                                    <div className="text-muted-foreground">{t.amount_received} {t.currency_received}</div>
                                                                </div>
                                                                <StatusBadge status={t.status} />
                                                            </div>
                                                        ))
                                                    }
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground border-b pb-1">Comprobante Origen</h3>
                                        <div className="border rounded-xl aspect-[3/4] bg-black flex items-center justify-center overflow-hidden">
                                            {selectedTx.payment_proof_url ? (
                                                <img src={selectedTx.payment_proof_url} alt="Comprobante" className="max-h-full max-w-full object-contain cursor-pointer" onClick={() => window.open(selectedTx.payment_proof_url, '_blank')} />
                                            ) : (
                                                <span className="text-muted-foreground text-xs italic">Sin comprobante</span>
                                            )}
                                        </div>
                                    </div>
                                    {(selectedTx.completion_proof_url || completionFile) && (
                                        <div className="space-y-2">
                                            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground border-b pb-1">Liquidación</h3>
                                            <div className="border-2 border-green-200 rounded-xl aspect-[3/4] bg-white flex items-center justify-center overflow-hidden relative">
                                                {completionFile ? (
                                                    <img src={URL.createObjectURL(completionFile)} alt="Preview" className="max-h-full max-w-full object-contain" />
                                                ) : (
                                                    <img src={selectedTx.completion_proof_url} alt="Liquidado" className="max-h-full max-w-full object-contain" />
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
            {
                isReconciliationOpen && selectedTx && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                        <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-200">
                            <CardHeader className="border-b pb-3 sticky top-0 bg-card z-10 transition-colors">
                                <div className="flex justify-between items-center">
                                    <CardTitle>Conciliar Transacción</CardTitle>
                                    <Button variant="ghost" size="icon" onClick={() => setIsReconciliationOpen(false)}>
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                                <CardDescription>
                                    Asocia un depósito bancario a esta operación de <b>{formatCurrency(selectedTx.amount_sent, selectedTx.currency_sent)} {selectedTx.currency_sent}</b>.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-6">
                                {/* Potential Matches */}
                                {potentialMatches.length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="flex items-center gap-2 font-bold text-sm text-green-700 uppercase">
                                            <Check className="w-4 h-4" /> Coincidencias Exactas
                                        </h4>
                                        <div className="space-y-2">
                                            {potentialMatches.map(match => (
                                                <div key={match.id} className="bg-green-50 border border-green-200 p-3 rounded-lg flex justify-between items-center shadow-sm">
                                                    <div>
                                                        <div className="font-bold text-green-900">{formatCurrency(match.amount, match.currency)} {match.currency}</div>
                                                        <div className="text-xs text-green-700">Ref: {match.reference_number} • {match.bank_name || 'Banco desconocido'}</div>
                                                        <div className="text-[10px] text-green-600">Fecha: {new Date(match.created_at || '').toLocaleDateString()}</div>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        className="bg-green-600 hover:bg-green-700"
                                                        onClick={() => handleMatch(match.id!)}
                                                        disabled={matching}
                                                    >
                                                        Conciliar
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* All Deposits Search */}
                                <div className="space-y-3 pt-2 border-t">
                                    <h4 className="font-bold text-sm text-muted-foreground uppercase">Buscar en Todos los Depósitos</h4>
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Buscar por referencia, monto o banco..."
                                            className="pl-9"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                        {allDeposits
                                            .filter(d =>
                                                !potentialMatches.some(p => p.id === d.id) && // Exclude already shown matches
                                                (d.reference_number.includes(searchTerm) ||
                                                    d.amount.toString().includes(searchTerm) ||
                                                    (d.bank_name && d.bank_name.toLowerCase().includes(searchTerm.toLowerCase()))
                                                )
                                            )
                                            .map(deposit => (
                                                <div key={deposit.id} className="bg-muted/20 border p-3 rounded flex justify-between items-center text-sm hover:bg-muted/40 transition-colors">
                                                    <div>
                                                        <div className="font-medium">{formatCurrency(deposit.amount, deposit.currency)} {deposit.currency}</div>
                                                        <div className="text-xs text-muted-foreground">Ref: {deposit.reference_number} • {deposit.bank_name || '-'}</div>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => handleMatch(deposit.id!)}
                                                        disabled={matching}
                                                    >
                                                        Seleccionar
                                                    </Button>
                                                </div>
                                            ))}
                                        {allDeposits.length === 0 && <div className="text-center py-4 text-sm text-muted-foreground">No depósitos disponibles para buscar.</div>}
                                        {allDeposits.length > 0 && allDeposits.filter(d => !potentialMatches.some(p => p.id === d.id) && (d.reference_number.includes(searchTerm) || d.amount.toString().includes(searchTerm) || (d.bank_name && d.bank_name.toLowerCase().includes(searchTerm.toLowerCase())))).length === 0 && <div className="text-center py-4 text-sm text-muted-foreground">No coinciden resultados con la búsqueda.</div>}
                                    </div>
                                </div>

                                <div className="pt-4 border-t flex justify-between items-center bg-gray-50/50 p-2 rounded -mx-2 -mb-2 mt-2">
                                    <span className="text-xs text-muted-foreground">¿No encuentras el depósito?</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                                        onClick={handleVerifyWithoutDeposit}
                                    >
                                        Verificar sin respaldo bancario (Manual)
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )
            }

            <ManualTransactionDialog
                isOpen={isManualModalOpen}
                initialDepositId={preSelectedDepositId}
                onClose={() => {
                    setIsManualModalOpen(false)
                    setPreSelectedDepositId(null)
                }}
                onSuccess={() => {
                    loadTransactions()
                    setIsManualModalOpen(false)
                    setPreSelectedDepositId(null)
                }}
            />
        </div >
    )
}
