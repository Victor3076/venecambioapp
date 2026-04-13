"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, TrendingDown, X, AlertCircle } from "lucide-react"
import { AdjustmentsService } from "@/services/adjustments"

interface ManualDiscountDialogProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export function ManualDiscountDialog({ isOpen, onClose, onSuccess }: ManualDiscountDialogProps) {
    const [loading, setLoading] = useState(false)
    const [amount, setAmount] = useState('')
    const [description, setDescription] = useState('')

    if (!isOpen) return null

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        const numAmount = Number(amount)
        if (!amount || isNaN(numAmount) || numAmount <= 0) {
            toast.error("Por favor ingresa un monto válido.")
            return
        }

        setLoading(true)
        try {
            await AdjustmentsService.create({
                amount: numAmount,
                currency: 'VES',
                type: 'withdrawal',
                description: description || "Descuento Manual (VES)"
            })
            
            toast.success("Descuento registrado con éxito")
            onSuccess()
            onClose()
            // Reset
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
                            <TrendingDown className="w-5 h-5 text-destructive" /> Descuento Manual (VES)
                        </CardTitle>
                        <CardDescription>
                            Registra un descuento que se restará del cuadre de VES.
                        </CardDescription>
                        <Button variant="ghost" size="icon" onClick={onClose} className="absolute right-4 top-4 rounded-full" type="button">
                            <X className="h-4 w-4" />
                        </Button>
                    </CardHeader>

                    <CardContent className="grid gap-4 py-6">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Monto (VES)</label>
                            <Input
                                type="number"
                                step="any"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                required
                                className="h-10 text-lg font-bold"
                                autoFocus
                            />
                        </div>

                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Comentario / Control</label>
                            <Textarea
                                placeholder="Ej: Pago de comisiones, ajuste de tasa, etc."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="resize-none h-24"
                                required
                            />
                        </div>

                        <div className="p-3 bg-amber-50 text-amber-800 rounded-lg flex gap-2 text-xs border border-amber-100">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>Este descuento aparecerá en la lista de operaciones y se restará de los "Retiros" en el balance de VES.</span>
                        </div>
                    </CardContent>

                    <CardFooter className="border-t bg-muted/30 p-4 gap-3">
                        <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" className="flex-1 bg-destructive hover:bg-destructive/90 text-white" disabled={loading}>
                            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            Confirmar Descuento
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
