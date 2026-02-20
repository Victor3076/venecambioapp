"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, TrendingDown, Landmark, AlertCircle } from "lucide-react"
import { AdjustmentsService } from "@/services/adjustments"
import { SUPPORTED_REGIONS, CURRENCY_LABELS } from "@/lib/constants"

const REGION_TO_CURRENCY: Record<string, string> = {
    'PERU': 'PEN',
    'CHILE': 'CLP',
    'COLOMBIA': 'COP',
    'USA': 'USD',
    'VENEZUELA': 'VES'
}

interface AdjustmentDialogProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    type: 'withdrawal' | 'initialization'
}

export function AdjustmentDialog({ isOpen, onClose, onSuccess, type }: AdjustmentDialogProps) {
    const [loading, setLoading] = useState(false)
    const [region, setRegion] = useState('PERU')
    const [amount, setAmount] = useState('')
    const [description, setDescription] = useState('')

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            alert("Por favor ingresa un monto válido.")
            return
        }

        setLoading(true)
        try {
            await AdjustmentsService.create({
                amount: Number(amount),
                currency: REGION_TO_CURRENCY[region] || region,
                type,
                description: description || (type === 'initialization' ? 'Inicialización de saldo' : 'Retiro manual')
            })

            alert(type === 'initialization' ? "Saldo inicializado con éxito" : "Retiro registrado con éxito")
            onSuccess()
            onClose()
            // Reset form
            setAmount('')
            setDescription('')
        } catch (error: any) {
            console.error(error)
            alert("Error: " + error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSave}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {type === 'initialization' ? (
                                <><Landmark className="w-5 h-5 text-primary" /> Inicializar Saldo</>
                            ) : (
                                <><TrendingDown className="w-5 h-5 text-destructive" /> Registrar Retiro</>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {type === 'initialization'
                                ? "Registra el monto con el que inicias operaciones en esta moneda."
                                : "Registra una salida de dinero (gastos, comisiones, retiros)."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="region">País / Moneda</Label>
                            <select
                                id="region"
                                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={region}
                                onChange={(e) => setRegion(e.target.value)}
                            >
                                {SUPPORTED_REGIONS.map(r => (
                                    <option key={r} value={r}>{CURRENCY_LABELS[r as keyof typeof CURRENCY_LABELS] || r} ({REGION_TO_CURRENCY[r] || r})</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="amount">Monto ({REGION_TO_CURRENCY[region] || region})</Label>
                            <Input
                                id="amount"
                                type="number"
                                step="any"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                required
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="description">Descripción (Opcional)</Label>
                            <Textarea
                                id="description"
                                placeholder={type === 'initialization' ? "Ej: Saldo inicial del día" : "Ej: Pago de comisiones, retiro personal..."}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>

                        {type === 'withdrawal' && (
                            <div className="p-3 bg-destructive/10 text-destructive rounded-lg flex gap-2 text-xs">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>Este monto se restará del saldo total en la vista de Cuadre.</span>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading} variant={type === 'withdrawal' ? 'destructive' : 'default'}>
                            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            {type === 'initialization' ? "Guardar Saldo" : "Confirmar Retiro"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
