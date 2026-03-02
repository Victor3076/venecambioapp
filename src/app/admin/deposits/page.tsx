"use client"

import { useState, useEffect } from "react"
import { BankDepositsService, BankDeposit } from "@/services/bank-deposits"
import { toast } from "sonner"
import { TransactionsService, Transaction } from "@/services/transactions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

import { Plus, Search, RefreshCw, ArrowLeft, Check, X, Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { CURRENCY_LABELS, SUPPORTED_REGIONS } from "@/lib/constants"
import { formatCurrency } from "@/lib/rates-utils"

export default function BankDepositsPage() {
    const [deposits, setDeposits] = useState<BankDeposit[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)

    // Form State
    const [amount, setAmount] = useState("")
    const [currency, setCurrency] = useState("VES")
    const [reference, setReference] = useState("")
    const [bankName, setBankName] = useState("")
    const [notes, setNotes] = useState("")
    const [editingId, setEditingId] = useState<string | null>(null)
    const [filterCurrencyList, setFilterCurrencyList] = useState<string>('all')

    // Reconciliation State
    const [selectedDeposit, setSelectedDeposit] = useState<BankDeposit | null>(null)
    const [pendingTransactions, setPendingTransactions] = useState<(Transaction & { profiles: { email: string, full_name: string } })[]>([])
    const [matching, setMatching] = useState(false)
    const [txSearchTerm, setTxSearchTerm] = useState("")

    const loadDeposits = async () => {
        setLoading(true)
        try {
            const data = await BankDepositsService.getAll()
            setDeposits(data || [])
        } catch (error) {
            console.error("Error loading deposits:", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadDeposits()
    }, [])

    const handleCreateOrUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreating(true)
        try {
            const depositData = {
                amount: parseFloat(amount),
                currency,
                reference_number: reference,
                bank_name: bankName,
                notes: notes
            }

            if (editingId) {
                await BankDepositsService.update(editingId, depositData)
                toast.success("Depósito actualizado exitosamente.")
            } else {
                await BankDepositsService.create(depositData)
                toast.success("Depósito registrado exitosamente.")
            }

            // Reset form
            setAmount("")
            setReference("")
            setBankName("")
            setNotes("")
            setEditingId(null)
            loadDeposits()
        } catch (error: any) {
            console.error("Error saving deposit:", error)
            toast.error(`Error al guardar depósito: ${error.message || "Error desconocido"}`)
        } finally {
            setCreating(false)
        }
    }

    const startEdit = (deposit: BankDeposit) => {
        setAmount(deposit.amount.toString())
        setCurrency(deposit.currency)
        setReference(deposit.reference_number)
        setBankName(deposit.bank_name || "")
        setNotes(deposit.notes || "")
        setEditingId(deposit.id!)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const cancelEdit = () => {
        setAmount("")
        setReference("")
        setBankName("")
        setNotes("")
        setEditingId(null)
    }

    const handleDelete = async (id: string) => {
        if (!confirm("¿Está seguro de que desea eliminar este depósito? Esta acción no se puede deshacer.")) return

        try {
            await BankDepositsService.delete(id)
            toast.success("Depósito eliminado exitosamente.")
            loadDeposits()
        } catch (error: any) {
            console.error("Error deleting deposit:", error)
            toast.error(`Error al eliminar depósito: ${error.message}`)
        }
    }

    const openReconciliation = async (deposit: BankDeposit) => {
        setSelectedDeposit(deposit)
        setMatching(false)
        setTxSearchTerm("")
        try {
            const txs = await TransactionsService.getVerifying()
            setPendingTransactions(txs || [])
        } catch (error) {
            console.error("Error loading pending transactions:", error)
            toast.error("Error al cargar transacciones pendientes.")
        }
    }

    const handleMatch = async (transactionId: string) => {
        if (!selectedDeposit) return
        if (!confirm("¿Vincular este depósito a la operación seleccionada?")) return

        setMatching(true)
        try {
            await BankDepositsService.match(selectedDeposit.id!, transactionId)
            toast.success("Depósito conciliado exitosamente.")
            setSelectedDeposit(null)
            loadDeposits()
        } catch (error: any) {
            console.error("Error matching:", error)
            toast.error(`Error al conciliar: ${error.message}`)
        } finally {
            setMatching(false)
        }
    }

    return (
        <div className="space-y-6 container py-10">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/admin">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold">Depósitos Bancarios</h1>
                        <p className="text-muted-foreground">Registro manual de ingresos para conciliación.</p>
                    </div>
                </div>
                <Button onClick={loadDeposits} variant="outline" size="icon">
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {/* Form Section */}
                <Card className="md:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle>{editingId ? "Editar Depósito" : "Nuevo Depósito"}</CardTitle>
                        <CardDescription>
                            {editingId ? "Modifica los datos del depósito seleccionado." : "Registra un ingreso bancario."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCreateOrUpdate} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Moneda</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={currency}
                                    onChange={e => setCurrency(e.target.value)}
                                >
                                    <option value="VES">Bolívares (VES)</option>
                                    <option value="USD">Dólares (USD)</option>
                                    <option value="PEN">Soles (PEN)</option>
                                    <option value="COP">Pesos (COP)</option>
                                    <option value="CLP">Pesos (CLP)</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Monto</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Referencia</label>
                                <Input
                                    placeholder="Ej. 12345678"
                                    value={reference}
                                    onChange={e => setReference(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Banco (Opcional)</label>
                                <Input
                                    placeholder="Ej. Banesco"
                                    value={bankName}
                                    onChange={e => setBankName(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Comentario (Opcional)</label>
                                <Input
                                    placeholder="Ej. Pago de fulano..."
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button type="submit" className="flex-1" disabled={creating}>
                                    {creating ? "Guardando..." : editingId ? "Actualizar" : "Registrar"}
                                    {editingId ? <Check className="ml-2 w-4 h-4" /> : <Plus className="ml-2 w-4 h-4" />}
                                </Button>
                                {editingId && (
                                    <Button type="button" variant="outline" onClick={cancelEdit} disabled={creating}>
                                        Cancelar
                                    </Button>
                                )}
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* List Section */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>Depósitos Recientes</CardTitle>
                                <CardDescription>Historial de ingresos registrados.</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Filtrar por:</span>
                                <select
                                    className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs"
                                    value={filterCurrencyList}
                                    onChange={e => setFilterCurrencyList(e.target.value)}
                                >
                                    <option value="all">Todas</option>
                                    <option value="VES">Bolívares (VES)</option>
                                    <option value="USD">Dólares (USD)</option>
                                    <option value="PEN">Soles (PEN)</option>
                                    <option value="COP">Pesos (COP)</option>
                                    <option value="CLP">Pesos (CLP)</option>
                                </select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <div className="grid grid-cols-5 p-4 bg-muted/50 font-medium text-sm">
                                <div>Fecha</div>
                                <div>Referencia</div>
                                <div>Banco</div>
                                <div>Monto</div>
                                <div>Estado</div>
                            </div>
                            {(() => {
                                const filtered = deposits.filter(d => filterCurrencyList === 'all' || d.currency === filterCurrencyList);
                                if (filtered.length === 0) {
                                    return (
                                        <div className="p-8 text-center text-muted-foreground">
                                            No hay depósitos {filterCurrencyList !== 'all' ? `en ${filterCurrencyList}` : ''} registrados.
                                        </div>
                                    )
                                }
                                return (
                                    <div className="divide-y">
                                        {filtered.map(deposit => (
                                            <div key={deposit.id} className="grid grid-cols-5 p-4 text-sm items-center hover:bg-muted/10">
                                                <div className="text-muted-foreground text-xs">
                                                    {new Date(deposit.created_at || "").toLocaleDateString()}
                                                </div>
                                                <div className="font-mono">{deposit.reference_number}</div>
                                                <div className="truncate pr-2">
                                                    <div className="font-medium">
                                                        {deposit.bank_name || "-"}
                                                        {deposit.notes && <span className="ml-2 text-[10px] text-muted-foreground italic">/ {deposit.notes}</span>}
                                                    </div>
                                                </div>
                                                <div className="font-bold">
                                                    {formatCurrency(deposit.amount, deposit.currency)} {deposit.currency}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${deposit.status === 'matched'
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-blue-100 text-blue-700'
                                                        }`}>
                                                        {deposit.status === 'matched' ? 'Conciliado' : 'Disponible'}
                                                    </span>
                                                    {deposit.status !== 'matched' && (
                                                        <div className="flex items-center gap-1">
                                                            <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => openReconciliation(deposit)}>
                                                                Conciliar
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => startEdit(deposit)}>
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(deposit.id!)}>
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            })()}
                        </div>
                    </CardContent>
                </Card>
            </div>


            {selectedDeposit && (
                <ReconciliationModal
                    deposit={selectedDeposit}
                    transactions={pendingTransactions}
                    onClose={() => setSelectedDeposit(null)}
                    onMatch={handleMatch}
                    matching={matching}
                    searchTerm={txSearchTerm}
                    setSearchTerm={setTxSearchTerm}
                />
            )
            }
        </div >
    )
}

function ReconciliationModal({
    deposit,
    transactions,
    onClose,
    onMatch,
    matching,
    searchTerm,
    setSearchTerm
}: {
    deposit: BankDeposit,
    transactions: (Transaction & { profiles: { email: string, full_name: string } })[],
    onClose: () => void,
    onMatch: (txId: string) => void,
    matching: boolean,
    searchTerm: string,
    setSearchTerm: (s: string) => void
}) {
    // Helper to normalize currency codes (e.g. USA -> USD, PERU -> PEN)
    const normalizeCurrency = (code: string) => {
        const map: Record<string, string> = {
            'USA': 'USD',
            'PERU': 'PEN',
            'CHILE': 'CLP',
            'COLOMBIA': 'COP',
            'VENEZUELA': 'VES'
        }
        return map[code] || code
    }

    // Filter matching currency first, then search term
    const filteredTxs = transactions.filter(tx => {
        // Normalize both sides to ensure matching
        const txCurrency = normalizeCurrency(tx.currency_sent)
        const depositCurrency = normalizeCurrency(deposit.currency)

        const currencyMatch = txCurrency === depositCurrency
        if (!currencyMatch) return false

        const searchLower = searchTerm.toLowerCase()
        return (
            tx.profiles?.full_name?.toLowerCase().includes(searchLower) ||
            tx.amount_sent.toString().includes(searchLower) ||
            tx.id?.includes(searchLower)
        )
    })

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
                <CardHeader className="border-b pb-3 bg-card">
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Conciliar Depósito</CardTitle>
                            <CardDescription className="font-mono mt-1 text-primary font-bold">
                                Ref: {deposit.reference_number} • {formatCurrency(deposit.amount, deposit.currency)} {deposit.currency}
                            </CardDescription>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4 overflow-y-auto flex-1">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar operación por nombre o monto..."
                            className="pl-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">Operaciones Pendientes ({filteredTxs.length})</h4>
                        {filteredTxs.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                                {transactions.length === 0 ? "No hay operaciones pendientes para revisar." : "No se encontraron operaciones coincidentes."}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredTxs.map(tx => (
                                    <div key={tx.id} className="border rounded-lg p-3 hover:bg-muted/40 transition-colors flex justify-between items-center group">
                                        <div className="space-y-1">
                                            <div className="font-bold flex items-center gap-2">
                                                {tx.profiles?.full_name || 'Usuario desconocido'}
                                                <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full font-normal uppercase">
                                                    Por Verificar
                                                </span>
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Enviado: <span className="font-medium text-foreground">{formatCurrency(tx.amount_sent, tx.currency_sent)} {tx.currency_sent}</span>
                                                <span className="mx-1">→</span>
                                                Recibe: {formatCurrency(tx.amount_received, tx.currency_received)} {tx.currency_received}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground">
                                                {new Date(tx.created_at!).toLocaleString()}
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-green-600 hover:bg-green-700"
                                            onClick={() => onMatch(tx.id!)}
                                            disabled={matching}
                                        >
                                            <Check className="w-4 h-4 mr-1" /> Vincular
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
