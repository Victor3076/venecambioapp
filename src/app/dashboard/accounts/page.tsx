"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { AccountsService, UserAccount } from "@/services/accounts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, Landmark, User, CreditCard } from "lucide-react"


import { BeneficiaryForm, BeneficiaryData } from "@/components/BeneficiaryForm"

export default function AccountsPage() {
    const [accounts, setAccounts] = useState<UserAccount[]>([])
    const [loading, setLoading] = useState(true)
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [newAccount, setNewAccount] = useState<BeneficiaryData>({
        alias: "",
        country: "VES",
        bank_name: "",
        account_number: "",
        details: { id_number: "", email: "", account_type: "", rut: "", venezuela_type: "Cuenta", peru_type: "Cuenta" }
    })

    useEffect(() => {
        loadAccounts()
    }, [])

    const loadAccounts = async () => {
        setLoading(true)
        const data = await AccountsService.getMyAccounts()
        setAccounts(data)
        setLoading(false)
    }

    const handleAdd = async () => {
        try {
            await AccountsService.createAccount(newAccount)
            setIsAddOpen(false)
            setNewAccount({
                alias: "",
                country: "VES",
                bank_name: "",
                account_number: "",
                details: { id_number: "", email: "", account_type: "", rut: "", venezuela_type: "Cuenta", peru_type: "Cuenta" }
            })
            loadAccounts()
            toast.success("Cuenta agregada correctamente")
        } catch (error) {
            console.error(error)
            toast.error("Error al agregar cuenta")
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar esta cuenta?")) return
        try {
            await AccountsService.deleteAccount(id)
            loadAccounts()
        } catch (error) {
            console.error(error)
            toast.error("Error al eliminar")
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Mis Cuentas</h1>
                <Button onClick={() => setIsAddOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Agregar Cuenta
                </Button>
            </div>

            {loading ? (
                <div className="text-center py-10">Cargando cuentas...</div>
            ) : accounts.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="py-10 text-center space-y-3">
                        <User className="mx-auto h-12 w-12 text-muted-foreground" />
                        <div className="text-xl font-medium">No hay cuentas guardadas</div>
                        <p className="text-muted-foreground">Agrega los datos de tus beneficiarios para enviar remesas más rápido.</p>
                        <Button variant="outline" onClick={() => setIsAddOpen(true)}>Comenzar aquí</Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {accounts.map(acc => (
                        <Card key={acc.id} className="relative overflow-hidden">
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <Badge variant="secondary" className="mb-2">{acc.country}</Badge>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive h-8 w-8"
                                        onClick={() => handleDelete(acc.id!)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                                <CardTitle className="flex items-center gap-2">
                                    <Landmark className="h-4 w-4 text-primary" /> {acc.alias}
                                </CardTitle>
                                <CardDescription>{acc.bank_name}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex items-center gap-2">
                                    <CreditCard className="h-3 w-3 text-muted-foreground" />
                                    <span>{acc.account_number}</span>
                                </div>
                                {acc.details?.rut && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground font-semibold">RUT:</span>
                                        <span>{acc.details.rut}</span>
                                    </div>
                                )}
                                {acc.details?.account_type && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground font-semibold">Tipo:</span>
                                        <span>{acc.details.account_type}</span>
                                    </div>
                                )}
                                {acc.details?.id_number && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground font-semibold">
                                            {acc.country === 'COP' ? 'Cédula:' : 'ID:'}
                                        </span>
                                        <span>{acc.details.id_number}</span>
                                    </div>
                                )}
                                {acc.details?.email && (
                                    <div className="flex items-center gap-2 truncate">
                                        <span className="text-muted-foreground font-semibold">Email:</span>
                                        <span className="truncate">{acc.details.email}</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {isAddOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle>Nueva Cuenta</CardTitle>
                            <CardDescription>Ingresa los datos bancarios del beneficiario.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <BeneficiaryForm
                                data={newAccount}
                                onChange={setNewAccount}
                            />
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
                            <Button onClick={handleAdd}>Guardar Cuenta</Button>
                        </CardFooter>
                    </Card>
                </div>
            )}
        </div>
    )
}

function Badge({ children, variant = "default", className = "" }: { children: React.ReactNode, variant?: string, className?: string }) {
    const variants: Record<string, string> = {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
    }
    return (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${variants[variant]} ${className}`}>
            {children}
        </span>
    )
}
