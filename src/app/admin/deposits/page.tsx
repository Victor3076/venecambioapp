"use client"

import { useState, useEffect } from "react"
import { BankDepositsService, BankDeposit } from "@/services/bank-deposits"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

import { Plus, Search, RefreshCw, ArrowLeft } from "lucide-react"
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

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreating(true)
        try {
            await BankDepositsService.create({
                amount: parseFloat(amount),
                currency,
                reference_number: reference,
                bank_name: bankName
            })
            // Reset form
            setAmount("")
            setReference("")
            setBankName("")
            loadDeposits()
        } catch (error: any) {
            console.error("Error creating deposit:", error)
            alert(`Error al crear depósito: ${error.message || JSON.stringify(error)}`)
        } finally {
            setCreating(false)
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
                        <CardTitle>Nuevo Depósito</CardTitle>
                        <CardDescription>Registra un ingreso bancario.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCreate} className="space-y-4">
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

                            <Button type="submit" className="w-full" disabled={creating}>
                                {creating ? "Guardando..." : "Registrar Depósito"} <Plus className="ml-2 w-4 h-4" />
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* List Section */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Depósitos Recientes</CardTitle>
                        <CardDescription>Historial de ingresos registrados.</CardDescription>
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
                            {deposits.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground">
                                    No hay depósitos registrados.
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {deposits.map(deposit => (
                                        <div key={deposit.id} className="grid grid-cols-5 p-4 text-sm items-center hover:bg-muted/10">
                                            <div className="text-muted-foreground text-xs">
                                                {new Date(deposit.created_at || "").toLocaleDateString()}
                                            </div>
                                            <div className="font-mono">{deposit.reference_number}</div>
                                            <div className="truncate pr-2">{deposit.bank_name || "-"}</div>
                                            <div className="font-bold">
                                                {formatCurrency(deposit.amount)} {deposit.currency}
                                            </div>
                                            <div>
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${deposit.status === 'matched'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {deposit.status === 'matched' ? 'Conciliado' : 'Disponible'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
