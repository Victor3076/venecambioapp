"use client"

import { useState, useEffect } from "react"
import { RatesData } from "@/services/rates"
import { calculateRate, formatRate, getRateDecimals } from "@/lib/rates-utils"
import { X, TrendingUp } from "lucide-react"

interface DailyRatesModalProps {
    rates: RatesData | null
    isOpen: boolean
    onClose: () => void
}

export function DailyRatesModal({ rates, isOpen, onClose }: DailyRatesModalProps) {
    const [currentDate, setCurrentDate] = useState("")

    useEffect(() => {
        // Formato de fecha "DD/MM/YYYY" o "27 Feb 2026"
        const date = new Date()
        const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }
        setCurrentDate(date.toLocaleDateString('es-VE', options))
    }, [])

    if (!isOpen) return null

    const getRateFor = (source: string) => {
        if (!rates) return "0,00"

        const sourcePrice = rates.usdt_prices[source as keyof typeof rates.usdt_prices] || 0
        const vesPrice = rates.usdt_prices.VES || 1 // Tasa VES local, no el oficial BCV

        const marginKey = `${source}_VES`
        const margin = rates.margins[marginKey] || rates.margins["GENERIC"] || 0

        const rawRate = calculateRate("VES", source, vesPrice, sourcePrice, margin)
        return formatRate(rawRate, "VES", source)
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-[360px] max-h-[90vh] aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl bg-white animate-in zoom-in-95 duration-200">

                {/* Botón de cerrar */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Imagen de fondo */}
                <img
                    src="/tasas.png"
                    alt="Tasas del día"
                    className="absolute inset-0 w-full h-full object-cover"
                />

                {/* Textos sobre la imagen */}
                {/* 1. Fecha (Recuadro negro) */}
                <div className="absolute top-[22.5%] right-[8%] w-[42%] text-center font-bold text-gray-800 text-lg sm:text-xl drop-shadow-sm flex items-center justify-center">
                    {currentDate}
                </div>

                {/* 2. Tasa Perú (Recuadro rojo) */}
                <div className="absolute top-[29%] right-[8%] w-[42%] h-[6%] text-center text-white font-extrabold text-xl sm:text-2xl drop-shadow-md flex items-center justify-center">
                    {getRateFor('PEN')}
                </div>

                {/* 3. Tasa Chile (Recuadro azul) */}
                <div className="absolute top-[39.5%] right-[8%] w-[42%] h-[6%] text-center text-white font-extrabold text-xl sm:text-2xl drop-shadow-md flex items-center justify-center">
                    {getRateFor('CLP')}
                </div>

                {/* 4. Tasa Colombia (Recuadro verde) */}
                <div className="absolute top-[50%] right-[8%] w-[42%] h-[6%] text-center text-white font-extrabold text-xl sm:text-2xl drop-shadow-md flex items-center justify-center">
                    {getRateFor('COP')}
                </div>

                {/* 5. Tasa EEUU (Recuadro blanco) */}
                <div className="absolute top-[61.3%] right-[8%] w-[42%] h-[6%] text-center text-white font-extrabold text-xl sm:text-2xl drop-shadow-md flex items-center justify-center">
                    {getRateFor('USD')}
                </div>

            </div>
        </div>
    )
}
