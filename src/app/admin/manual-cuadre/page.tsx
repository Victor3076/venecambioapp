"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
    Calculator, 
    RotateCcw, 
    Save, 
    Trash2, 
    Loader2, 
    Plus, 
    Sparkles, 
    ChevronDown, 
    ChevronUp, 
    RefreshCw, 
    Calendar,
    ArrowRight,
    TrendingDown,
    Landmark,
    Hash
} from "lucide-react"
import { formatCurrency, parseFormattedNumber } from "@/lib/rates-utils"
import { 
    ManualBalancesService, 
    BalanceRowData, 
    EgliDiscountItem, 
    EgliBreakdownData,
    EgliTransactionItem 
} from "@/services/manual-balances"
import { toast } from "sonner"

const BalanceBlock = ({ 
    title, 
    data, 
    onChange, 
    color = "primary",
    extraHeaderAction
}: { 
    title: string
    data: BalanceRowData
    onChange: (d: BalanceRowData) => void
    color?: string
    extraHeaderAction?: React.ReactNode
}) => (
    <Card className="border-none shadow-lg bg-card overflow-hidden">
        <CardHeader className={`bg-${color}/5 border-b py-3 px-4 flex flex-row items-center justify-between space-y-0`}>
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full bg-${color}`} />
                {title}
            </CardTitle>
            {extraHeaderAction}
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

const DEFAULT_DISCOUNTS: EgliDiscountItem[] = [
    { id: "1", name: "Pasaste a cliente", amount: "40000" },
    { id: "2", name: "Pasaste a la corriente", amount: "139000" },
    { id: "3", name: "Pasaste a andean", amount: "70000" },
]

export default function ManualCuadrePage() {
    // Balances
    const [egli, setEgli] = useState<BalanceRowData>({ yesterday: "0", today_pass: "0", today_clps: "0", total: 0 })
    const [corriente, setCorriente] = useState<BalanceRowData>({ yesterday: "0", today_pass: "0", today_clps: "0", total: 0 })
    const [cyber, setCyber] = useState<BalanceRowData>({ yesterday: "0", today_pass: "0", today_clps: "0", total: 0 })
    const [manualCuadre, setManualCuadre] = useState("0")
    
    // Egli Excel Automation State
    const yesterdayDateDefault = useMemo(() => {
        const d = new Date()
        d.setDate(d.getDate() - 1)
        return d.toISOString().split('T')[0]
    }, [])
    
    const [showEgliBreakdown, setShowEgliBreakdown] = useState(true)
    const [egliPrevious, setEgliPrevious] = useState("167914")
    const [egliDate, setEgliDate] = useState(yesterdayDateDefault)
    const [egliOpsTotal, setEgliOpsTotal] = useState(263300)
    const [egliOpsList, setEgliOpsList] = useState<EgliTransactionItem[]>([])
    const [showOpsDetails, setShowOpsDetails] = useState(false)
    const [discounts, setDiscounts] = useState<EgliDiscountItem[]>(DEFAULT_DISCOUNTS)
    const [loadingOps, setLoadingOps] = useState(false)

    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    // Calculate total for a row
    const calculateTotal = (row: BalanceRowData) => {
        return parseFormattedNumber(row.yesterday) + parseFormattedNumber(row.today_pass) + parseFormattedNumber(row.today_clps)
    }

    // Calculate Egli discounts sum
    const totalDiscounts = useMemo(() => {
        return discounts.reduce((sum, item) => sum + parseFormattedNumber(item.amount), 0)
    }, [discounts])

    // Calculate Egli Pendiente (Hasta Ayer)
    const calculatedEgliPending = useMemo(() => {
        const prev = parseFormattedNumber(egliPrevious)
        return prev + egliOpsTotal - totalDiscounts
    }, [egliPrevious, egliOpsTotal, totalDiscounts])

    // Automatically synchronize calculated Egli Pendiente with Egli "Hasta Ayer"
    const handleSyncEgliPending = () => {
        setEgli(prev => ({
            ...prev,
            yesterday: formatCurrency(calculatedEgliPending, 'CLP')
        }))
        toast.success(`Saldo Hasta Ayer de Egli actualizado a ${formatCurrency(calculatedEgliPending, 'CLP')}`)
    }

    // Load latest data on mount
    useEffect(() => {
        const loadLatest = async () => {
            setLoading(true)
            try {
                const latest = await ManualBalancesService.getLatest()
                if (latest) {
                    setEgli(latest.egli)
                    setCorriente(latest.corriente)
                    setCyber(latest.cyber)
                    setManualCuadre(latest.adjustment || "0")

                    // Restore Egli Breakdown if previously saved
                    if (latest.egli?.breakdown) {
                        const b = latest.egli.breakdown
                        if (b.previous_pending !== undefined) setEgliPrevious(b.previous_pending)
                        if (b.yesterday_date) setEgliDate(b.yesterday_date)
                        if (b.yesterday_ops_total !== undefined) setEgliOpsTotal(b.yesterday_ops_total)
                        if (b.discounts && Array.isArray(b.discounts)) setDiscounts(b.discounts)
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
        setEgli(prev => ({ ...prev, total: calculateTotal(prev) }))
    }, [egli.yesterday, egli.today_pass, egli.today_clps])

    useEffect(() => {
        setCorriente(prev => ({ ...prev, total: calculateTotal(prev) }))
    }, [corriente.yesterday, corriente.today_pass, corriente.today_clps])

    useEffect(() => {
        setCyber(prev => ({ ...prev, total: calculateTotal(prev) }))
    }, [cyber.yesterday, cyber.today_pass, cyber.today_clps])

    // Fetch operations from Supabase for Egli
    const handleFetchEgliOps = async () => {
        if (!egliDate) {
            toast.warning("Por favor selecciona una fecha")
            return
        }
        setLoadingOps(true)
        try {
            const result = await ManualBalancesService.getEgliOperations(egliDate)
            setEgliOpsTotal(result.total)
            setEgliOpsList(result.operations)
            toast.success(`Se encontraron ${result.count} operaciones de Egli por un total de ${formatCurrency(result.total, 'CLP')} CLP`)
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
            name: "Nuevo descuento / pase",
            amount: "0"
        }
        setDiscounts(prev => [...prev, newItem])
    }

    const handleUpdateDiscount = (id: string, field: 'name' | 'amount', value: string) => {
        setDiscounts(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item))
    }

    const handleRemoveDiscount = (id: string) => {
        setDiscounts(prev => prev.filter(item => item.id !== id))
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const egliBreakdown: EgliBreakdownData = {
                previous_pending: egliPrevious,
                yesterday_date: egliDate,
                yesterday_ops_total: egliOpsTotal,
                discounts,
                calculated_pending: calculatedEgliPending
            }

            await ManualBalancesService.save({
                egli: {
                    ...egli,
                    breakdown: egliBreakdown
                },
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
        setEgli(empty)
        setCorriente(empty)
        setCyber(empty)
        setManualCuadre("0")
        setEgliPrevious("0")
        setEgliOpsTotal(0)
        setEgliOpsList([])
        setDiscounts(DEFAULT_DISCOUNTS)
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
                    {/* 3 Main Balance Cards (Egli, Corriente, Cyber) */}
                    <div className="grid md:grid-cols-3 gap-6">
                        <BalanceBlock 
                            title="Egli" 
                            data={egli} 
                            onChange={setEgli} 
                            color="blue-500" 
                            extraHeaderAction={
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 text-xs px-2 gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950 font-bold"
                                    onClick={() => setShowEgliBreakdown(!showEgliBreakdown)}
                                >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    {showEgliBreakdown ? "Ocultar Excel" : "Auto Excel"}
                                    {showEgliBreakdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </Button>
                            }
                        />
                        <BalanceBlock title="Corriente" data={corriente} onChange={setCorriente} color="amber-500" />
                        <BalanceBlock title="Cyber" data={cyber} onChange={setCyber} color="purple-500" />
                    </div>

                    {/* Egli Excel Breakdown & Automation Module */}
                    {showEgliBreakdown && (
                        <Card className="border-2 border-blue-500/20 shadow-md bg-gradient-to-br from-blue-500/[0.02] to-background overflow-hidden animate-in fade-in duration-300">
                            <CardHeader className="bg-blue-500/10 border-b py-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-blue-700 dark:text-blue-400">
                                        <Sparkles className="w-4 h-4 text-blue-500" />
                                        Módulo Automatizado Egli (Flujo Excel)
                                    </CardTitle>
                                    <CardDescription className="text-xs">
                                        Calcula el saldo pendiente a partir del saldo anterior, operaciones filtradas y deducciones manuales.
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button 
                                        size="sm" 
                                        className="h-8 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm"
                                        onClick={handleSyncEgliPending}
                                    >
                                        <ArrowRight className="w-3.5 h-3.5" />
                                        Aplicar a "Hasta Ayer" ({formatCurrency(calculatedEgliPending, 'CLP')})
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 sm:p-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Left: Inputs (Anterior & Ayer Ops) */}
                                    <div className="space-y-4">
                                        <div className="bg-card border rounded-lg p-4 shadow-sm space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                    1. Saldo Anterior
                                                </label>
                                                <span className="text-xs font-semibold text-blue-600">CLP</span>
                                            </div>
                                            <Input
                                                type="text"
                                                className="text-lg font-bold text-right h-10 border-dashed"
                                                placeholder="167914"
                                                value={egliPrevious}
                                                onChange={e => setEgliPrevious(e.target.value)}
                                            />
                                        </div>

                                        <div className="bg-card border rounded-lg p-4 shadow-sm space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                    2. Operaciones Egli (Ayer / Fecha)
                                                </label>
                                                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                                                    Filtro 'egli' CLP
                                                </Badge>
                                            </div>
                                            
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="date"
                                                    value={egliDate}
                                                    onChange={e => setEgliDate(e.target.value)}
                                                    className="h-9 text-sm"
                                                />
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={handleFetchEgliOps}
                                                    disabled={loadingOps}
                                                    className="h-9 gap-1.5 shrink-0 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 font-semibold"
                                                >
                                                    {loadingOps ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                                    Consultar
                                                </Button>
                                            </div>

                                            <div className="flex items-center justify-between pt-1">
                                                <div className="text-xs text-muted-foreground">
                                                    Monto Sumado:
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="number"
                                                        className="h-8 text-right font-black w-36 text-blue-600 border-dashed"
                                                        value={egliOpsTotal}
                                                        onChange={e => setEgliOpsTotal(Number(e.target.value) || 0)}
                                                    />
                                                    <span className="text-xs font-bold text-muted-foreground">CLP</span>
                                                </div>
                                            </div>

                                            {egliOpsList.length > 0 && (
                                                <div className="pt-2 border-t text-xs">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 px-2 text-[11px] text-muted-foreground w-full justify-between"
                                                        onClick={() => setShowOpsDetails(!showOpsDetails)}
                                                    >
                                                        <span>{egliOpsList.length} operaciones encontradas</span>
                                                        <span>{showOpsDetails ? "Ocultar lista ▲" : "Ver lista ▼"}</span>
                                                    </Button>

                                                    {showOpsDetails && (
                                                        <div className="mt-2 max-h-40 overflow-y-auto space-y-1.5 pr-1 border rounded p-2 bg-muted/20">
                                                            {egliOpsList.map(tx => (
                                                                <div key={tx.id} className="flex justify-between items-center text-[11px] py-1 border-b last:border-0">
                                                                    <div className="truncate max-w-[180px]">
                                                                        <span className="font-semibold">{tx.profiles?.full_name || 'Cliente'}</span>
                                                                        <div className="text-[9px] text-muted-foreground truncate">{tx.reference_id || tx.id}</div>
                                                                    </div>
                                                                    <span className="font-bold text-blue-600 shrink-0">
                                                                        +{formatCurrency(tx.amount_sent, 'CLP')} CLP
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: Deductions / Discounts */}
                                    <div className="bg-card border rounded-lg p-4 shadow-sm flex flex-col justify-between space-y-3">
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                    <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                                                    3. Descuentos / Pases Manuales
                                                </label>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={handleAddDiscount}
                                                    className="h-7 text-xs px-2 gap-1 text-primary hover:bg-primary/10 font-semibold"
                                                >
                                                    <Plus className="w-3.5 h-3.5" /> Agregar fila
                                                </Button>
                                            </div>

                                            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                                {discounts.map(item => (
                                                    <div key={item.id} className="flex items-center gap-2 bg-muted/30 p-1.5 rounded-md border border-dashed hover:bg-muted/50 transition-colors">
                                                        <Input
                                                            className="h-8 text-xs font-medium bg-transparent border-0 shadow-none focus-visible:ring-0 p-1 flex-1"
                                                            placeholder="Concepto (ej: Pasaste a cliente)"
                                                            value={item.name}
                                                            onChange={e => handleUpdateDiscount(item.id, 'name', e.target.value)}
                                                        />
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <span className="text-xs font-bold text-red-500">-</span>
                                                            <Input
                                                                className="h-8 text-xs font-bold text-right w-24 bg-transparent border-0 shadow-none focus-visible:ring-0 p-1 text-red-600"
                                                                placeholder="0"
                                                                value={item.amount}
                                                                onChange={e => handleUpdateDiscount(item.id, 'amount', e.target.value)}
                                                            />
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-red-50"
                                                                onClick={() => handleRemoveDiscount(item.id)}
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {discounts.length === 0 && (
                                                    <div className="text-center py-6 text-xs text-muted-foreground italic">
                                                        No hay deducciones manuales agregadas.
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="pt-3 border-t flex items-center justify-between text-xs">
                                            <span className="font-bold text-muted-foreground uppercase">Total Descuentos:</span>
                                            <span className="font-black text-sm text-red-600">
                                                - {formatCurrency(totalDiscounts, 'CLP')} CLP
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Summary Box (Formula & Result) */}
                                <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="space-y-1 text-center sm:text-left">
                                        <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                                            Fórmula Excel Egli:
                                        </div>
                                        <div className="text-xs text-muted-foreground flex flex-wrap items-center justify-center sm:justify-start gap-1.5 font-medium">
                                            <span>Anterior ({formatCurrency(parseFormattedNumber(egliPrevious), 'CLP')})</span>
                                            <span className="font-bold text-blue-600">+</span>
                                            <span>Ayer ({formatCurrency(egliOpsTotal, 'CLP')})</span>
                                            <span className="font-bold text-red-500">-</span>
                                            <span>Descuentos ({formatCurrency(totalDiscounts, 'CLP')})</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <div className="text-[10px] uppercase font-bold text-muted-foreground">Pendiente (Hasta Ayer)</div>
                                            <div className="text-2xl font-black text-blue-700 dark:text-blue-400">
                                                {formatCurrency(calculatedEgliPending, 'CLP')} CLP
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            onClick={handleSyncEgliPending}
                                            className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 shadow"
                                        >
                                            <ArrowRight className="w-4 h-4" /> Aplicar
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

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
                                        {formatCurrency(egli.total + corriente.total + cyber.total + parseFormattedNumber(manualCuadre))}
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
                            <p className="text-muted-foreground">Este cuadre guarda tus datos y el desglose automatizado de Egli automáticamente al presionar "Guardar Cuadre". El sistema siempre cargará el último cierre realizado para que continúes sin perder tus cálculos.</p>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

