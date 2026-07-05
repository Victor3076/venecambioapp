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
        toast.info("Procesando imagen para OCR...", { id: "ocr-toast" })
        
        try {
            // PREPROCESAMIENTO DE IMAGEN (Escalar, Blanco y Negro, Umbral) para que Tesseract no lea ruido
            const processedImageBase64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new window.Image(); // Use window.Image to avoid conflict
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        // Reducir la resolución a máximo 1200px de ancho para que no consuma tanta RAM ni tarde horas
                        const MAX_WIDTH = 1200;
                        let width = img.width;
                        let height = img.height;
                        
                        if (width > MAX_WIDTH) {
                            height = Math.round((height * MAX_WIDTH) / width);
                            width = MAX_WIDTH;
                        }
                        
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) return resolve(event.target?.result as string);
                        
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        const imageData = ctx.getImageData(0, 0, width, height);
                        const data = imageData.data;
                        
                        // Convertir a blanco y negro puro (Binarización)
                        for (let i = 0; i < data.length; i += 4) {
                            const r = data[i], g = data[i + 1], b = data[i + 2];
                            // Escala de grises recomendada para humanos y OCR
                            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                            // Umbral (130 suele ser un buen punto medio para quitar sombras de fondo)
                            const color = gray > 130 ? 255 : 0;
                            data[i] = color;
                            data[i + 1] = color;
                            data[i + 2] = color;
                        }
                        
                        ctx.putImageData(imageData, 0, 0);
                        resolve(canvas.toDataURL('image/jpeg', 0.9));
                    };
                    img.onerror = reject;
                    img.src = event.target?.result as string;
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            toast.info("Escaneando factura, por favor espera...", { id: "ocr-toast" })
            const worker = await createWorker('spa')
            const { data: { text } } = await worker.recognize(processedImageBase64)
            await worker.terminate()
            
            const lines = text.split('\n').map(l => l.trim()).filter(l => l !== '')
            
            let maxAmount = 0
            let amountFromTotalLine = 0
            
            for (const line of lines) {
                // Relajar al máximo: buscar cualquier bloque que tenga números, puntos, comas y espacios.
                const numberGroups = line.match(/[\d\s.,]{4,}/g) || []
                
                for (const group of numberGroups) {
                    // Limpiar todo lo que no sea dígito
                    const digitsOnly = group.replace(/\D/g, '')
                    
                    if (digitsOnly.length >= 3 && digitsOnly.length <= 8) {
                        const numValue = parseInt(digitsOnly, 10) / 100
                        
                        if (numValue > maxAmount) {
                            maxAmount = numValue
                        }
                        
                        if (/(TOTAL|PAGAR|MONTO|BS|IMPORTE)/i.test(line)) {
                            if (numValue > amountFromTotalLine) {
                                amountFromTotalLine = numValue
                            }
                        }
                    }
                }
            }
            
            const finalAmount = amountFromTotalLine > 0 ? amountFromTotalLine : maxAmount
            
            let foundAmount = ''
            if (finalAmount > 0) {
                foundAmount = finalAmount.toFixed(2)
            }
            
            if (foundAmount) {
                setAmount(foundAmount)
                toast.success("Monto extraído de la factura", { id: "ocr-toast" })
                setDescription("OCR RAW: " + text.replace(/\n/g, ' | '))
            } else {
                toast.error("No se pudo detectar el monto con claridad.", { id: "ocr-toast" })
                setDescription("OCR RAW: " + text.replace(/\n/g, ' | '))
            }
            
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
