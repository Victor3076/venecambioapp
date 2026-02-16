import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { X, Loader2 } from "lucide-react"

interface AddAccountDialogProps {
    userId: string
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export function AddAccountDialog({ userId, isOpen, onClose, onSuccess }: AddAccountDialogProps) {
    const [loading, setLoading] = useState(false)
    const [newAccount, setNewAccount] = useState({
        alias: "",
        country: "VENEZUELA",
        bank_name: "",
        account_number: "",
        details: { id_number: "", email: "", account_type: "", rut: "", venezuela_type: "Cuenta", peru_type: "Cuenta" }
    })

    if (!isOpen) return null

    const handleSave = async () => {
        setLoading(true)
        try {
            // Validate basic fields
            if (!newAccount.alias || !newAccount.country || !newAccount.bank_name || !newAccount.account_number) {
                alert("Por favor completa los campos obligatorios")
                setLoading(false)
                return
            }

            const { error } = await supabase
                .from('user_accounts')
                .insert([{
                    user_id: userId,
                    alias: newAccount.alias,
                    country: newAccount.country,
                    bank_name: newAccount.bank_name,
                    account_number: newAccount.account_number,
                    details: newAccount.details
                }])

            if (error) throw error

            alert("Cuenta agregada correctamente")
            onSuccess()
            onClose()
            // Reset form
            setNewAccount({
                alias: "",
                country: "VENEZUELA",
                bank_name: "",
                account_number: "",
                details: { id_number: "", email: "", account_type: "", rut: "", venezuela_type: "Cuenta", peru_type: "Cuenta" }
            })
        } catch (error: any) {
            console.error(error)
            alert("Error al agregar cuenta: " + error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md relative max-h-[90vh] overflow-y-auto">
                <Button variant="ghost" size="icon" className="absolute right-2 top-2" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
                <CardHeader>
                    <CardTitle>Agregar Cuenta Bancaria</CardTitle>
                    <CardDescription>Esta cuenta se guardará en el perfil del cliente.</CardDescription>
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
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Guardar Cuenta
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
