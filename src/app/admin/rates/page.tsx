"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Save, Calculator, RefreshCw, ArrowLeft, Bell, Power, AlertTriangle, MessageSquare, Image as ImageIcon, Download } from "lucide-react"
import { RatesService } from "@/services/rates"
import { NotificationsService } from "@/services/notifications"
import { AdminSettingsService, AdminSettings } from "@/services/admin-settings"
import { calculateRate, formatRate, getRateDecimals } from "@/lib/rates-utils"
import html2canvas from "html2canvas"

// Helper to render a group of rates
const RateGroup = ({
    title,
    flag,
    currencyCode,
    basePrice,
    percentages,
    usdtPrices,
    onMarginChange
}: {
    title: string,
    flag: string,
    currencyCode: string,
    basePrice: number,
    percentages: Record<string, number>,
    usdtPrices: any,
    onMarginChange: (key: string, val: number) => void
}) => {

    const renderRateRow = (targetName: string, targetCode: string, targetPrice: number) => {
        const marginKey = `${currencyCode}_${targetCode}`;
        const currentMargin = percentages[marginKey] || 0;
        const rate = calculateRate(targetCode, currencyCode, targetPrice, basePrice, currentMargin);

        // Dynamic decimal logic from configuration
        const decimals = getRateDecimals(targetCode, currencyCode);

        const formattedRate = rate.toLocaleString('es-VE', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });

        return (
            <div className="flex flex-col gap-1 border-b pb-2 last:border-0 last:pb-0" key={targetCode}>
                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-muted-foreground">A {targetName} ({targetCode})</span>
                    <span className="font-bold text-lg">
                        {formattedRate}
                    </span>
                </div>
                <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                    <span>Ganancia:</span>
                    <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="h-5 w-16 text-right px-1 text-xs"
                        value={currentMargin}
                        onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            onMarginChange(marginKey, isNaN(val) ? 0 : val)
                        }}
                    />
                    <span>%</span>
                </div>
            </div>
        )
    }

    return (
        <Card className="bg-background border-2">
            <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <span className="text-2xl">{flag}</span> {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
                {currencyCode !== 'PEN' && renderRateRow("Perú", "PEN", usdtPrices.PEN)}
                {currencyCode !== 'CLP' && renderRateRow("Chile", "CLP", usdtPrices.CLP)}
                {currencyCode !== 'COP' && renderRateRow("Colombia", "COP", usdtPrices.COP)}
                {currencyCode !== 'USD' && renderRateRow("USA", "USD", usdtPrices.USD)}

                {/* Venezuela Highlighting */}
                <div className="bg-muted/50 p-2 rounded -mx-2">
                    {renderRateRow("Venezuela", "VES", usdtPrices.VES)}
                </div>
            </CardContent>
        </Card>
    )
}

export default function RatesPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [generating, setGenerating] = useState(false)
    const templateRef = useRef<HTMLDivElement>(null)

    // State for Admin Settings (Open/Closed)
    const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null)
    const [broadcasting, setBroadcasting] = useState(false)
    const [updatingSettings, setUpdatingSettings] = useState(false)
    const [broadcastMessage, setBroadcastMessage] = useState("¡Nuevas tasas de cambio disponibles! Revisa los precios actualizados en la calculadora.")

    // State for USDT base prices
    const [usdtPrices, setUsdtPrices] = useState({
        USD: 1.00,
        PEN: 3.75, // PEN per USDT
        CLP: 980, // CLP per USDT
        COP: 3900, // COP per USDT
        VES: 38.5, // VES per USDT (Calculated/Implicit if needed, or manual)
        MONITOR: 40.5,
        BCV: 39.2
    })

    // State for Percentages (Margins/Gains)
    const [percentages, setPercentages] = useState<Record<string, number>>({
        PEN_VES: 5.0,
        CLP_VES: 7.0,
        COP_VES: 10.0,
        USD_VES: 3.0,
        // Add defaults for others as needed
        GENERIC: 2.0
    })

    // Load initial data
    useEffect(() => {
        const loadData = async () => {
            try {
                const [ratesData, settingsData] = await Promise.all([
                    RatesService.getLatest(),
                    AdminSettingsService.getSettings()
                ])

                if (ratesData) {
                    if (ratesData.usdt_prices) setUsdtPrices(prev => ({ ...prev, ...ratesData.usdt_prices }))
                    if (ratesData.margins) setPercentages(prev => ({ ...prev, ...ratesData.margins }))
                }

                if (settingsData) {
                    setAdminSettings(settingsData)
                } else {
                    // Fallback to default if loading failed (though service now handles missing rows)
                    setAdminSettings({
                        id: 'default',
                        is_open: true,
                        closed_message: 'Nuestro horario de atención es de 10:00 AM a 8:00 PM (Hora Venezuela). Regresa pronto para realizar tus operaciones.',
                        updated_at: new Date().toISOString()
                    })
                }
            } catch (error) {
                console.error("Failed to load settings data", error)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [])

    const handleSave = async () => {
        setSaving(true)
        console.log('--- AdminRates: Guardando valores ---')
        console.log('Valores de referencia:', usdtPrices)
        console.log('Márgenes:', percentages)

        try {
            await RatesService.update(usdtPrices, percentages)
            toast.success("Tasas e Indicadores actualizados correctamente.", {
                description: `Guardados: USD, PEN, CLP, COP, VES, Monitor y BCV.`
            })
        } catch (error: any) {
            console.error("Error saving rates:", error)
            toast.error(`Error al guardar: ${error.message || "Error desconocido"}`)
        } finally {
            setSaving(false)
        }
    }

    const handleBroadcast = async () => {
        if (!confirm("¿Enviar notificación de cambio de tasas a TODOS los clientes?")) return
        setBroadcasting(true)
        try {
            await NotificationsService.broadcast(
                "📈 Tasas Actualizadas",
                broadcastMessage,
                'info'
            )
            toast.success("Notificación enviada a todos los clientes exitosamente.")
        } catch (error: any) {
            console.error("Broadcast error:", error)
            toast.error("Error al enviar notificación masiva.")
        } finally {
            setBroadcasting(false)
        }
    }

    const toggleOperations = async () => {
        if (!adminSettings) return
        const newStatus = !adminSettings.is_open
        if (!confirm(`¿Estás seguro de que deseas ${newStatus ? 'ABRIR' : 'CERRAR'} las operaciones?`)) return

        setUpdatingSettings(true)
        try {
            const updated = await AdminSettingsService.updateSettings({ is_open: newStatus })
            setAdminSettings(updated)
            toast.success(`Operaciones ${newStatus ? 'abiertas' : 'cerradas'} correctamente.`)
        } catch (error) {
            console.error(error)
            toast.error("Error al actualizar estado de operaciones.")
        } finally {
            setUpdatingSettings(false)
        }
    }

    const updateClosedMessage = async () => {
        if (!adminSettings) return
        setUpdatingSettings(true)
        try {
            const updated = await AdminSettingsService.updateSettings({ closed_message: adminSettings.closed_message })
            setAdminSettings(updated)
            toast.success("Mensaje de cierre actualizado.")
        } catch (error) {
            console.error(error)
            toast.error("Error al actualizar mensaje.")
        } finally {
            setUpdatingSettings(false)
        }
    }

    const onMarginChange = (key: string, val: number) => {
        setPercentages(prev => ({ ...prev, [key]: val }))
    }

    const handleGenerateImage = async () => {
        if (!templateRef.current) return
        setGenerating(true)
        try {
            // Give browser time to ensure images are loaded
            await new Promise(resolve => setTimeout(resolve, 800))

            const canvas = await html2canvas(templateRef.current, {
                useCORS: true,
                scale: 2,
                backgroundColor: "#2563eb", // Fallback to blue-600
                logging: false,
                onclone: (clonedDoc) => {
                    // Ensure the cloned element is "visible" for height/width calculations
                    const el = clonedDoc.querySelector('[data-id="whatsapp-template"]') as HTMLElement
                    if (el) {
                        el.style.position = 'relative'
                        el.style.left = '0'
                        el.style.opacity = '1'
                    }
                }
            })

            const image = canvas.toDataURL("image/png")
            const link = document.createElement("a")
            link.href = image
            link.download = `tasas-venecambio-${new Date().toLocaleDateString().replace(/\//g, '-')}.png`
            link.click()
            toast.success("Imagen generada y descargada correctamente.")
        } catch (error: any) {
            console.error("Error generating image:", error)
            toast.error("Error al generar la imagen: " + (error.message || "Por favor intenta de nuevo."))
        } finally {
            setGenerating(false)
        }
    }

    const getFormattedRate = (source: string) => {
        const target = 'VES'
        const marginKey = `${source}_${target}`
        const margin = percentages[marginKey] || percentages['GENERIC'] || 0
        const rate = calculateRate(target, source, usdtPrices.VES, usdtPrices[source as keyof typeof usdtPrices], margin)
        const decimals = getRateDecimals(target, source)

        return rate.toLocaleString('es-VE', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        })
    }

    if (loading) return <div className="p-6">Cargando tasas...</div>

    return (
        <div className="grid gap-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/admin">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-semibold">Gestión de Tasas</h1>
                        <p className="text-muted-foreground text-sm">Define los precios base del USDT para calcular las tasas cruzadas.</p>
                    </div>
                </div>
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {saving ? "Guardando..." : "Guardar Valores"}
                </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Valores Ref. (USDT)</CardTitle>
                            <CardDescription>Precio de 1 USDT en local.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-2 items-center">
                                <label className="font-medium text-sm">🇺🇸 USA ($)</label>
                                <Input type="number" value={usdtPrices.USD} onChange={(e) => setUsdtPrices({ ...usdtPrices, USD: parseFloat(e.target.value) })} />
                            </div>
                            <div className="grid grid-cols-2 gap-2 items-center">
                                <label className="font-medium text-sm">🇵🇪 Perú (S/.)</label>
                                <Input type="number" value={usdtPrices.PEN} onChange={(e) => setUsdtPrices({ ...usdtPrices, PEN: parseFloat(e.target.value) })} />
                            </div>
                            <div className="grid grid-cols-2 gap-2 items-center">
                                <label className="font-medium text-sm">🇨🇱 Chile (CLP)</label>
                                <Input type="number" value={usdtPrices.CLP} onChange={(e) => setUsdtPrices({ ...usdtPrices, CLP: parseFloat(e.target.value) })} />
                            </div>
                            <div className="grid grid-cols-2 gap-2 items-center">
                                <label className="font-medium text-sm">🇨🇴 Col (COP)</label>
                                <Input type="number" value={usdtPrices.COP} onChange={(e) => setUsdtPrices({ ...usdtPrices, COP: parseFloat(e.target.value) })} />
                            </div>
                            <div className="grid grid-cols-2 gap-2 items-center">
                                <label className="font-medium text-sm">🇻🇪 Ven (Bs)</label>
                                <Input type="number" value={usdtPrices.VES} onChange={(e) => setUsdtPrices({ ...usdtPrices, VES: parseFloat(e.target.value) })} />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        <Card className="bg-blue-50/50 border-blue-100">
                            <CardHeader>
                                <CardTitle>Indicadores Vzla</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-2 items-center">
                                    <label className="font-medium text-sm">Monitor</label>
                                    <Input type="number" value={usdtPrices.MONITOR} onChange={(e) => setUsdtPrices({ ...usdtPrices, MONITOR: parseFloat(e.target.value) })} />
                                </div>
                                <div className="grid grid-cols-2 gap-2 items-center">
                                    <label className="font-medium text-sm">BCV</label>
                                    <Input type="number" value={usdtPrices.BCV} onChange={(e) => setUsdtPrices({ ...usdtPrices, BCV: parseFloat(e.target.value) })} />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-dashed border-2 border-primary/30">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Generador de Imagen</CardTitle>
                                <CardDescription className="text-xs">Exporta las tasas para WhatsApp Status.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    className="w-full h-12 gap-2 font-bold"
                                    variant="outline"
                                    onClick={handleGenerateImage}
                                    disabled={generating}
                                >
                                    {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                                    {generating ? "Generando..." : "GENERAR IMAGEN"}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <div className="grid sm:grid-cols-2 gap-4">
                        <RateGroup title="Perú (Soles)" flag="🇵🇪" currencyCode="PEN" basePrice={usdtPrices.PEN} percentages={percentages} usdtPrices={usdtPrices} onMarginChange={onMarginChange} />
                        <RateGroup title="Chile (Pesos)" flag="🇨🇱" currencyCode="CLP" basePrice={usdtPrices.CLP} percentages={percentages} usdtPrices={usdtPrices} onMarginChange={onMarginChange} />
                        <RateGroup title="Colombia (Pesos)" flag="🇨🇴" currencyCode="COP" basePrice={usdtPrices.COP} percentages={percentages} usdtPrices={usdtPrices} onMarginChange={onMarginChange} />
                        <RateGroup title="Zelle (USA)" flag="🇺🇸" currencyCode="USD" basePrice={usdtPrices.USD} percentages={percentages} usdtPrices={usdtPrices} onMarginChange={onMarginChange} />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-6 pt-4 border-t">
                        <Card className="border-primary/20 shadow-md">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Bell className="w-4 h-4 text-primary" /> Difusión de Tasas
                                </CardTitle>
                                <CardDescription className="text-xs">Notifica a todos los clientes por push.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <textarea
                                    className="w-full min-h-[80px] text-xs p-2 rounded-md border bg-muted/20"
                                    value={broadcastMessage}
                                    onChange={(e) => setBroadcastMessage(e.target.value)}
                                />
                                <Button className="w-full h-10 gap-2" onClick={handleBroadcast} disabled={broadcasting}>
                                    {broadcasting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                                    Notificar a Todos
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className={`border-2 transition-colors ${adminSettings?.is_open ? 'border-green-100' : 'border-red-200 bg-red-50/10'}`}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Power className={`w-4 h-4 ${adminSettings?.is_open ? 'text-green-600' : 'text-red-600'}`} />
                                        Disponibilidad
                                    </div>
                                    <Badge variant={adminSettings?.is_open ? "default" : "destructive"} className="text-[10px] h-5">
                                        {adminSettings?.is_open ? 'ABIERTO' : 'CERRADO'}
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <textarea
                                        className="w-full min-h-[80px] text-xs p-2 rounded-md border"
                                        value={adminSettings?.closed_message || ""}
                                        onChange={(e) => setAdminSettings(prev => prev ? { ...prev, closed_message: e.target.value } : null)}
                                    />
                                    <Button variant="outline" size="sm" className="w-full h-7 text-[10px]" onClick={updateClosedMessage} disabled={updatingSettings}>
                                        Actualizar Mensaje
                                    </Button>
                                </div>
                                <Button
                                    variant={adminSettings?.is_open ? "destructive" : "default"}
                                    className="w-full h-10 gap-2 font-bold"
                                    onClick={toggleOperations}
                                    disabled={updatingSettings}
                                >
                                    {updatingSettings ? <RefreshCw className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                                    {adminSettings?.is_open ? 'CERRAR OPERACIONES' : 'ABRIR OPERACIONES'}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Hidden WhatsApp Status Template (9:16) */}
            <div className="fixed overflow-hidden opacity-0 pointer-events-none" style={{ left: '-2000px', top: '0' }}>
                <div
                    ref={templateRef}
                    data-id="whatsapp-template"
                    className="w-[1080px] h-[1920px] bg-blue-600 p-12 flex flex-col justify-between text-white font-sans"
                    style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%)' }}
                >
                    {/* Header: Logo and Date */}
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-5xl font-extrabold uppercase tracking-widest opacity-90">Tasas del Día</h2>
                            <p className="text-3xl font-medium mt-2 bg-white/20 px-4 py-1 rounded-full inline-block">
                                {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                        </div>
                        <div className="flex items-center gap-4 bg-white/10 p-6 rounded-3xl">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/logo.png" alt="Logo" className="w-32 h-32 object-contain" />
                            <span className="text-6xl font-black italic">VENECAMBIO</span>
                        </div>
                    </div>

                    {/* Main Content: Rates */}
                    <div className="flex-1 flex flex-col justify-center gap-12 py-20">
                        <div className="text-center space-y-4 mb-8">
                            <span className="text-4xl font-bold p-3 bg-yellow-400 text-blue-900 rounded-lg inline-block shadow-xl">¡ENVIAMOS A VENEZUELA! 🇻🇪</span>
                        </div>

                        {[
                            { name: "Perú (Soles)", label: "1 PEN →", value: getFormattedRate('PEN'), icon: "🇵🇪" },
                            { name: "Chile (Pesos)", label: "1 CLP →", value: getFormattedRate('CLP'), icon: "🇨🇱" },
                            { name: "Colombia (Pesos)", label: "1 COP →", value: getFormattedRate('COP'), icon: "🇨🇴" },
                            { name: "USA (Zelle)", label: "1 USD →", value: getFormattedRate('USD'), icon: "🇺🇸" }
                        ].map((item, idx) => (
                            <div key={idx} className="bg-white text-blue-900 p-10 rounded-[40px] shadow-2xl flex items-center justify-between border-b-[12px] border-gray-200">
                                <div className="flex items-center gap-6">
                                    <span className="text-8xl">{item.icon}</span>
                                    <div className="flex flex-col">
                                        <span className="text-4xl font-black uppercase text-blue-800">{item.name}</span>
                                        <span className="text-5xl font-medium text-gray-500">{item.label}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-9xl font-black text-blue-600 italic">{item.value}</span>
                                    <div className="text-3xl font-bold uppercase tracking-tighter text-blue-400">Bolívares Digitales</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer: Contacts */}
                    <div className="mt-auto space-y-8">
                        <div className="grid grid-cols-2 gap-8">
                            <div className="bg-blue-900/40 p-8 rounded-3xl border border-white/20 text-center">
                                <div className="text-3xl opacity-70 mb-2 font-bold uppercase tracking-widest">Monitor</div>
                                <div className="text-6xl font-black text-yellow-400">{usdtPrices.MONITOR.toLocaleString('es-VE')}</div>
                            </div>
                            <div className="bg-blue-900/40 p-8 rounded-3xl border border-white/20 text-center">
                                <div className="text-3xl opacity-70 mb-2 font-bold uppercase tracking-widest">BCV</div>
                                <div className="text-6xl font-black text-white">{usdtPrices.BCV.toLocaleString('es-VE')}</div>
                            </div>
                        </div>

                        <div className="bg-green-500 p-10 rounded-[40px] shadow-2xl flex items-center justify-center gap-8 border-b-[12px] border-green-700">
                            <svg viewBox="0 0 24 24" width="80" height="80" fill="currentColor" className="text-white">
                                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.767 5.767 0 1.267.405 2.436 1.096 3.391l-.715 2.614 2.684-.705c.82.493 1.774.787 2.796.787 3.181 0 5.767-2.586 5.767-5.767.001-3.181-2.585-5.767-5.761-5.767zm3.387 8.264c-.147.412-.852.792-1.185.839-.333.047-.733.064-1.2-.086-.296-.095-1.263-.487-2.46-1.553-1.02-.91-1.708-2.038-1.907-2.38-.198-.342-.021-.527.151-.699.155-.155.342-.403.513-.605.171-.202.228-.342.342-.57.114-.228.057-.427-.028-.598-.085-.171-.77-1.854-.855-2.062-.232-.563-.513-.57-.855-.57h-.798c-.285 0-.741.107-1.126.541-.385.435-1.481 1.453-1.481 3.535 0 2.083 1.511 4.09 1.725 4.375.214.285 2.97 4.536 7.189 6.354 1.004.433 1.788.691 2.399.885 1.008.32 1.926.275 2.651.167.808-.121 2.479-1.011 2.822-1.983.342-.972.342-1.805.239-1.983-.1-.178-.37-.285-.77-.492z" />
                                <path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.122.551 4.11 1.503 5.836l-1.503 5.49 5.626-1.478a11.97 11.97 0 0 0 6.405 1.838c6.646 0 12.031-5.385 12.031-12.031C24.062 5.385 18.677 0 12.031 0zm.014 21.841a9.754 9.754 0 0 1-4.965-1.358l-.356-.211-3.692.969 1.031-3.766-.231-.387a9.752 9.752 0 0 1-1.492-5.127c0-5.397 4.39-9.787 9.787-9.787 5.397 0 9.787 4.39 9.787 9.787.001 5.398-4.383 9.781-9.87 9.781z" />
                            </svg>
                            <span className="text-8xl font-black tracking-tight">+58 422 717 3725</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
