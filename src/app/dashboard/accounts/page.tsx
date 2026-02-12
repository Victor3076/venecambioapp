"use client"

import { useState, useEffect } from "react"
import { AccountsService, UserAccount } from "@/services/accounts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, Landmark, User, CreditCard } from "lucide-react"


export default function AccountsPage() {
    const [accounts, setAccounts] = useState<UserAccount[]>([])
    const [loading, setLoading] = useState(true)
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [newAccount, setNewAccount] = useState({
        alias: "",
        country: "VENEZUELA",
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
                country: "VENEZUELA",
                bank_name: "",
                account_number: "",
                details: { id_number: "", email: "", account_type: "", rut: "", venezuela_type: "Cuenta", peru_type: "Cuenta" }
            })
            loadAccounts()
        } catch (error) {
            console.error(error)
            alert("Error al agregar cuenta")
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar esta cuenta?")) return
        try {
            await AccountsService.deleteAccount(id)
            loadAccounts()
        } catch (error) {
            console.error(error)
            alert("Error al eliminar")
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Mis Cuentas</h1>
                {/* Manual Dialog implementation if component is missing, 
                    but I'll use placeholders for components typical in this tech stack */}
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
                                            {acc.country === 'COLOMBIA' ? 'Cédula:' : 'ID:'}
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

            {/* Basic Modal implementation for Add Account */}
            {isAddOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle>Nueva Cuenta</CardTitle>
                            <CardDescription>Ingresa los datos bancarios del beneficiario.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* 1. PAÍS */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">País</label>
                                <select
                                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={newAccount.country}
                                    onChange={e => {
                                        const country = e.target.value;
                                        setNewAccount({
                                            ...newAccount,
                                            country,
                                            bank_name: country === 'PERU' && (newAccount.details.peru_type === 'Yape' || newAccount.details.peru_type === 'Plin') ? newAccount.details.peru_type.toUpperCase() : ""
                                        });
                                    }}
                                >
                                    <option value="VENEZUELA">Venezuela</option>
                                    <option value="PERU">Perú</option>
                                    <option value="CHILE">Chile</option>
                                    <option value="COLOMBIA">Colombia</option>
                                    <option value="USA">USA</option>
                                </select>
                            </div>

                            {/* 2. TIPO (Conditional for Venezuela/Peru) */}
                            {newAccount.country === 'VENEZUELA' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Tipo</label>
                                    <select
                                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={newAccount.details.venezuela_type || "Cuenta"}
                                        onChange={e => setNewAccount({
                                            ...newAccount,
                                            details: { ...newAccount.details, venezuela_type: e.target.value }
                                        })}
                                    >
                                        <option value="Cuenta">Cuenta</option>
                                        <option value="Pago Móvil">Pago Móvil</option>
                                    </select>
                                </div>
                            )}

                            {newAccount.country === 'PERU' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Tipo</label>
                                    <select
                                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={newAccount.details.peru_type || "Cuenta"}
                                        onChange={e => {
                                            const type = e.target.value;
                                            setNewAccount({
                                                ...newAccount,
                                                bank_name: (type === 'Yape' || type === 'Plin') ? type.toUpperCase() : "",
                                                details: { ...newAccount.details, peru_type: type }
                                            })
                                        }}
                                    >
                                        <option value="Cuenta">Cuenta</option>
                                        <option value="Yape">Yape</option>
                                        <option value="Plin">Plin</option>
                                    </select>
                                </div>
                            )}

                            {/* 3. NOMBRE / ALIAS */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Nombre / Alias</label>
                                <Input
                                    placeholder="Ej: Mamá Banesco"
                                    value={newAccount.alias}
                                    onChange={e => setNewAccount({ ...newAccount, alias: e.target.value })}
                                />
                            </div>

                            {/* 4. BANCO & 5. NÚMERO / TELÉFONO (Hidden for USA) */}
                            {newAccount.country !== 'USA' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Banco</label>
                                        {newAccount.country === 'COLOMBIA' ? (
                                            <select
                                                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                value={newAccount.bank_name}
                                                onChange={e => setNewAccount({ ...newAccount, bank_name: e.target.value })}
                                            >
                                                <option value="">Seleccionar Banco...</option>
                                                <option value="BANCOLOMBIA">BANCOLOMBIA</option>
                                                <option value="NEQUI">NEQUI</option>
                                                <option value="LLAVES BRE-B">LLAVES BRE-B</option>
                                            </select>
                                        ) : (newAccount.country === 'PERU' && (newAccount.details.peru_type === 'Yape' || newAccount.details.peru_type === 'Plin')) ? (
                                            <Input
                                                value={newAccount.bank_name}
                                                disabled
                                                className="bg-muted"
                                            />
                                        ) : (
                                            <Input
                                                placeholder="Ej: Banesco"
                                                value={newAccount.bank_name}
                                                onChange={e => setNewAccount({ ...newAccount, bank_name: e.target.value })}
                                            />
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">
                                            {(newAccount.country === 'VENEZUELA' && newAccount.details.venezuela_type === 'Pago Móvil') ||
                                                (newAccount.country === 'PERU' && (newAccount.details.peru_type === 'Yape' || newAccount.details.peru_type === 'Plin')) ||
                                                (newAccount.country === 'COLOMBIA' && (newAccount.bank_name === 'NEQUI' || newAccount.bank_name === 'LLAVES BRE-B'))
                                                ? 'Teléfono'
                                                : 'Cuenta'
                                            }
                                        </label>
                                        <Input
                                            placeholder={
                                                (newAccount.country === 'VENEZUELA' && newAccount.details.venezuela_type === 'Pago Móvil') ||
                                                    (newAccount.country === 'PERU' && (newAccount.details.peru_type === 'Yape' || newAccount.details.peru_type === 'Plin')) ||
                                                    (newAccount.country === 'COLOMBIA' && (newAccount.bank_name === 'NEQUI' || newAccount.bank_name === 'LLAVES BRE-B'))
                                                    ? "310..." : "0102..."
                                            }
                                            value={newAccount.account_number}
                                            onChange={e => {
                                                const val = e.target.value;
                                                const isPhone = (newAccount.country === 'VENEZUELA' && newAccount.details.venezuela_type === 'Pago Móvil') ||
                                                    (newAccount.country === 'PERU' && (newAccount.details.peru_type === 'Yape' || newAccount.details.peru_type === 'Plin')) ||
                                                    (newAccount.country === 'COLOMBIA' && (newAccount.bank_name === 'NEQUI' || newAccount.bank_name === 'LLAVES BRE-B'));

                                                if ((newAccount.country === 'VENEZUELA' || isPhone) && !/^\d*$/.test(val)) return;
                                                setNewAccount({ ...newAccount, account_number: val });
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* USA: Teléfono / Correo */}
                            {newAccount.country === 'USA' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Teléfono / Correo</label>
                                    <Input
                                        placeholder="Ej: +1... o email@example.com"
                                        value={newAccount.account_number}
                                        onChange={e => setNewAccount({ ...newAccount, account_number: e.target.value })}
                                    />
                                </div>
                            )}

                            {/* 6. DETALLES ADICIONALES (Hidden for USA) */}
                            {newAccount.country !== 'USA' && (
                                <div className="grid grid-cols-2 gap-4">
                                    {(newAccount.country === 'CHILE' || newAccount.country === 'COLOMBIA') ? (
                                        <>
                                            {newAccount.country === 'CHILE' && (
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">RUT</label>
                                                    <Input
                                                        placeholder="78.105.121-7"
                                                        value={newAccount.details.rut}
                                                        onChange={e => setNewAccount({
                                                            ...newAccount,
                                                            details: { ...newAccount.details, rut: e.target.value }
                                                        })}
                                                    />
                                                </div>
                                            )}
                                            {newAccount.country === 'COLOMBIA' && (
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">Cédula (Opcional)</label>
                                                    <Input
                                                        placeholder="Ej: 12345678"
                                                        value={newAccount.details.id_number}
                                                        onChange={e => setNewAccount({
                                                            ...newAccount,
                                                            details: { ...newAccount.details, id_number: e.target.value }
                                                        })}
                                                    />
                                                </div>
                                            )}
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">
                                                    Tipo de Cuenta {newAccount.country === 'COLOMBIA' && '(Opcional)'}
                                                </label>
                                                <select
                                                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                    value={newAccount.details.account_type}
                                                    onChange={e => setNewAccount({
                                                        ...newAccount,
                                                        details: { ...newAccount.details, account_type: e.target.value }
                                                    })}
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {newAccount.country === 'COLOMBIA' ? (
                                                        <>
                                                            <option value="Corriente">Corriente</option>
                                                            <option value="Ahorro">Ahorro</option>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <option value="Vista">Vista</option>
                                                            <option value="Corriente">Corriente</option>
                                                            <option value="Ahorro">Ahorro</option>
                                                            {newAccount.country === 'CHILE' && <option value="RUT">RUT (Banco Estado)</option>}
                                                        </>
                                                    )}
                                                </select>
                                            </div>
                                            {newAccount.country === 'CHILE' && (
                                                <div className="space-y-2 col-span-2">
                                                    <label className="text-sm font-medium">Correo Electrónico</label>
                                                    <Input
                                                        type="email"
                                                        placeholder="ejemplo@correo.com"
                                                        value={newAccount.details.email}
                                                        onChange={e => setNewAccount({
                                                            ...newAccount,
                                                            details: { ...newAccount.details, email: e.target.value }
                                                        })}
                                                    />
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {newAccount.country !== 'PERU' && (
                                                <div className="space-y-2 col-span-2">
                                                    <label className="text-sm font-medium">Documento (solo números)</label>
                                                    <Input
                                                        placeholder="12345678"
                                                        value={newAccount.details.id_number}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            // Validar solo números si es Venezuela
                                                            if (newAccount.country === 'VENEZUELA' && !/^\d*$/.test(val)) return;
                                                            setNewAccount({
                                                                ...newAccount,
                                                                details: { ...newAccount.details, id_number: val }
                                                            });
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
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
