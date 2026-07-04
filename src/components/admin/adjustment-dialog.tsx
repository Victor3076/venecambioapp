"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, TrendingDown, Landmark, AlertCircle, X } from "lucide-react"
import { AdjustmentsService, CashflowAdjustment } from "@/services/adjustments"
import { SUPPORTED_REGIONS, CURRENCY_LABELS } from "@/lib/constants"

interface AdjustmentDialogProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    type: 'withdrawal' | 'initialization'
    adjustmentToEdit?: CashflowAdjustment | null
}

export function AdjustmentDialog({ isOpen, onClose, onSuccess, type, adjustmentToEdit }: AdjustmentDialogProps) {
    const [loading, setLoading] = useState(false)
    const [currency, setCurrency] = useState('PEN')
    const [amount, setAmount] = useState('')
    const [description, setDescription] = useState('')

    // Populate form if editing or reset when closed/new
    useEffect(() => {
        if (isOpen) {
            if (adjustmentToEdit) {
                setAmount(adjustmentToEdit.amount.toString())
                setDescription(adjustmentToEdit.description || '')
                setCurrency(adjustmentToEdit.currency || 'PEN')
            } else {
                setAmount('')
                setDescription('')
                setCurrency('PEN')
            }
        } else {
            setAmount('')
            setDescription('')
            setCurrency('PEN')
        }
    }, [isOpen, adjustmentToEdit])

    if (!isOpen) return null

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            toast.error("Por favor ingresa un monto válido.")
            return
        }

        setLoading(true)
        try {
            if (adjustmentToEdit && adjustmentToEdit.id) {
                await AdjustmentsService.update(adjustmentToEdit.id, {
                    amount: Number(amount),
                    currency: currency,
                    description: description || (type === 'initialization' ? 'Inicialización de saldo' : 'Retiro manual')
                })
                toast.success("Registro actualizado exitosamente")
            } else {
                await AdjustmentsService.create({
                    amount: Number(amount),
                    currency: currency,
                    type,
                    description: description || (type === 'initialization' ? 'Inicialización de saldo' : 'Retiro manual')
                })
                toast.success(type === 'initialization' ? "Saldo inicializado con éxito" : "Retiro registrado con éxito")
            }

            onSuccess()
            onClose()
            // Reset form
            setAmount('')
            setDescription('')
        } catch (error: any) {
            console.error(error)
            toast.error("Error: " + error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in duration-200">
            <Card className="w-full max-w-[425px] shadow-2xl border-none">
                <form onSubmit={handleSave}>
                    <CardHeader className="border-b relative">
                        <CardTitle className="flex items-center gap-2">
                            {type === 'initialization' ? (
                                <><Landmark className="w-5 h-5 text-primary" /> {adjustmentToEdit ? "Editar Inicialización" : "Inicializar Saldo"}</>
                            ) : (
                                <><TrendingDown className="w-5 h-5 text-destructive" /> {adjustmentToEdit ? "Editar Retiro" : "Registrar Retiro"}</>
                            )}
                        </CardTitle>
                        <CardDescription>
                            {type === 'initialization'
                                ? "Registra el monto con el que inicias operaciones."
                                : "Registra una salida de dinero (gastos, comisiones)."}
                        </CardDescription>
                        <Button variant="ghost" size="icon" onClick={onClose} className="absolute right-4 top-4 rounded-full" type="button">
                            <X className="h-4 w-4" />
                        </Button>
                    </CardHeader>

                    <CardContent className="grid gap-4 py-6">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">País / Moneda</label>
                            <select
                                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                            >
                                {SUPPORTED_REGIONS.map(r => (
                                    <option key={r} value={r}>{CURRENCY_LABELS[r as keyof typeof CURRENCY_LABELS] || r} ({r})</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Monto ({currency})</label>
                            <Input
                                type="text"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/,/g, '.');
                                    if (/^\d*\.?\d*$/.test(val)) {
                                        setAmount(val);
                                    }
                                }}
                                required
                                className="h-10"
                            />
                        </div>

                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Descripción (Opcional)</label>
                            <Textarea
                                placeholder={type === 'initialization' ? "Ej: Saldo inicial" : "Ej: Pago de comisiones..."}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="resize-none"
                            />
                        </div>

                        {type === 'withdrawal' && (
                            <div className="p-3 bg-destructive/10 text-destructive rounded-lg flex gap-2 text-xs">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>Este monto se restará del saldo total.</span>
                            </div>
                        )}
                    </CardContent>

                    <CardFooter className="border-t bg-muted/30 p-4 gap-3">
                        <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" className="flex-1" disabled={loading} variant={type === 'withdrawal' ? 'destructive' : 'default'}>
                            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            {adjustmentToEdit ? "Actualizar" : (type === 'initialization' ? "Guardar Saldo" : "Confirmar Retiro")}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
