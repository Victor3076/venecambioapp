"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Save, Calculator, RefreshCw, ArrowLeft, Bell, Power, AlertTriangle, MessageSquare } from "lucide-react"
import { RatesService } from "@/services/rates"
import { NotificationsService } from "@/services/notifications"
import { AdminSettingsService, AdminSettings } from "@/services/admin-settings"
import { calculateRate, formatRate, getRateDecimals } from "@/lib/rates-utils"

export default function RatesPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

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
        </div>
    )
}
