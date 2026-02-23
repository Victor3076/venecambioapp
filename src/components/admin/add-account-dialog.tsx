"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { AccountsService, UserAccount } from "@/services/accounts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { X, Loader2, Plus, Pencil, Trash2, Landmark, CreditCard, ArrowLeft } from "lucide-react"

interface AddAccountDialogProps {
    userId: string
    userName?: string
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

type View = "list" | "add" | "edit"

const emptyAccount = {
    alias: "",
    country: "VENEZUELA",
    bank_name: "",
    account_number: "",
    details: { id_number: "", email: "", account_type: "", rut: "", venezuela_type: "Cuenta", peru_type: "Cuenta" }
}

export function AddAccountDialog({ userId, userName, isOpen, onClose, onSuccess }: AddAccountDialogProps) {
    const [view, setView] = useState<View>("list")
    const [accounts, setAccounts] = useState<UserAccount[]>([])
    const [loadingAccounts, setLoadingAccounts] = useState(false)
    const [saving, setSaving] = useState(false)
    const [editingAccount, setEditingAccount] = useState<UserAccount | null>(null)
    const [formData, setFormData] = useState(emptyAccount)

    useEffect(() => {
        if (isOpen) {
            setView("list")
            loadAccounts()
        }
    }, [isOpen, userId])

    const loadAccounts = async () => {
        setLoadingAccounts(true)
        const data = await AccountsService.getUserAccounts(userId)
        setAccounts(data)
        setLoadingAccounts(false)
    }

    const openAdd = () => {
        setEditingAccount(null)
        setFormData(emptyAccount)
        setView("add")
    }

    const openEdit = (acc: UserAccount) => {
        setEditingAccount(acc)
        setFormData({
            alias: acc.alias,
            country: acc.country,
            bank_name: acc.bank_name,
            account_number: acc.account_number,
            details: {
                id_number: acc.details?.id_number || "",
                email: acc.details?.email || "",
                account_type: acc.details?.account_type || "",
                rut: acc.details?.rut || "",
                venezuela_type: acc.details?.venezuela_type || "Cuenta",
                peru_type: acc.details?.peru_type || "Cuenta",
            }
        })
        setView("edit")
    }

    const handleDelete = async (acc: UserAccount) => {
        if (!confirm(`¿Eliminar la cuenta "${acc.alias}"?`)) return
        try {
            await AccountsService.deleteAccount(acc.id!)
            toast.success("Cuenta eliminada")
            loadAccounts()
            onSuccess()
        } catch (e: any) {
            toast.error("Error al eliminar: " + e.message)
        }
    }

    const handleSave = async () => {
        if (!formData.alias || !formData.country || !formData.bank_name || !formData.account_number) {
            toast.error("Por favor completa los campos obligatorios")
            return
        }
        setSaving(true)
        try {
            if (view === "edit" && editingAccount) {
                await AccountsService.updateAccount(editingAccount.id!, {
                    alias: formData.alias,
                    country: formData.country,
                    bank_name: formData.bank_name,
                    account_number: formData.account_number,
                    details: formData.details,
                })
                toast.success("Cuenta actualizada correctamente")
            } else {
                await AccountsService.createAccountForUser(userId, {
                    alias: formData.alias,
                    country: formData.country,
                    bank_name: formData.bank_name,
                    account_number: formData.account_number,
                    details: formData.details,
                })
                toast.success("Cuenta agregada correctamente")
            }
            onSuccess()
            await loadAccounts()
            setView("list")
        } catch (e: any) {
            toast.error("Error: " + e.message)
        } finally {
            setSaving(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-lg relative max-h-[92vh] overflow-y-auto">
                <Button variant="ghost" size="icon" className="absolute right-2 top-2 z-10" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>

                {/* ── VISTA: LISTA ── */}
                {view === "list" && (
                    <>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Landmark className="h-5 w-5 text-primary" />
                                Cuentas Bancarias
                            </CardTitle>
                            <CardDescription>
                                {userName ? `Cliente: ${userName}` : "Cuentas guardadas del cliente"}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {loadingAccounts ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
                                </div>
                            ) : accounts.length === 0 ? (
                                <div className="text-center py-10 border-2 border-dashed rounded-xl text-muted-foreground space-y-2">
                                    <Landmark className="mx-auto h-10 w-10 opacity-40" />
                                    <p className="font-medium">Este cliente no tiene cuentas guardadas</p>
                                    <p className="text-sm">Agrega su primera cuenta bancaria.</p>
                                </div>
                            ) : (
                                accounts.map(acc => (
                                    <div
                                        key={acc.id}
                                        className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                                    >
                                        <div className="space-y-0.5 flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold text-sm">{acc.alias}</span>
                                                <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{acc.country}</span>
                                            </div>
                                            <div className="text-xs text-muted-foreground">{acc.bank_name}</div>
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <CreditCard className="h-3 w-3 flex-shrink-0" />
                                                <span className="truncate">{acc.account_number}</span>
                                            </div>
                                            {acc.details?.id_number && (
                                                <div className="text-xs text-muted-foreground">
                                                    ID: {acc.details.id_number}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-1 ml-2 flex-shrink-0">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                onClick={() => openEdit(acc)}
                                                title="Editar cuenta"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                onClick={() => handleDelete(acc)}
                                                title="Eliminar cuenta"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                        <CardFooter className="flex justify-between">
                            <Button variant="outline" onClick={onClose}>Cerrar</Button>
                            <Button onClick={openAdd}>
                                <Plus className="mr-2 h-4 w-4" />
                                Agregar Cuenta
                            </Button>
                        </CardFooter>
                    </>
                )}

                {/* ── VISTA: AGREGAR / EDITAR ── */}
                {(view === "add" || view === "edit") && (
                    <>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setView("list")}>
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                                <div>
                                    <CardTitle>{view === "edit" ? "Editar Cuenta" : "Nueva Cuenta"}</CardTitle>
                                    <CardDescription>
                                        {view === "edit"
                                            ? `Editando: ${editingAccount?.alias}`
                                            : "Esta cuenta se guardará en el perfil del cliente."}
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* PAÍS */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">País</label>
                                <select
                                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={formData.country}
                                    onChange={e => {
                                        const country = e.target.value
                                        setFormData({
                                            ...formData,
                                            country,
                                            bank_name: country === 'PERU' && (formData.details.peru_type === 'Yape' || formData.details.peru_type === 'Plin')
                                                ? formData.details.peru_type.toUpperCase() : ""
                                        })
                                    }}
                                >
                                    <option value="VENEZUELA">Venezuela</option>
                                    <option value="PERU">Perú</option>
                                    <option value="CHILE">Chile</option>
                                    <option value="COLOMBIA">Colombia</option>
                                    <option value="USA">USA</option>
                                </select>
                            </div>

                            {/* TIPO Venezuela */}
                            {formData.country === 'VENEZUELA' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Tipo</label>
                                    <select
                                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={formData.details.venezuela_type}
                                        onChange={e => setFormData({ ...formData, details: { ...formData.details, venezuela_type: e.target.value } })}
                                    >
                                        <option value="Cuenta">Cuenta</option>
                                        <option value="Pago Móvil">Pago Móvil</option>
                                    </select>
                                </div>
                            )}

                            {/* TIPO Perú */}
                            {formData.country === 'PERU' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Tipo</label>
                                    <select
                                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={formData.details.peru_type}
                                        onChange={e => {
                                            const type = e.target.value
                                            setFormData({
                                                ...formData,
                                                bank_name: (type === 'Yape' || type === 'Plin') ? type.toUpperCase() : "",
                                                details: { ...formData.details, peru_type: type }
                                            })
                                        }}
                                    >
                                        <option value="Cuenta">Cuenta</option>
                                        <option value="Yape">Yape</option>
                                        <option value="Plin">Plin</option>
                                    </select>
                                </div>
                            )}

                            {/* ALIAS */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Nombre / Alias</label>
                                <Input
                                    placeholder="Ej: Mamá Banesco"
                                    value={formData.alias}
                                    onChange={e => setFormData({ ...formData, alias: e.target.value })}
                                />
                            </div>

                            {/* BANCO + NÚMERO (no USA) */}
                            {formData.country !== 'USA' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Banco</label>
                                        {formData.country === 'COLOMBIA' ? (
                                            <select
                                                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                value={formData.bank_name}
                                                onChange={e => setFormData({ ...formData, bank_name: e.target.value })}
                                            >
                                                <option value="">Seleccionar Banco...</option>
                                                <option value="BANCOLOMBIA">BANCOLOMBIA</option>
                                                <option value="NEQUI">NEQUI</option>
                                                <option value="LLAVES BRE-B">LLAVES BRE-B</option>
                                            </select>
                                        ) : (formData.country === 'PERU' && (formData.details.peru_type === 'Yape' || formData.details.peru_type === 'Plin')) ? (
                                            <Input value={formData.bank_name} disabled className="bg-muted" />
                                        ) : (
                                            <Input
                                                placeholder="Ej: Banesco"
                                                value={formData.bank_name}
                                                onChange={e => setFormData({ ...formData, bank_name: e.target.value })}
                                            />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">
                                            {(formData.country === 'VENEZUELA' && formData.details.venezuela_type === 'Pago Móvil') ||
                                                (formData.country === 'PERU' && (formData.details.peru_type === 'Yape' || formData.details.peru_type === 'Plin')) ||
                                                (formData.country === 'COLOMBIA' && (formData.bank_name === 'NEQUI' || formData.bank_name === 'LLAVES BRE-B'))
                                                ? 'Teléfono' : 'Cuenta'}
                                        </label>
                                        <Input
                                            placeholder={
                                                (formData.country === 'VENEZUELA' && formData.details.venezuela_type === 'Pago Móvil') ||
                                                    (formData.country === 'PERU' && (formData.details.peru_type === 'Yape' || formData.details.peru_type === 'Plin')) ||
                                                    (formData.country === 'COLOMBIA' && (formData.bank_name === 'NEQUI' || formData.bank_name === 'LLAVES BRE-B'))
                                                    ? "310..." : "0102..."
                                            }
                                            value={formData.account_number}
                                            onChange={e => setFormData({ ...formData, account_number: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* USA: Teléfono / Correo */}
                            {formData.country === 'USA' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Teléfono / Correo</label>
                                    <Input
                                        placeholder="Ej: +1... o email@example.com"
                                        value={formData.account_number}
                                        onChange={e => setFormData({ ...formData, account_number: e.target.value })}
                                    />
                                </div>
                            )}

                            {/* DETALLES ADICIONALES */}
                            {formData.country !== 'USA' && (
                                <div className="grid grid-cols-2 gap-4">
                                    {(formData.country === 'CHILE' || formData.country === 'COLOMBIA') ? (
                                        <>
                                            {formData.country === 'CHILE' && (
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">RUT</label>
                                                    <Input
                                                        placeholder="78.105.121-7"
                                                        value={formData.details.rut}
                                                        onChange={e => setFormData({ ...formData, details: { ...formData.details, rut: e.target.value } })}
                                                    />
                                                </div>
                                            )}
                                            {formData.country === 'COLOMBIA' && (
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">Cédula (Opcional)</label>
                                                    <Input
                                                        placeholder="Ej: 12345678"
                                                        value={formData.details.id_number}
                                                        onChange={e => setFormData({ ...formData, details: { ...formData.details, id_number: e.target.value } })}
                                                    />
                                                </div>
                                            )}
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">
                                                    Tipo de Cuenta {formData.country === 'COLOMBIA' && '(Opcional)'}
                                                </label>
                                                <select
                                                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                    value={formData.details.account_type}
                                                    onChange={e => setFormData({ ...formData, details: { ...formData.details, account_type: e.target.value } })}
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {formData.country === 'COLOMBIA' ? (
                                                        <>
                                                            <option value="Corriente">Corriente</option>
                                                            <option value="Ahorro">Ahorro</option>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <option value="Vista">Vista</option>
                                                            <option value="Corriente">Corriente</option>
                                                            <option value="Ahorro">Ahorro</option>
                                                            {formData.country === 'CHILE' && <option value="RUT">RUT (Banco Estado)</option>}
                                                        </>
                                                    )}
                                                </select>
                                            </div>
                                            {formData.country === 'CHILE' && (
                                                <div className="space-y-2 col-span-2">
                                                    <label className="text-sm font-medium">Correo Electrónico</label>
                                                    <Input
                                                        type="email"
                                                        placeholder="ejemplo@correo.com"
                                                        value={formData.details.email}
                                                        onChange={e => setFormData({ ...formData, details: { ...formData.details, email: e.target.value } })}
                                                    />
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {formData.country !== 'PERU' && (
                                                <div className="space-y-2 col-span-2">
                                                    <label className="text-sm font-medium">Documento (solo números)</label>
                                                    <Input
                                                        placeholder="12345678"
                                                        value={formData.details.id_number}
                                                        onChange={e => {
                                                            const val = e.target.value
                                                            if (formData.country === 'VENEZUELA' && !/^\d*$/.test(val)) return
                                                            setFormData({ ...formData, details: { ...formData.details, id_number: val } })
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
                            <Button variant="outline" onClick={() => setView("list")} disabled={saving}>
                                Volver
                            </Button>
                            <Button onClick={handleSave} disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {view === "edit" ? "Guardar Cambios" : "Guardar Cuenta"}
                            </Button>
                        </CardFooter>
                    </>
                )}
            </Card>
        </div>
    )
}
