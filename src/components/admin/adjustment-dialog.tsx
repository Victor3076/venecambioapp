"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, TrendingDown, Landmark, AlertCircle, X, Scan } from "lucide-react"
import { createWorker } from "tesseract.js"
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
    const [scanning, setScanning] = useState(false)
    const [currency, setCurrency] = useState('PEN')
    const [amount, setAmount] = useState('')
    const [description, setDescription] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

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

    const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setScanning(true)
        toast.info("Escaneando factura, por favor espera...", { id: "ocr-toast" })
        try {
            const worker = await createWorker('spa')
            const { data: { text } } = await worker.recognize(file)
            await worker.terminate()
            
            const lines = text.split('\n').filter(l => l.trim() !== '')
            
            // Recopilar todos los montos con decimales en la factura
            let maxAmount = 0
            let bestMatchStr = ''
            
            for (const line of lines) {
                // Eliminar espacios de la línea para evitar errores de lectura como "15 , 796 . 47"
                const cleanLine = line.replace(/\s+/g, '')
                
                // Expresión regular mejorada: uno o más dígitos, seguido de opcionales separadores de miles, y terminando en un separador y 2 dígitos.
                // Ejemplos válidos: 15796.47, 15.796,47, 15,796.47, 47377,20
                const amountMatches = cleanLine.match(/\d+(?:[.,]\d{3})*[.,]\d{2}/g)
                
                if (amountMatches) {
                    for (const matchStr of amountMatches) {
                        const lastComma = matchStr.lastIndexOf(',')
                        const lastDot = matchStr.lastIndexOf('.')
                        const decimalPos = Math.max(lastComma, lastDot)
                        
                        let numValue = 0
                        if (decimalPos !== -1 && decimalPos > matchStr.length - 4) {
                            const whole = matchStr.substring(0, decimalPos).replace(/[.,]/g, '')
                            const dec = matchStr.substring(decimalPos + 1)
                            numValue = parseFloat(`${whole}.${dec}`)
                        } else {
                            numValue = parseFloat(matchStr.replace(/[.,]/g, ''))
                        }
                        
                        // Ignorar montos absurdamente grandes que puedan ser errores de lectura de RIFs u otros códigos
                        if (numValue > maxAmount && numValue < 1000000) {
                            maxAmount = numValue
                            bestMatchStr = numValue.toFixed(2)
                        }
                    }
                }
            }
            
            let foundAmount = ''
            if (maxAmount > 0) {
                foundAmount = bestMatchStr
            }
            
            if (foundAmount) {
                setAmount(foundAmount)
                toast.success("Monto extraído de la factura", { id: "ocr-toast" })
            } else {
                toast.error("No se pudo detectar el monto con claridad.", { id: "ocr-toast" })
            }
            
            // Intentar extraer el nombre de la tienda (evitando caracteres raros)
            let storeName = 'FACTURA'
            for (const line of lines) {
                // Si la línea tiene al menos 5 caracteres y solo contiene letras y espacios, probablemente sea el nombre
                if (/^[A-Za-zÑñÁáÉéÍíÓóÚú\s]{5,30}$/.test(line.trim())) {
                    storeName = line.trim()
                    break
                }
            }
            
            setDescription(storeName)
            
        } catch (error) {
            console.error(error)
            toast.error("Error al escanear la imagen", { id: "ocr-toast" })
        } finally {
            setScanning(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

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
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium">Monto ({currency})</label>
                                {type === 'withdrawal' && currency === 'VES' && (
                                    <>
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            capture="environment"
                                            ref={fileInputRef} 
                                            className="hidden" 
                                            onChange={handleScan}
                                        />
                                        <Button 
                                            type="button" 
                                            variant="secondary" 
                                            size="sm" 
                                            className="h-7 text-xs px-2"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={scanning}
                                        >
                                            {scanning ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Scan className="w-3 h-3 mr-1" />}
                                            Escanear
                                        </Button>
                                    </>
                                )}
                            </div>
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
