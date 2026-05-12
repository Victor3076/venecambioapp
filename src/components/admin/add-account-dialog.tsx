"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { AccountsService, UserAccount } from "@/services/accounts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { X, Loader2, Plus, Pencil, Trash2, Landmark, CreditCard, ArrowLeft, ClipboardPaste } from "lucide-react"

interface AddAccountDialogProps {
    userId: string
    userName?: string
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

type View = "list" | "add" | "edit"

const emptyAccount = {
    alias: "",
    country: "VES",
    bank_name: "",
    account_number: "",
    details: { id_number: "", email: "", account_type: "", rut: "", venezuela_type: "Cuenta", peru_type: "Cuenta" }
}

const VENEZUELA_BANKS: Record<string, string> = {
    "0102": "Banco de Venezuela (BDV)",
    "0104": "Banco Venezolano de Crédito (BVC)",
    "0105": "Banco Mercantil",
    "0108": "Banco Provincial (BBVA)",
    "0114": "Bancaribe",
    "0115": "Banco Exterior",
    "0128": "Banco Caroní",
    "0134": "Banesco Banco Universal",
    "0137": "Sofitasa",
    "0138": "Banco Plaza",
    "0146": "Bangente",
    "0151": "Banco Fondo Común (BFC)",
    "0156": "100% Banco",
    "0157": "Del Sur Banco Universal",
    "0163": "Banco del Tesoro",
    "0166": "Banco Agrícola de Venezuela",
    "0168": "Bancrecer",
    "0169": "Mi Banco",
    "0171": "Banco Activo",
    "0172": "Bancamiga",
    "0174": "Banplus",
    "0175": "Banco Bicentenario del Pueblo",
    "0177": "BANFANB",
    "0191": "Banco Nacional de Crédito (BNC)",
}

function parseVenezuelanAccountText(text: string): Partial<typeof emptyAccount> | null {
    // Step 1: normalize whitespace
    let normalized = text.replace(/\s+/g, " ").trim()

    // Step 2: strip formatting separators between digits
    // Handles: 14.109.263 → 14109263  |  0412-4914072 → 04124914072
    // Also handles mixed formats like 0412.491.4072
    // We apply this repeatedly until no more separators between digits exist
    let prev = ""
    while (prev !== normalized) {
        prev = normalized
        normalized = normalized.replace(/(\d)[.\-](\d)/g, "$1$2")
    }

    // --- Detect phone number (Pago Móvil) ---
    // Venezuelan phone prefixes: 0412, 0414, 0416, 0422, 0424, 0426 + 7 digits
    const phoneMatch = normalized.match(/\b(04(?:12|14|16|22|24|26)\d{7})\b/)
    const phone = phoneMatch ? phoneMatch[1] : null

    // --- Detect cedula: 6-9 digit number NOT starting with 04xx or 01xx (bank codes) ---
    const cedulaMatch = normalized.match(/\b((?!04\d{2}|01\d{2})\d{6,9})\b/)
    const cedula = cedulaMatch ? cedulaMatch[1] : null

    // --- Detect 20-digit account number ---
    const accountMatch = normalized.match(/\b(\d{20})\b/)
    const accountNumber = accountMatch ? accountMatch[1] : null

    // --- Detect bank ---
    // Priority 1: explicit 4-digit code (01xx) in text
    // Priority 2: first 4 digits of the 20-digit account number
    // Priority 3: bank name written in plain text (e.g. "Banesco", "BDV")
    const BANK_TEXT_MAP: Array<[RegExp, string]> = [
        [/\b(bdv|banco\s*de\s*venezuela)\b/i,           "Banco de Venezuela (BDV)"],
        [/\b(bvc|venezolano\s*de\s*cr[eé]dito)\b/i,    "Banco Venezolano de Crédito (BVC)"],
        [/\bmercantil\b/i,                              "Banco Mercantil"],
        [/\b(provincial|bbva)\b/i,                      "Banco Provincial (BBVA)"],
        [/\bbancaribe\b/i,                              "Bancaribe"],
        [/\bexterior\b/i,                               "Banco Exterior"],
        [/\bcaroni\b/i,                                 "Banco Caroní"],
        [/\bbanesco\b/i,                                "Banesco Banco Universal"],
        [/\bsofitasa\b/i,                               "Sofitasa"],
        [/\bplaza\b/i,                                  "Banco Plaza"],
        [/\bbangente\b/i,                               "Bangente"],
        [/\b(bfc|fondo\s*com[uú]n)\b/i,                "Banco Fondo Común (BFC)"],
        [/\b100\s*%?\s*banco\b/i,                       "100% Banco"],
        [/\bdel\s*sur\b/i,                              "Del Sur Banco Universal"],
        [/\btesoro\b/i,                                 "Banco del Tesoro"],
        [/\bagr[ií]cola\b/i,                            "Banco Agrícola de Venezuela"],
        [/\bbancrecer\b/i,                              "Bancrecer"],
        [/\bmi\s*banco\b/i,                             "Mi Banco"],
        [/\bactivo\b/i,                                 "Banco Activo"],
        [/\bbancamiga\b/i,                              "Bancamiga"],
        [/\bbanplus\b/i,                                "Banplus"],
        [/\bbicentenario\b/i,                           "Banco Bicentenario del Pueblo"],
        [/\bbanfanb\b/i,                                "BANFANB"],
        [/\b(bnc|nacional\s*de\s*cr[eé]dito)\b/i,      "Banco Nacional de Crédito (BNC)"],
    ]

    const bankCodeMatch = normalized.match(/\b(01\d{2})\b/)
    const explicitBankCode = bankCodeMatch ? bankCodeMatch[1] : null
    const accountBankCode = accountNumber ? accountNumber.substring(0, 4) : null
    const resolvedBankCode = explicitBankCode || accountBankCode
    let bankName: string | null = resolvedBankCode ? (VENEZUELA_BANKS[resolvedBankCode] || null) : null
    let matchedBankText = ""

    if (!bankName) {
        for (const [pattern, name] of BANK_TEXT_MAP) {
            const m = normalized.match(pattern)
            if (m) {
                bankName = name
                matchedBankText = m[0]
                break
            }
        }
    }


    // --- Detect person name (alias) ---
    // Strategy: remove numbers, known keywords, matched bank text, then take what's left
    const KEYWORDS = /\b(c[eé]dula|tel[eé]fono|banco|cuenta|pago|m[oó]vil|venezuela|ves|c\.i\.?|ci|n[uú]mero|nro|titular|nombre)\b/gi
    let nameSource = normalized
    if (matchedBankText) nameSource = nameSource.replace(new RegExp(matchedBankText, "i"), "")
    const nameCandidate = nameSource
        .replace(/\b\d+\b/g, "")                      // remove numbers
        .replace(KEYWORDS, "")                         // remove known keywords
        .replace(/[^a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s]/g, " ")  // remove punctuation/symbols
        .replace(/\s+/g, " ")
        .trim()

    // Accept as alias only if at least 2 words each with 2+ chars
    const nameParts = nameCandidate.split(" ").filter(w => w.length >= 2)
    const alias = nameParts.length >= 2 ? nameParts.join(" ") : null

    // No useful data found at all
    if (!phone && !cedula && !bankName && !accountNumber && !alias) return null

    // Determine type: Pago Móvil if phone found, Cuenta if 20-digit account
    const isMobile = !!phone

    const result: any = {
        country: "VES",
        details: {
            id_number: cedula || "",
            email: "",
            account_type: "",
            rut: "",
            venezuela_type: isMobile ? "Pago Móvil" : "Cuenta",
            peru_type: "Cuenta",
        },
    }

    if (bankName) result.bank_name = bankName
    if (alias) result.alias = alias
    if (isMobile && phone) result.account_number = phone
    if (!isMobile && accountNumber) result.account_number = accountNumber

    return result
}

export function AddAccountDialog({ userId, userName, isOpen, onClose, onSuccess }: AddAccountDialogProps) {
    const [view, setView] = useState<View>("list")
    const [accounts, setAccounts] = useState<UserAccount[]>([])
    const [loadingAccounts, setLoadingAccounts] = useState(false)
    const [saving, setSaving] = useState(false)
    const [editingAccount, setEditingAccount] = useState<UserAccount | null>(null)
    const [formData, setFormData] = useState(emptyAccount)

    const handlePasteData = async () => {
        try {
            const text = await navigator.clipboard.readText()
            if (!text.trim()) {
                toast.error("El portapapeles está vacío")
                return
            }
            const parsed = parseVenezuelanAccountText(text)
            if (!parsed) {
                toast.error("No se pudo reconocer ningún dato de cuenta en el texto pegado")
                return
            }
            setFormData(prev => ({
                ...prev,
                country: "VES",
                alias: (parsed as any).alias ?? prev.alias,
                bank_name: parsed.bank_name ?? prev.bank_name,
                account_number: parsed.account_number ?? prev.account_number,
                details: {
                    ...prev.details,
                    ...(parsed.details || {}),
                },
            }))
            toast.success("Datos pegados correctamente")
        } catch {
            toast.error("No se pudo acceder al portapapeles. Copia el texto primero.")
        }
    }

    useEffect(() => {
        if (isOpen) {
            setView("list")
            loadAccounts()
        }
    }, [isOpen, userId])

    const loadAccounts = async () => {
        setLoadingAccounts(true)
        const data = await AccountsService.getUserAccounts(userId)
        setAccounts(data)
        setLoadingAccounts(false)
    }

    const openAdd = () => {
        setEditingAccount(null)
        setFormData(emptyAccount)
        setView("add")
    }

    const openEdit = (acc: UserAccount) => {
        setEditingAccount(acc)
        setFormData({
            alias: acc.alias,
            country: acc.country,
            bank_name: acc.bank_name,
            account_number: acc.account_number,
            details: {
                id_number: acc.details?.id_number || "",
                email: acc.details?.email || "",
                account_type: acc.details?.account_type || "",
                rut: acc.details?.rut || "",
                venezuela_type: acc.details?.venezuela_type || "Cuenta",
                peru_type: acc.details?.peru_type || "Cuenta",
            }
        })
        setView("edit")
    }

    const handleDelete = async (acc: UserAccount) => {
        if (!confirm(`¿Eliminar la cuenta "${acc.alias}"?`)) return
        try {
            await AccountsService.deleteAccount(acc.id!)
            toast.success("Cuenta eliminada")
            loadAccounts()
            onSuccess()
        } catch (e: any) {
            toast.error("Error al eliminar: " + e.message)
        }
    }

    const handleSave = async () => {
        const isUsd = formData.country === 'USD'
        if (!formData.alias || !formData.country || !formData.account_number || (!isUsd && !formData.bank_name)) {
            toast.error("Por favor completa los campos obligatorios")
            return
        }
        setSaving(true)
        try {
            if (view === "edit" && editingAccount) {
                await AccountsService.updateAccount(editingAccount.id!, {
                    alias: formData.alias,
                    country: formData.country,
                    bank_name: formData.bank_name,
                    account_number: formData.account_number,
                    details: formData.details,
                })
                toast.success("Cuenta actualizada correctamente")
            } else {
                await AccountsService.createAccountForUser(userId, {
                    alias: formData.alias,
                    country: formData.country,
                    bank_name: formData.bank_name,
                    account_number: formData.account_number,
                    details: formData.details,
                })
                toast.success("Cuenta agregada correctamente")
            }
            onSuccess()
            await loadAccounts()
            setView("list")
        } catch (e: any) {
            toast.error("Error: " + e.message)
        } finally {
            setSaving(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-lg relative max-h-[92vh] overflow-y-auto">
                <Button variant="ghost" size="icon" className="absolute right-2 top-2 z-10" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>

                {/* ── VISTA: LISTA ── */}
                {view === "list" && (
                    <>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Landmark className="h-5 w-5 text-primary" />
                                Cuentas Bancarias
                            </CardTitle>
                            <CardDescription>
                                {userName ? `Cliente: ${userName}` : "Cuentas guardadas del cliente"}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {loadingAccounts ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
                                </div>
                            ) : accounts.length === 0 ? (
                                <div className="text-center py-10 border-2 border-dashed rounded-xl text-muted-foreground space-y-2">
                                    <Landmark className="mx-auto h-10 w-10 opacity-40" />
                                    <p className="font-medium">Este cliente no tiene cuentas guardadas</p>
                                    <p className="text-sm">Agrega su primera cuenta bancaria.</p>
                                </div>
                            ) : (
                                accounts.map(acc => (
                                    <div
                                        key={acc.id}
                                        className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                                    >
                                        <div className="space-y-0.5 flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold text-sm">{acc.alias}</span>
                                                <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{acc.country}</span>
                                            </div>
                                            <div className="text-xs text-muted-foreground">{acc.bank_name}</div>
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <CreditCard className="h-3 w-3 flex-shrink-0" />
                                                <span className="truncate">{acc.account_number}</span>
                                            </div>
                                            {acc.details?.id_number && (
                                                <div className="text-xs text-muted-foreground">
                                                    ID: {acc.details.id_number}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-1 ml-2 flex-shrink-0">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                onClick={() => openEdit(acc)}
                                                title="Editar cuenta"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                onClick={() => handleDelete(acc)}
                                                title="Eliminar cuenta"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                        <CardFooter className="flex justify-between">
                            <Button variant="outline" onClick={onClose}>Cerrar</Button>
                            <Button onClick={openAdd}>
                                <Plus className="mr-2 h-4 w-4" />
                                Agregar Cuenta
                            </Button>
                        </CardFooter>
                    </>
                )}

                {/* ── VISTA: AGREGAR / EDITAR ── */}
                {(view === "add" || view === "edit") && (
                    <>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setView("list")}>
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                                <div>
                                    <CardTitle>{view === "edit" ? "Editar Cuenta" : "Nueva Cuenta"}</CardTitle>
                                    <CardDescription>
                                        {view === "edit"
                                            ? `Editando: ${editingAccount?.alias}`
                                            : "Esta cuenta se guardará en el perfil del cliente."}
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* BOTÓN PEGAR DATOS - solo Venezuela */}
                            {formData.country === 'VES' && (
                                <button
                                    type="button"
                                    onClick={handlePasteData}
                                    className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/70 text-primary text-sm font-medium py-2.5 transition-all duration-200 group"
                                >
                                    <ClipboardPaste className="h-4 w-4 group-hover:scale-110 transition-transform" />
                                    Pegar Datos desde WhatsApp
                                </button>
                            )}
                            {/* PAÍS */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">País</label>
                                <select
                                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={formData.country}
                                    onChange={e => {
                                        const country = e.target.value
                                        setFormData({
                                            ...formData,
                                            country,
                                            bank_name: country === 'PEN' && (formData.details.peru_type === 'Yape' || formData.details.peru_type === 'Plin')
                                                ? formData.details.peru_type.toUpperCase() : ""
                                        })
                                    }}
                                >
                                    <option value="VES">Venezuela</option>
                                    <option value="PEN">Perú</option>
                                    <option value="CLP">Chile</option>
                                    <option value="COP">Colombia</option>
                                    <option value="USD">USA</option>
                                </select>
                            </div>

                            {/* TIPO Venezuela */}
                            {formData.country === 'VES' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Tipo</label>
                                    <select
                                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={formData.details.venezuela_type}
                                        onChange={e => setFormData({ ...formData, details: { ...formData.details, venezuela_type: e.target.value } })}
                                    >
                                        <option value="Cuenta">Cuenta</option>
                                        <option value="Pago Móvil">Pago Móvil</option>
                                    </select>
                                </div>
                            )}

                            {/* TIPO Perú */}
                            {formData.country === 'PEN' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Tipo</label>
                                    <select
                                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={formData.details.peru_type}
                                        onChange={e => {
                                            const type = e.target.value
                                            setFormData({
                                                ...formData,
                                                bank_name: (type === 'Yape' || type === 'Plin') ? type.toUpperCase() : "",
                                                details: { ...formData.details, peru_type: type }
                                            })
                                        }}
                                    >
                                        <option value="Cuenta">Cuenta</option>
                                        <option value="Yape">Yape</option>
                                        <option value="Plin">Plin</option>
                                    </select>
                                </div>
                            )}

                            {/* ALIAS */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Nombre / Alias</label>
                                <Input
                                    placeholder="Ej: Mamá Banesco"
                                    value={formData.alias}
                                    onChange={e => setFormData({ ...formData, alias: e.target.value })}
                                />
                            </div>

                            {/* BANCO + NÚMERO (no USA) */}
                            {formData.country !== 'USD' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Banco</label>
                                        {formData.country === 'COP' ? (
                                            <select
                                                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                value={formData.bank_name}
                                                onChange={e => setFormData({ ...formData, bank_name: e.target.value })}
                                            >
                                                <option value="">Seleccionar Banco...</option>
                                                <option value="BANCOLOMBIA">BANCOLOMBIA</option>
                                                <option value="NEQUI">NEQUI</option>
                                                <option value="LLAVES BRE-B">LLAVES BRE-B</option>
                                            </select>
                                        ) : (formData.country === 'PEN' && (formData.details.peru_type === 'Yape' || formData.details.peru_type === 'Plin')) ? (
                                            <Input value={formData.bank_name} disabled className="bg-muted" />
                                        ) : (
                                            <Input
                                                placeholder="Ej: Banesco"
                                                value={formData.bank_name}
                                                onChange={e => setFormData({ ...formData, bank_name: e.target.value })}
                                            />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">
                                            {(formData.country === 'VES' && formData.details.venezuela_type === 'Pago Móvil') ||
                                                (formData.country === 'PEN' && (formData.details.peru_type === 'Yape' || formData.details.peru_type === 'Plin')) ||
                                                (formData.country === 'COP' && (formData.bank_name === 'NEQUI' || formData.bank_name === 'LLAVES BRE-B'))
                                                ? 'Teléfono' : 'Cuenta'}
                                        </label>
                                        <Input
                                            placeholder={
                                                (formData.country === 'VES' && formData.details.venezuela_type === 'Pago Móvil') ||
                                                    (formData.country === 'PEN' && (formData.details.peru_type === 'Yape' || formData.details.peru_type === 'Plin')) ||
                                                    (formData.country === 'COP' && (formData.bank_name === 'NEQUI' || formData.bank_name === 'LLAVES BRE-B'))
                                                    ? "310..." : "0102..."
                                            }
                                            value={formData.account_number}
                                            onChange={e => setFormData({ ...formData, account_number: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* USA: Teléfono / Correo */}
                            {formData.country === 'USD' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Teléfono / Correo</label>
                                    <Input
                                        placeholder="Ej: +1... o email@example.com"
                                        value={formData.account_number}
                                        onChange={e => setFormData({ ...formData, account_number: e.target.value })}
                                    />
                                </div>
                            )}

                            {/* DETALLES ADICIONALES */}
                            {formData.country !== 'USD' && (
                                <div className="grid grid-cols-2 gap-4">
                                    {(formData.country === 'CLP' || formData.country === 'COP') ? (
                                        <>
                                            {formData.country === 'CLP' && (
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">RUT</label>
                                                    <Input
                                                        placeholder="78.105.121-7"
                                                        value={formData.details.rut}
                                                        onChange={e => setFormData({ ...formData, details: { ...formData.details, rut: e.target.value } })}
                                                    />
                                                </div>
                                            )}
                                            {formData.country === 'COP' && (
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">Cédula (Opcional)</label>
                                                    <Input
                                                        placeholder="Ej: 12345678"
                                                        value={formData.details.id_number}
                                                        onChange={e => setFormData({ ...formData, details: { ...formData.details, id_number: e.target.value } })}
                                                    />
                                                </div>
                                            )}
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">
                                                    Tipo de Cuenta {formData.country === 'COP' && '(Opcional)'}
                                                </label>
                                                <select
                                                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                    value={formData.details.account_type}
                                                    onChange={e => setFormData({ ...formData, details: { ...formData.details, account_type: e.target.value } })}
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {formData.country === 'COP' ? (
                                                        <>
                                                            <option value="Corriente">Corriente</option>
                                                            <option value="Ahorro">Ahorro</option>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <option value="Vista">Vista</option>
                                                            <option value="Corriente">Corriente</option>
                                                            <option value="Ahorro">Ahorro</option>
                                                            {formData.country === 'CLP' && <option value="RUT">RUT (Banco Estado)</option>}
                                                        </>
                                                    )}
                                                </select>
                                            </div>
                                            {formData.country === 'CLP' && (
                                                <div className="space-y-2 col-span-2">
                                                    <label className="text-sm font-medium">Correo Electrónico</label>
                                                    <Input
                                                        type="email"
                                                        placeholder="ejemplo@correo.com"
                                                        value={formData.details.email}
                                                        onChange={e => setFormData({ ...formData, details: { ...formData.details, email: e.target.value } })}
                                                    />
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {formData.country !== 'PEN' && (
                                                <div className="space-y-2 col-span-2">
                                                    <label className="text-sm font-medium">Documento (solo números)</label>
                                                    <Input
                                                        placeholder="12345678"
                                                        value={formData.details.id_number}
                                                        onChange={e => {
                                                            const val = e.target.value
                                                            if (formData.country === 'VES' && !/^\d*$/.test(val)) return
                                                            setFormData({ ...formData, details: { ...formData.details, id_number: val } })
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setView("list")} disabled={saving}>
                                Volver
                            </Button>
                            <Button onClick={handleSave} disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {view === "edit" ? "Guardar Cambios" : "Guardar Cuenta"}
                            </Button>
                        </CardFooter>
                    </>
                )}
            </Card>
        </div>
    )
}
