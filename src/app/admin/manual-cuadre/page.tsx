"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { 
    Calculator, 
    RotateCcw, 
    Save, 
    Trash2, 
    Loader2, 
    Plus, 
    RefreshCw,
    TrendingDown
} from "lucide-react"
import { formatCurrency, parseFormattedNumber } from "@/lib/rates-utils"
import { 
    ManualBalancesService, 
    BalanceRowData, 
    EgliDiscountItem, 
    EgliTransactionItem 
} from "@/services/manual-balances"
import { toast } from "sonner"

// Componente para tarjetas estándar (Corriente y Cyber)
const StandardBalanceBlock = ({ 
    title, 
    data, 
    onChange, 
    color = "primary" 
}: { 
    title: string
    data: BalanceRowData
    onChange: (d: BalanceRowData) => void
    color?: string 
}) => (
    <Card className="border-none shadow-lg bg-card overflow-hidden">
        <CardHeader className={`bg-${color}/5 border-b py-3 px-4 flex flex-row items-center justify-between space-y-0`}>
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full bg-${color}`} />
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
                                className="h-8 text-right font-bold w-36 ml-auto border-dashed hover:border-primary/50 focus:border-primary transition-all bg-transparent border-0 shadow-none focus-visible:ring-0 p-0"
                                value={data.yesterday}
                                onChange={e => onChange({ ...data, yesterday: e.target.value })}
                            />
                        </td>
                    </tr>
                    <tr className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-medium text-muted-foreground">Paso Hoy</td>
                        <td className="p-3 text-right">
                            <Input
                                className={`h-8 text-right font-bold w-36 ml-auto border-dashed hover:border-primary/50 focus:border-primary transition-all bg-transparent border-0 shadow-none focus-visible:ring-0 p-0 ${parseFormattedNumber(data.today_pass) < 0 ? 'text-red-500' : ''}`}
                                value={data.today_pass}
                                onChange={e => onChange({ ...data, today_pass: e.target.value })}
                            />
                        </td>
                    </tr>
                    <tr className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-medium text-muted-foreground">CLPS de Hoy</td>
                        <td className="p-3 text-right">
                            <Input
                                className="h-8 text-right font-bold w-36 ml-auto border-dashed hover:border-primary/50 focus:border-primary transition-all bg-transparent border-0 shadow-none focus-visible:ring-0 p-0"
                                value={data.today_clps || "0"}
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

const DEFAULT_EGLI_DISCOUNTS: EgliDiscountItem[] = [
    { id: "1", name: "pasaste a cliente", amount: "40000" },
    { id: "2", name: "pasaste a la corriente", amount: "139000" },
    { id: "3", name: "pasaste a andean", amount: "70000" },
]

export default function ManualCuadrePage() {
    // Balances
    const [corriente, setCorriente] = useState<BalanceRowData>({ yesterday: "0", today_pass: "0", today_clps: "0", total: 0 })
    const [cyber, setCyber] = useState<BalanceRowData>({ yesterday: "0", today_pass: "0", today_clps: "0", total: 0 })
    const [manualCuadre, setManualCuadre] = useState("0")

    // Egli Custom Table State
    const yesterdayDateDefault = useMemo(() => {
        const d = new Date()
        d.setDate(d.getDate() - 1)
        return d.toISOString().split('T')[0]
    }, [])

    const [egliAnterior, setEgliAnterior] = useState("167914")
    const [egliAyer, setEgliAyer] = useState("263300")
    const [egliOpsDate, setEgliOpsDate] = useState(yesterdayDateDefault)
    const [egliDiscounts, setEgliDiscounts] = useState<EgliDiscountItem[]>(DEFAULT_EGLI_DISCOUNTS)
    const [egliOpsCount, setEgliOpsCount] = useState<number>(0)
    const [loadingOps, setLoadingOps] = useState(false)

    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    // Calculate total for Corriente and Cyber
    const calculateStandardTotal = (row: BalanceRowData) => {
        return parseFormattedNumber(row.yesterday) + parseFormattedNumber(row.today_pass) + parseFormattedNumber(row.today_clps || "0")
    }

    // Calculate Egli Total: Anterior + Ayer - Descuentos
    const egliTotal = useMemo(() => {
        const anterior = parseFormattedNumber(egliAnterior)
        const ayer = parseFormattedNumber(egliAyer)
        const totalDiscounts = egliDiscounts.reduce((sum, item) => sum + parseFormattedNumber(item.amount), 0)
        return anterior + ayer - totalDiscounts
    }, [egliAnterior, egliAyer, egliDiscounts])

    // Load latest data on mount
    useEffect(() => {
        const loadLatest = async () => {
            setLoading(true)
            try {
                const latest = await ManualBalancesService.getLatest()
                if (latest) {
                    setCorriente(latest.corriente)
                    setCyber(latest.cyber)
                    setManualCuadre(latest.adjustment || "0")

                    // Load Egli data
                    if (latest.egli) {
                        const e = latest.egli
                        setEgliAnterior(e.anterior || e.yesterday || "0")
                        setEgliAyer(e.ayer || e.today_pass || "0")
                        if (e.ops_date) setEgliOpsDate(e.ops_date)
                        if (e.discounts && Array.isArray(e.discounts)) {
                            setEgliDiscounts(e.discounts)
                        }
                    }
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
        setCorriente(prev => ({ ...prev, total: calculateStandardTotal(prev) }))
    }, [corriente.yesterday, corriente.today_pass, corriente.today_clps])

    useEffect(() => {
        setCyber(prev => ({ ...prev, total: calculateStandardTotal(prev) }))
    }, [cyber.yesterday, cyber.today_pass, cyber.today_clps])

    // Fetch operations from Supabase for Egli
    const handleFetchEgliOps = async () => {
        if (!egliOpsDate) {
            toast.warning("Por favor selecciona una fecha")
            return
        }
        setLoadingOps(true)
        try {
            const result = await ManualBalancesService.getEgliOperations(egliOpsDate)
            setEgliAyer(result.total.toString())
            setEgliOpsCount(result.count)
            toast.success(`Se encontraron ${result.count} operaciones de Egli por ${formatCurrency(result.total, 'CLP')} CLP`)
        } catch (error: unknown) {
            console.error(error)
            toast.error("Error al consultar operaciones de Egli")
        } finally {
            setLoadingOps(false)
        }
    }

    const handleAddDiscount = () => {
        const newItem: EgliDiscountItem = {
            id: Date.now().toString(),
            name: "nuevo pase / descuento",
            amount: "0"
        }
        setEgliDiscounts(prev => [...prev, newItem])
    }

    const handleUpdateDiscount = (id: string, field: 'name' | 'amount', value: string) => {
        setEgliDiscounts(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item))
    }

    const handleRemoveDiscount = (id: string) => {
        setEgliDiscounts(prev => prev.filter(item => item.id !== id))
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const egliData: BalanceRowData = {
                yesterday: egliAnterior,
                today_pass: egliAyer,
                today_clps: "0",
                total: egliTotal,
                anterior: egliAnterior,
                ayer: egliAyer,
                ops_date: egliOpsDate,
                discounts: egliDiscounts
            }

            await ManualBalancesService.save({
                egli: egliData,
                corriente,
                cyber,
                adjustment: manualCuadre
            })
            toast.success("Cuadre guardado exitosamente")
        } catch (error) {
            console.error(error)
            toast.error("Error al guardar el cuadre")
        } finally {
            setSaving(false)
        }
    }

    const handleReset = () => {
        if (!confirm("¿Deseas reiniciar todos los campos del cuadre?")) return
        const empty = { yesterday: "0", today_pass: "0", today_clps: "0", total: 0 }
        setEgliAnterior("0")
        setEgliAyer("0")
        setEgliDiscounts(DEFAULT_EGLI_DISCOUNTS)
        setEgliOpsCount(0)
        setCorriente(empty)
        setCyber(empty)
        setManualCuadre("0")
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                        <div className="bg-primary text-primary-foreground p-1.5 rounded-lg shadow-sm">
                            <Calculator className="w-6 h-6" />
                        </div>
                        Cuadre Manual de Caja
                    </h1>
                    <p className="text-muted-foreground text-sm">Herramienta de cálculo interno y cierres diarios.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 sm:flex-none h-9 gap-2 bg-green-600 hover:bg-green-700 shadow-sm"
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
                    {/* 3 Main Balance Cards (Egli con tabla tipo Excel, Corriente, Cyber) */}
                    <div className="grid md:grid-cols-3 gap-6 items-start">
                        {/* ── CARD EGLI (ESTILO EXCEL) ── */}
                        <Card className="border-none shadow-lg bg-card overflow-hidden">
                            <CardHeader className="bg-blue-500/5 border-b py-2.5 px-3 flex flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                    Egli
                                </CardTitle>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="date"
                                        className="h-7 text-[11px] w-28 bg-background border px-1.5 py-0.5 rounded shadow-none"
                                        value={egliOpsDate}
                                        onChange={e => setEgliOpsDate(e.target.value)}
                                        title="Fecha de operaciones"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleFetchEgliOps}
                                        disabled={loadingOps}
                                        className="h-7 px-1.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950 font-semibold gap-1"
                                        title="Cargar operaciones de Egli de la fecha"
                                    >
                                        {loadingOps ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <table className="w-full text-sm border-collapse">
                                    <tbody>
                                        {/* 1. Anterior */}
                                        <tr className="border-b hover:bg-muted/30 transition-colors">
                                            <td className="p-3 font-medium text-muted-foreground">anterior</td>
                                            <td className="p-3 text-right">
                                                <Input
                                                    className="h-8 text-right font-bold w-36 ml-auto border-dashed hover:border-primary/50 focus:border-primary transition-all bg-transparent border-0 shadow-none focus-visible:ring-0 p-0"
                                                    value={egliAnterior}
                                                    onChange={e => setEgliAnterior(e.target.value)}
                                                    placeholder="0"
                                                />
                                            </td>
                                        </tr>

                                        {/* 2. Ayer (Operaciones) */}
                                        <tr className="border-b hover:bg-muted/30 transition-colors bg-blue-50/20">
                                            <td className="p-3 font-medium text-blue-700 dark:text-blue-400">
                                                <div className="flex items-center gap-1.5">
                                                    <span>ayer</span>
                                                    {egliOpsCount > 0 && (
                                                        <span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded font-bold">
                                                            {egliOpsCount} ops
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3 text-right">
                                                <Input
                                                    className="h-8 text-right font-bold w-36 ml-auto border-dashed hover:border-primary/50 focus:border-primary transition-all bg-transparent border-0 shadow-none focus-visible:ring-0 p-0 text-blue-600"
                                                    value={egliAyer}
                                                    onChange={e => setEgliAyer(e.target.value)}
                                                    placeholder="0"
                                                />
                                            </td>
                                        </tr>

                                        {/* 3..N Descuentos / Pases Manuales */}
                                        {egliDiscounts.map(item => (
                                            <tr key={item.id} className="border-b hover:bg-red-50/20 transition-colors group">
                                                <td className="p-2.5">
                                                    <Input
                                                        className="h-7 text-xs font-medium text-red-600 dark:text-red-400 bg-transparent border-0 border-b border-transparent hover:border-dashed hover:border-red-300 focus:border-red-500 shadow-none focus-visible:ring-0 p-0 w-full"
                                                        value={item.name}
                                                        onChange={e => handleUpdateDiscount(item.id, 'name', e.target.value)}
                                                        placeholder="concepto descuento"
                                                    />
                                                </td>
                                                <td className="p-2.5 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <span className="text-xs font-bold text-red-500">-</span>
                                                        <Input
                                                            className="h-7 text-right font-bold text-xs w-28 text-red-600 border-dashed hover:border-red-300 focus:border-red-500 transition-all bg-transparent border-0 shadow-none focus-visible:ring-0 p-0"
                                                            value={item.amount}
                                                            onChange={e => handleUpdateDiscount(item.id, 'amount', e.target.value)}
                                                            placeholder="0"
                                                        />
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 opacity-40 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-red-50 shrink-0"
                                                            onClick={() => handleRemoveDiscount(item.id)}
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}

                                        {/* Botón Agregar Fila */}
                                        <tr className="border-b">
                                            <td colSpan={2} className="p-1.5 text-center bg-muted/10">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={handleAddDiscount}
                                                    className="h-6 text-[11px] px-2 text-muted-foreground hover:text-primary gap-1 font-semibold"
                                                >
                                                    <Plus className="w-3 h-3" /> Agregar descuento / pase
                                                </Button>
                                            </td>
                                        </tr>

                                        {/* Total / Pendiente */}
                                        <tr className="bg-muted/50">
                                            <td className="p-3 font-bold uppercase text-[10px] tracking-widest">
                                                Pendiente
                                            </td>
                                            <td className="p-3 text-right font-black text-lg text-blue-700 dark:text-blue-400">
                                                {formatCurrency(egliTotal)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>

                        {/* ── CARD CORRIENTE ── */}
                        <StandardBalanceBlock title="Corriente" data={corriente} onChange={setCorriente} color="amber-500" />

                        {/* ── CARD CYBER ── */}
                        <StandardBalanceBlock title="Cyber" data={cyber} onChange={setCyber} color="purple-500" />
                    </div>

                    {/* Estado del Cuadre & Ajuste */}
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
                                        {formatCurrency(egliTotal + corriente.total + cyber.total + parseFormattedNumber(manualCuadre))}
                                    </div>
                                    <div className="text-xs font-bold text-muted-foreground animate-pulse uppercase">Tiene que dar "CERO"</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Note Box */}
                    <div className="bg-primary/5 border border-primary/10 p-4 rounded-xl flex items-start gap-4">
                        <div className="bg-primary text-white p-1 rounded-full mt-0.5">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                            </svg>
                        </div>
                        <div className="text-sm">
                            <p className="font-bold text-primary">Nota Importante:</p>
                            <p className="text-muted-foreground">Este cuadre guarda tus datos automáticamente al presionar "Guardar Cuadre". El sistema siempre cargará el último cierre realizado para que continúes donde lo dejaste.</p>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}


