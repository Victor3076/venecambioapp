"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Save, Calculator, RefreshCw, ArrowLeft, Bell, Power, AlertTriangle, MessageSquare } from "lucide-react"
import { RatesService } from "@/services/rates"
import { NotificationsService } from "@/services/notifications"
import { AdminSettingsService, AdminSettings } from "@/services/admin-settings"
import { calculateRate, formatRate } from "@/lib/rates-utils"

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
        USA: 1.00,
        PERU: 3.75, // PEN per USDT
        CHILE: 980, // CLP per USDT
        COLOMBIA: 3900, // COP per USDT
        VENEZUELA: 38.5, // VES per USDT (Calculated/Implicit if needed, or manual)
        MONITOR: 40.5,
        BCV: 39.2
    })

    // State for Percentages (Margins/Gains)
    const [percentages, setPercentages] = useState<Record<string, number>>({
        PEN_VES: 5.0,
        CLP_VES: 7.0,
        COP_VES: 10.0,
        USA_VES: 3.0,
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
        try {
            await RatesService.update(usdtPrices, percentages)
            alert("Tasas actualizadas correctamente.")
        } catch (error: any) {
            console.error("Error saving rates:", error)
            alert(`Error al guardar: ${error.message || "Error desconocido"}`)
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
            alert("Notificación enviada a todos los clientes exitosamente.")
        } catch (error: any) {
            console.error("Broadcast error:", error)
            alert("Error al enviar notificación masiva.")
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
            alert(`Operaciones ${newStatus ? 'abiertas' : 'cerradas'} correctamente.`)
        } catch (error) {
            console.error(error)
            alert("Error al actualizar estado de operaciones.")
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
            alert("Mensaje de cierre actualizado.")
        } catch (error) {
            console.error(error)
            alert("Error al actualizar mensaje.")
        } finally {
            setUpdatingSettings(false)
        }
    }

    // Helper to render a group of rates
    const RateGroup = ({ title, flag, currencyCode, basePrice }: { title: string, flag: string, currencyCode: string, basePrice: number }) => {

        const renderRateRow = (targetName: string, targetCode: string, targetPrice: number) => {
            const marginKey = `${currencyCode}_${targetCode}`;
            const currentMargin = percentages[marginKey] || 0;
            const rate = calculateRate(targetCode, currencyCode, targetPrice, basePrice, currentMargin);
            const formattedRate = formatRate(rate, targetCode, currencyCode);

            return (
                <div className="flex flex-col gap-1 border-b pb-2 last:border-0 last:pb-0">
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
                                setPercentages(prev => ({ ...prev, [marginKey]: isNaN(val) ? 0 : val }))
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
                    {currencyCode !== 'PERU' && renderRateRow("Perú", "PERU", usdtPrices.PERU)}
                    {currencyCode !== 'CHILE' && renderRateRow("Chile", "CHILE", usdtPrices.CHILE)}
                    {currencyCode !== 'COLOMBIA' && renderRateRow("Colombia", "COLOMBIA", usdtPrices.COLOMBIA)}
                    {currencyCode !== 'USA' && renderRateRow("USA", "USA", usdtPrices.USA)}

                    {/* Venezuela Highlighting */}
                    <div className="bg-muted/50 p-2 rounded -mx-2">
                        {renderRateRow("Venezuela", "VES", usdtPrices.VENEZUELA)}
                    </div>
                </CardContent>
            </Card>
        )
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
                {/* COL 1: INPUTS */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Valores Ref. (USDT)</CardTitle>
                            <CardDescription>Precio de 1 USDT en local.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-2 items-center">
                                <label className="font-medium text-sm">🇺🇸 USA ($)</label>
                                <Input type="number" value={usdtPrices.USA} onChange={(e) => setUsdtPrices({ ...usdtPrices, USA: parseFloat(e.target.value) })} />
                            </div>
                            <div className="grid grid-cols-2 gap-2 items-center">
                                <label className="font-medium text-sm">🇵🇪 Perú (S/.)</label>
                                <Input type="number" value={usdtPrices.PERU} onChange={(e) => setUsdtPrices({ ...usdtPrices, PERU: parseFloat(e.target.value) })} />
                            </div>
                            <div className="grid grid-cols-2 gap-2 items-center">
                                <label className="font-medium text-sm">🇨🇱 Chile (CLP)</label>
                                <Input type="number" value={usdtPrices.CHILE} onChange={(e) => setUsdtPrices({ ...usdtPrices, CHILE: parseFloat(e.target.value) })} />
                            </div>
                            <div className="grid grid-cols-2 gap-2 items-center">
                                <label className="font-medium text-sm">🇨🇴 Col (COP)</label>
                                <Input type="number" value={usdtPrices.COLOMBIA} onChange={(e) => setUsdtPrices({ ...usdtPrices, COLOMBIA: parseFloat(e.target.value) })} />
                            </div>
                            <div className="grid grid-cols-2 gap-2 items-center">
                                <label className="font-medium text-sm">🇻🇪 Ven (Bs)</label>
                                <Input type="number" value={usdtPrices.VENEZUELA} onChange={(e) => setUsdtPrices({ ...usdtPrices, VENEZUELA: parseFloat(e.target.value) })} />
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

                {/* COL 2 & 3: OUTPUT MATRIX */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="grid sm:grid-cols-2 gap-4">
                        <RateGroup title="Perú (Soles)" flag="🇵🇪" currencyCode="PERU" basePrice={usdtPrices.PERU} />
                        <RateGroup title="Chile (Pesos)" flag="🇨🇱" currencyCode="CHILE" basePrice={usdtPrices.CHILE} />
                        <RateGroup title="Colombia (Pesos)" flag="🇨🇴" currencyCode="COLOMBIA" basePrice={usdtPrices.COLOMBIA} />
                        <RateGroup title="Zelle (USA)" flag="🇺🇸" currencyCode="USA" basePrice={usdtPrices.USA} />
                    </div>

                    {/* CONTROL PANEL */}
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
                                <Button
                                    className="w-full h-10 gap-2"
                                    onClick={handleBroadcast}
                                    disabled={broadcasting}
                                >
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
                                <CardDescription className="text-xs">Control de operaciones del sistema.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Mensaje de Cierre</label>
                                    <textarea
                                        className="w-full min-h-[60px] text-xs p-2 rounded-md border"
                                        value={adminSettings?.closed_message || ""}
                                        placeholder="Escribe el mensaje que verán los clientes cuando el sistema esté cerrado..."
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setAdminSettings(prev => prev ? { ...prev, closed_message: val } : {
                                                id: '',
                                                is_open: false,
                                                closed_message: val,
                                                updated_at: new Date().toISOString()
                                            });
                                        }}
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
