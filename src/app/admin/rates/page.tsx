"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Save, Calculator, RefreshCw, ArrowLeft } from "lucide-react"
import { RatesService } from "@/services/rates"
import { calculateRate, formatRate } from "@/lib/rates-utils"

export default function RatesPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

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
        const loadRates = async () => {
            try {
                const data = await RatesService.getLatest()
                if (data) {
                    // Update state with DB data, merging with defaults to be safe
                    if (data.usdt_prices) setUsdtPrices(prev => ({ ...prev, ...data.usdt_prices }))
                    if (data.margins) setPercentages(prev => ({ ...prev, ...data.margins }))
                }
            } catch (error) {
                console.error("Failed to load rates", error)
            } finally {
                setLoading(false)
            }
        }
        loadRates()
    }, [])

    const handleSave = async () => {
        setSaving(true)
        try {
            await RatesService.update(usdtPrices, percentages)
            alert("Tasas actualizadas correctamente en la base de datos.")
        } catch (error: any) {
            console.error("Error saving rates:", error)
            alert(`Error al guardar: ${error.message || "Error desconocido"}`)
        } finally {
            setSaving(false)
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
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
                    <RateGroup title="Perú (Soles)" flag="🇵🇪" currencyCode="PERU" basePrice={usdtPrices.PERU} />
                    <RateGroup title="Chile (Pesos)" flag="🇨🇱" currencyCode="CHILE" basePrice={usdtPrices.CHILE} />
                    <RateGroup title="Colombia (Pesos)" flag="🇨🇴" currencyCode="COLOMBIA" basePrice={usdtPrices.COLOMBIA} />
                    <RateGroup title="Zelle (USA)" flag="🇺🇸" currencyCode="USA" basePrice={usdtPrices.USA} />
                </div>
            </div>
        </div>
    )
}
