"use client"

import { useState, useEffect } from "react"
import { PaymentMethodsService, PaymentMethod } from "@/services/payment-methods"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import {
    Plus,
    Trash2,
    Power,
    PowerOff,
    Landmark,
    Loader2,
    Globe,
    CreditCard,
    ArrowLeft
} from "lucide-react"
import { SUPPORTED_REGIONS, CURRENCY_LABELS } from "@/lib/constants"

export default function AdminPaymentMethodsPage() {
    const [methods, setMethods] = useState<PaymentMethod[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreating, setIsCreating] = useState(false)
    const [newMethod, setNewMethod] = useState<Partial<PaymentMethod>>({
        country: 'PERU',
        method_type: 'Transferencia',
        bank_name: '',
        account_number: '',
        holder_name: '',
        details: { account_type: '', rut: '', id_number: '', email: '' },
        is_active: true
    })

    useEffect(() => {
        loadMethods()
    }, [])

    const loadMethods = async () => {
        setLoading(true)
        try {
            const data = await PaymentMethodsService.getAll()
            setMethods(data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsCreating(true)
        try {
            await PaymentMethodsService.create(newMethod as any)
            setNewMethod({
                country: 'PERU',
                method_type: 'Transferencia',
                bank_name: '',
                account_number: '',
                holder_name: '',
                details: { account_type: '', rut: '', id_number: '', email: '' },
                is_active: true
            })
            loadMethods()
        } catch (error) {
            console.error(error)
            alert("Error al crear método")
        } finally {
            setIsCreating(false)
        }
    }

    const toggleStatus = async (method: PaymentMethod) => {
        try {
            await PaymentMethodsService.update(method.id, { is_active: !method.is_active })
            loadMethods()
        } catch (error) {
            console.error(error)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar este método de pago?")) return
        try {
            await PaymentMethodsService.delete(id)
            loadMethods()
        } catch (error) {
            console.error(error)
        }
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto p-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Cuentas de la Empresa</h1>
                    <p className="text-muted-foreground">Configura los datos donde tus clientes deben transferir.</p>
                </div>
                <Link href="/admin">
                    <Button variant="outline" className="flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" />
                        Regresar al Panel
                    </Button>
                </Link>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {/* Formulario */}
                <Card className="md:col-span-1 shadow-lg border-2 border-primary/10">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Plus className="w-5 h-5 text-primary" /> Nuevo Método
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">País</label>
                                <select
                                    className="w-full p-2 rounded-md border bg-background"
                                    value={newMethod.country}
                                    onChange={e => setNewMethod({ ...newMethod, country: e.target.value })}
                                >
                                    {SUPPORTED_REGIONS.map(r => (
                                        <option key={r} value={r}>{CURRENCY_LABELS[r] || r}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Nombre del Banco / App</label>
                                {newMethod.country === 'COLOMBIA' ? (
                                    <select
                                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={newMethod.bank_name}
                                        onChange={e => setNewMethod({ ...newMethod, bank_name: e.target.value })}
                                    >
                                        <option value="">Seleccionar Banco...</option>
                                        <option value="BANCOLOMBIA">BANCOLOMBIA</option>
                                        <option value="NEQUI">NEQUI</option>
                                        <option value="LLAVES BRE-B">LLAVES BRE-B</option>
                                    </select>
                                ) : (
                                    <Input
                                        placeholder="Ej: BCP, Yape, Zelle..."
                                        value={newMethod.bank_name}
                                        onChange={e => setNewMethod({ ...newMethod, bank_name: e.target.value })}
                                        required
                                    />
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Número de Cuenta / Teléfono</label>
                                <Input
                                    placeholder="191-..."
                                    value={newMethod.account_number}
                                    onChange={e => setNewMethod({ ...newMethod, account_number: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Titular</label>
                                <Input
                                    placeholder="Nombre del titular"
                                    value={newMethod.holder_name}
                                    onChange={e => setNewMethod({ ...newMethod, holder_name: e.target.value })}
                                    required
                                />
                            </div>

                            {(newMethod.country === 'CHILE' || newMethod.country === 'COLOMBIA') && (
                                <div className="space-y-4 pt-2 border-t border-primary/10">
                                    {newMethod.country === 'CHILE' && (
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-primary/80">RUT (Empresa/Personal)</label>
                                            <Input
                                                placeholder="78.105.121-7"
                                                value={newMethod.details?.rut || ''}
                                                onChange={e => setNewMethod({
                                                    ...newMethod,
                                                    details: { ...newMethod.details, rut: e.target.value }
                                                })}
                                            />
                                        </div>
                                    )}
                                    {newMethod.country === 'COLOMBIA' && (
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-primary/80">Cédula (Opcional)</label>
                                            <Input
                                                placeholder="Ej: 12345678"
                                                value={newMethod.details?.id_number || ''}
                                                onChange={e => setNewMethod({
                                                    ...newMethod,
                                                    details: { ...newMethod.details, id_number: e.target.value }
                                                })}
                                            />
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-primary/80">
                                            Tipo de Cuenta {newMethod.country === 'COLOMBIA' && '(Opcional)'}
                                        </label>
                                        <select
                                            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={newMethod.details?.account_type || ''}
                                            onChange={e => setNewMethod({
                                                ...newMethod,
                                                details: { ...newMethod.details, account_type: e.target.value }
                                            })}
                                        >
                                            <option value="">Seleccionar...</option>
                                            {newMethod.country === 'COLOMBIA' ? (
                                                <>
                                                    <option value="Corriente">Corriente</option>
                                                    <option value="Ahorro">Ahorro</option>
                                                </>
                                            ) : (
                                                <>
                                                    <option value="Vista">Vista</option>
                                                    <option value="Corriente">Corriente</option>
                                                    <option value="Ahorro">Ahorro</option>
                                                    {newMethod.country === 'CHILE' && <option value="RUT">RUT (Banco Estado)</option>}
                                                </>
                                            )}
                                        </select>
                                    </div>
                                    {newMethod.country === 'CHILE' && (
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-primary/80">
                                                Correo para Notificación
                                            </label>
                                            <Input
                                                type="email"
                                                placeholder="empresa@correo.com"
                                                value={newMethod.details?.email || ''}
                                                onChange={e => setNewMethod({
                                                    ...newMethod,
                                                    details: { ...newMethod.details, email: e.target.value }
                                                })}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            <Button type="submit" className="w-full" disabled={isCreating}>
                                {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Guardar Cuenta"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Lista */}
                <div className="md:col-span-2 space-y-4">
                    {loading ? (
                        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                    ) : (
                        SUPPORTED_REGIONS.map(region => {
                            const regionMethods = methods.filter(m => m.country === region)
                            if (regionMethods.length === 0) return null

                            return (
                                <Card key={region} className="overflow-hidden border-l-4 border-l-primary shadow-sm">
                                    <CardHeader className="bg-muted/30 py-3">
                                        <div className="flex items-center gap-2 font-bold text-primary">
                                            <Globe className="w-4 h-4" /> {CURRENCY_LABELS[region] || region}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="divide-y">
                                            {regionMethods.map(m => (
                                                <div key={m.id} className="p-4 flex items-center justify-between hover:bg-muted/5 transition-colors">
                                                    <div className="flex items-start gap-3">
                                                        <div className={`p-2 rounded-full ${m.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                                            <CreditCard className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold flex items-center gap-2">
                                                                {m.bank_name}
                                                                {!m.is_active && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase">Inactiva</span>}
                                                            </div>
                                                            <div className="text-sm text-foreground/80 font-mono">{m.account_number}</div>
                                                            <div className="text-xs text-muted-foreground font-semibold flex flex-wrap gap-x-3">
                                                                <span className="uppercase">{m.holder_name}</span>
                                                                {m.details?.rut && <span>RUT: {m.details.rut}</span>}
                                                                {m.details?.id_number && (
                                                                    <span>{m.country === 'COLOMBIA' ? 'Cédula:' : 'ID:'} {m.details.id_number}</span>
                                                                )}
                                                                {m.details?.account_type && <span>{m.details.account_type}</span>}
                                                            </div>
                                                            {m.details?.email && <div className="text-[10px] text-primary/70">{m.details.email}</div>}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            title={m.is_active ? "Desactivar" : "Activar"}
                                                            onClick={() => toggleStatus(m)}
                                                        >
                                                            {m.is_active ? <Power className="w-4 h-4 text-green-600" /> : <PowerOff className="w-4 h-4 text-muted-foreground" />}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive hover:bg-destructive/10"
                                                            onClick={() => handleDelete(m.id)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    )
}
