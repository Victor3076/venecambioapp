"use client"

import { Input } from "@/components/ui/input"
import { SUPPORTED_REGIONS } from "@/lib/constants"

export interface BeneficiaryData {
    alias: string
    country: string
    bank_name: string
    account_number: string
    details: {
        id_number?: string
        email?: string
        account_type?: string
        rut?: string
        venezuela_type?: string
        peru_type?: string
    }
}

interface BeneficiaryFormProps {
    data: BeneficiaryData
    onChange: (data: BeneficiaryData) => void
    fixedCountry?: string
}

export function BeneficiaryForm({ data, onChange, fixedCountry }: BeneficiaryFormProps) {
    const updateData = (updates: Partial<BeneficiaryData>) => {
        onChange({ ...data, ...updates })
    }

    const updateDetails = (updates: Partial<BeneficiaryData['details']>) => {
        onChange({
            ...data,
            details: { ...data.details, ...updates }
        })
    }

    const country = fixedCountry || data.country

    return (
        <div className="space-y-4">
            {/* 1. Country Select (if not fixed) */}
            {!fixedCountry && (
                <div className="space-y-2">
                    <label className="text-sm font-medium">País</label>
                    <select
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={data.country}
                        onChange={e => {
                            const newCountry = e.target.value;
                            onChange({
                                ...data,
                                country: newCountry,
                                bank_name: newCountry === 'PERU' && (data.details.peru_type === 'Yape' || data.details.peru_type === 'Plin') ? data.details.peru_type.toUpperCase() : ""
                            });
                        }}
                    >
                        <option value="VES">Venezuela</option>
                        <option value="PEN">Perú</option>
                        <option value="CLP">Chile</option>
                        <option value="COP">Colombia</option>
                        <option value="USD">USA</option>
                    </select>
                </div>
            )}

            {/* 2. Type (Conditional for Venezuela/Peru) */}
            {country === 'VES' && (
                <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo</label>
                    <select
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={data.details.venezuela_type || "Cuenta"}
                        onChange={e => updateDetails({ venezuela_type: e.target.value })}
                    >
                        <option value="Cuenta">Cuenta</option>
                        <option value="Pago Móvil">Pago Móvil</option>
                    </select>
                </div>
            )}

            {country === 'PEN' && (
                <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo</label>
                    <select
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={data.details.peru_type || "Cuenta"}
                        onChange={e => {
                            const type = e.target.value;
                            onChange({
                                ...data,
                                bank_name: (type === 'Yape' || type === 'Plin') ? type.toUpperCase() : "",
                                details: { ...data.details, peru_type: type }
                            })
                        }}
                    >
                        <option value="Cuenta">Cuenta</option>
                        <option value="Yape">Yape</option>
                        <option value="Plin">Plin</option>
                    </select>
                </div>
            )}

            {/* 3. Name / Alias */}
            <div className="space-y-2">
                <label className="text-sm font-medium">Nombre / Alias</label>
                <Input
                    placeholder="Ej: Mamá Banesco"
                    value={data.alias}
                    onChange={e => updateData({ alias: e.target.value })}
                />
            </div>

            {/* 4. Banco & 5. Número / Teléfono (Hidden for USA) */}
            {country !== 'USD' && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Banco</label>
                        {country === 'COP' ? (
                            <select
                                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={data.bank_name}
                                onChange={e => updateData({ bank_name: e.target.value })}
                            >
                                <option value="">Seleccionar Banco...</option>
                                <option value="BANCOLOMBIA">BANCOLOMBIA</option>
                                <option value="NEQUI">NEQUI</option>
                                <option value="LLAVES BRE-B">LLAVES BRE-B</option>
                            </select>
                        ) : (country === 'PEN' && (data.details.peru_type === 'Yape' || data.details.peru_type === 'Plin')) ? (
                            <Input
                                value={data.bank_name}
                                disabled
                                className="bg-muted"
                            />
                        ) : (
                            <Input
                                placeholder="Ej: Banesco"
                                value={data.bank_name}
                                onChange={e => updateData({ bank_name: e.target.value })}
                            />
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            {(country === 'VES' && data.details.venezuela_type === 'Pago Móvil') ||
                                (country === 'PEN' && (data.details.peru_type === 'Yape' || data.details.peru_type === 'Plin')) ||
                                (country === 'COP' && (data.bank_name === 'NEQUI' || data.bank_name === 'LLAVES BRE-B'))
                                ? 'Teléfono'
                                : 'Cuenta'
                            }
                        </label>
                        <Input
                            placeholder={
                                (country === 'VES' && data.details.venezuela_type === 'Pago Móvil') ||
                                    (country === 'PEN' && (data.details.peru_type === 'Yape' || data.details.peru_type === 'Plin')) ||
                                    (country === 'COP' && (data.bank_name === 'NEQUI' || data.bank_name === 'LLAVES BRE-B'))
                                    ? "310..." : "0102..."
                            }
                            value={data.account_number}
                            onChange={e => {
                                const val = e.target.value.replace(/[\s\-\.\(\)]/g, '');
                                const isPhone = (country === 'VES' && data.details.venezuela_type === 'Pago Móvil') ||
                                    (country === 'PEN' && (data.details.peru_type === 'Yape' || data.details.peru_type === 'Plin')) ||
                                    (country === 'COP' && (data.bank_name === 'NEQUI' || data.bank_name === 'LLAVES BRE-B'));

                                if ((country === 'VES' || isPhone) && !/^\d*$/.test(val)) return;
                                updateData({ account_number: val });
                            }}
                        />
                    </div>
                </div>
            )}

            {/* USA: Teléfono / Correo */}
            {country === 'USD' && (
                <div className="space-y-2">
                    <label className="text-sm font-medium">Teléfono / Correo</label>
                    <Input
                        placeholder="Ej: +1... o email@example.com"
                        value={data.account_number}
                        onChange={e => updateData({ account_number: e.target.value })}
                    />
                </div>
            )}

            {/* 6. Detalles Adicionales (Hidden for USA) */}
            {country !== 'USA' && (
                <div className="grid grid-cols-2 gap-4">
                    {(country === 'CLP' || country === 'COP') ? (
                        <>
                            {country === 'CLP' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">RUT</label>
                                    <Input
                                        placeholder="78.105.121-7"
                                        value={data.details.rut}
                                        onChange={e => updateDetails({ rut: e.target.value })}
                                    />
                                </div>
                            )}
                            {country === 'COP' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Cédula (Opcional)</label>
                                    <Input
                                        placeholder="Ej: 12345678"
                                        value={data.details.id_number}
                                        onChange={e => updateDetails({ id_number: e.target.value })}
                                    />
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    Tipo de Cuenta {country === 'COP' && '(Opcional)'}
                                </label>
                                <select
                                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={data.details.account_type}
                                    onChange={e => updateDetails({ account_type: e.target.value })}
                                >
                                    <option value="">Seleccionar...</option>
                                    {country === 'COP' ? (
                                        <>
                                            <option value="Corriente">Corriente</option>
                                            <option value="Ahorro">Ahorro</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="Vista">Vista</option>
                                            <option value="Corriente">Corriente</option>
                                            <option value="Ahorro">Ahorro</option>
                                            {country === 'CLP' && <option value="RUT">RUT (Banco Estado)</option>}
                                        </>
                                    )}
                                </select>
                            </div>
                            {country === 'CLP' && (
                                <div className="space-y-2 col-span-2">
                                    <label className="text-sm font-medium">Correo Electrónico</label>
                                    <Input
                                        type="email"
                                        placeholder="ejemplo@correo.com"
                                        value={data.details.email}
                                        onChange={e => updateDetails({ email: e.target.value })}
                                    />
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            {country !== 'PEN' && (
                                <div className="space-y-2 col-span-2">
                                    <label className="text-sm font-medium">Documento (solo números)</label>
                                    <Input
                                        placeholder="12345678"
                                        value={data.details.id_number}
                                        onChange={e => {
                                            const val = e.target.value.replace(/[\s\-\.\(\)]/g, '');
                                            if (country === 'VES' && !/^\d*$/.test(val)) return;
                                            updateDetails({ id_number: val });
                                        }}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
