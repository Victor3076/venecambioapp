"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Calculator, RotateCcw, Save, Trash2, Loader2 } from "lucide-react"
import { formatCurrency, parseFormattedNumber } from "@/lib/rates-utils"
import { ManualBalancesService, BalanceRowData } from "@/services/manual-balances"
import { toast } from "sonner"

const BalanceBlock = ({ title, data, onChange, color = "primary" }: { title: string, data: BalanceRowData, onChange: (d: BalanceRowData) => void, color?: string }) => (
    <Card className="border-none shadow-lg bg-card">
        <CardHeader className={`bg-${color}/5 border-b py-3 px-4`}>
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full bg-${color}`} />
                {title}
            </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
            <table className="w-full text-sm border-collapse">
                <tbody>
                    <tr className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-medium text-muted-foreground">Hasta Ayer</td>
                        <td className="p-3 text-right">
                            <Input
                                className="h-8 text-right font-bold w-40 ml-auto border-dashed hover:border-primary/50 focus:border-primary transition-all bg-transparent border-0 shadow-none focus-visible:ring-0 p-0"
                                value={data.yesterday}
                                onChange={e => onChange({ ...data, yesterday: e.target.value })}
                            />
                        </td>
                    </tr>
                    <tr className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-medium text-muted-foreground">Paso Hoy</td>
                        <td className="p-3 text-right">
                            <Input
                                className={`h-8 text-right font-bold w-40 ml-auto border-dashed hover:border-primary/50 focus:border-primary transition-all bg-transparent border-0 shadow-none focus-visible:ring-0 p-0 ${parseFormattedNumber(data.today_pass) < 0 ? 'text-red-500' : ''}`}
                                value={data.today_pass}
                                onChange={e => onChange({ ...data, today_pass: e.target.value })}
                            />
                        </td>
                    </tr>
                    <tr className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-medium text-muted-foreground">CLPS de Hoy</td>
                        <td className="p-3 text-right">
                            <Input
                                className="h-8 text-right font-bold w-40 ml-auto border-dashed hover:border-primary/50 focus:border-primary transition-all bg-transparent border-0 shadow-none focus-visible:ring-0 p-0"
                                value={data.today_clps}
                                onChange={e => onChange({ ...data, today_clps: e.target.value })}
                            />
                        </td>
                    </tr>
                    <tr className="bg-muted/50">
                        <td className="p-3 font-bold uppercase text-[10px] tracking-widest">Total</td>
                        <td className="p-3 text-right font-black text-lg">
                            {formatCurrency(data.total)}
                        </td>
                    </tr>
                </tbody>
            </table>
        </CardContent>
    </Card>
)

export default function ManualCuadrePage() {
    const [egli, setEgli] = useState<BalanceRowData>({ yesterday: "0", today_pass: "0", today_clps: "0", total: 0 })
    const [vicmar, setVicmar] = useState<BalanceRowData>({ yesterday: "0", today_pass: "0", today_clps: "0", total: 0 })
    const [corriente, setCorriente] = useState<BalanceRowData>({ yesterday: "0", today_pass: "0", today_clps: "0", total: 0 })
    const [cyber, setCyber] = useState<BalanceRowData>({ yesterday: "0", today_pass: "0", today_clps: "0", total: 0 })
    const [manualCuadre, setManualCuadre] = useState("0")
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    const calculateTotal = (row: BalanceRowData) => {
        return parseFormattedNumber(row.yesterday) + parseFormattedNumber(row.today_pass) + parseFormattedNumber(row.today_clps)
    }

    // Load latest data on mount
    useEffect(() => {
        const loadLatest = async () => {
            setLoading(true)
            try {
                const latest = await ManualBalancesService.getLatest()
                if (latest) {
                    setEgli(latest.egli)
                    setVicmar(latest.vicmar)
                    setCorriente(latest.corriente)
                    setCyber(latest.cyber)
                    setManualCuadre(latest.adjustment || "0")
                }
            } catch (error) {
                console.error("Error loading latest balance:", error)
            } finally {
                setLoading(false)
            }
        }
        loadLatest()
    }, [])

    useEffect(() => {
        setEgli(prev => ({ ...prev, total: calculateTotal(prev) }))
    }, [egli.yesterday, egli.today_pass, egli.today_clps])

    useEffect(() => {
        setVicmar(prev => ({ ...prev, total: calculateTotal(prev) }))
    }, [vicmar.yesterday, vicmar.today_pass, vicmar.today_clps])

    useEffect(() => {
        setCorriente(prev => ({ ...prev, total: calculateTotal(prev) }))
    }, [corriente.yesterday, corriente.today_pass, corriente.today_clps])

    useEffect(() => {
        setCyber(prev => ({ ...prev, total: calculateTotal(prev) }))
    }, [cyber.yesterday, cyber.today_pass, cyber.today_clps])

    const handleSave = async () => {
        setSaving(true)
        try {
            await ManualBalancesService.save({
                egli,
                vicmar,
                corriente,
                cyber,
                adjustment: manualCuadre
            })
            toast.success("Cuadre guardado exitosamente")
        } catch (error) {
            toast.error("Error al guardar el cuadre")
        } finally {
            setSaving(false)
        }
    }

    const handleReset = () => {
        const empty = { yesterday: "0", today_pass: "0", today_clps: "0", total: 0 }
        setEgli(empty)
        setVicmar(empty)
        setCorriente(empty)
        setCyber(empty)
        setManualCuadre("0")
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                        <div className="bg-primary text-primary-foreground p-1.5 rounded-lg">
                            <Calculator className="w-6 h-6" />
                        </div>
                        Cuadre Manual de Caja
                    </h1>
                    <p className="text-muted-foreground text-sm">Herramienta de cálculo interno para cierres diarios.</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleSave}
                        disabled={saving}
                        className="h-9 gap-2 bg-green-600 hover:bg-green-700"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Guardar Cuadre
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleReset} className="h-9 gap-2">
                        <RotateCcw className="w-4 h-4" /> Reiniciar
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-muted-foreground animate-pulse font-medium">Cargando último cuadre...</p>
                </div>
            ) : (
                <>
                    <div className="grid md:grid-cols-2 gap-6">
                        <BalanceBlock title="Egli" data={egli} onChange={setEgli} color="blue-500" />
                        <BalanceBlock title="Vicmar Domingo" data={vicmar} onChange={setVicmar} color="green-500" />
                        <BalanceBlock title="Corriente" data={corriente} onChange={setCorriente} color="amber-500" />
                        <BalanceBlock title="Cyber" data={cyber} onChange={setCyber} color="purple-500" />
                    </div>

                    <Card className="border-2 border-primary/20 shadow-xl overflow-hidden">
                        <CardContent className="p-0">
                            <div className="flex flex-col sm:flex-row items-center divide-y sm:divide-y-0 sm:divide-x">
                                <div className="flex-1 p-6 w-full sm:w-auto">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="font-bold text-muted-foreground uppercase text-xs tracking-widest">Ajuste de Cuadre</div>
                                        <div className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase">Manual</div>
                                    </div>
                                    <table className="w-full">
                                        <tbody>
                                            <tr className="border-b border-dashed">
                                                <td className="py-3 text-sm font-medium">Diferencia / Cuadre</td>
                                                <td className="py-3 text-right">
                                                    <Input
                                                        className="h-10 text-right font-black text-xl w-48 ml-auto bg-transparent border-0 shadow-none focus-visible:ring-0 p-0"
                                                        value={manualCuadre}
                                                        onChange={e => setManualCuadre(e.target.value)}
                                                    />
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex-1 p-6 bg-primary/5 w-full sm:w-auto flex flex-col items-center justify-center text-center">
                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2">Estado del Cuadre</div>
                                    <div className="text-4xl font-black mb-1">
                                        {formatCurrency(egli.total + vicmar.total + corriente.total + cyber.total + parseFormattedNumber(manualCuadre))}
                                    </div>
                                    <div className="text-xs font-bold text-muted-foreground animate-pulse uppercase">Tiene que dar "CERO"</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="bg-primary/5 border border-primary/10 p-4 rounded-xl flex items-start gap-4">
                        <div className="bg-primary text-white p-1 rounded-full mt-0.5">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                            </svg>
                        </div>
                        <div className="text-sm">
                            <p className="font-bold text-primary">Nota Importante:</p>
                            <p className="text-muted-foreground">Este cuadre ahora **guarda tus datos automáticamente** al presionar "Guardar Cuadre". El sistema siempre cargará el último cierre realizado para que puedas continuar donde lo dejaste.</p>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
