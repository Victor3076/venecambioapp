"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react"

interface Step {
    target: string
    title: string
    content: string
}

const steps: Step[] = [
    {
        target: "#tour-welcome",
        title: "¡Bienvenido a Venecambio!",
        content: "Este es tu panel de control donde podrás ver un resumen de tus actividades diarias."
    },
    {
        target: "#tour-new-operation",
        title: "Nueva Operación",
        content: "Haz clic en este botón cuando quieras realizar un nuevo envío de dinero."
    },
    {
        target: "#tour-history",
        title: "Tu Historial",
        content: "Aquí aparecerá la cantidad de operaciones que has realizado con nosotros."
    },
    {
        target: "#tour-accounts",
        title: "Beneficiarios",
        content: "Lleva el control de cuántas cuentas de destino tienes registradas actualmente."
    },
    {
        target: "#tour-sidebar-accounts",
        title: "Gestionar Cuentas",
        content: "En el menú lateral, 'Mis Cuentas' te permite agregar o editar tus beneficiarios y cuentas bancarias."
    }
]

export function DashboardTour() {
    const [isVisible, setIsVisible] = useState(false)
    const [currentStep, setCurrentStep] = useState(0)
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, height: 0 })

    useEffect(() => {
        const hasSeenTour = localStorage.getItem("venecambio-tour-completed")
        if (!hasSeenTour) {
            setIsVisible(true)
        }
    }, [])

    useEffect(() => {
        if (isVisible) {
            updateCoords()
            window.addEventListener('resize', updateCoords)
        }
        return () => window.removeEventListener('resize', updateCoords)
    }, [isVisible, currentStep])

    const updateCoords = () => {
        const element = document.querySelector(steps[currentStep].target)
        if (element) {
            const rect = element.getBoundingClientRect()
            setCoords({
                top: rect.top + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width,
                height: rect.height
            })
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    }

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1)
        } else {
            completeTour()
        }
    }

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1)
        }
    }

    const completeTour = () => {
        setIsVisible(false)
        localStorage.setItem("venecambio-tour-completed", "true")
    }

    if (!isVisible) return null

    return (
        <div className="fixed inset-0 z-[100] pointer-events-none">
            {/* Overlay with hole */}
            <div
                className="absolute inset-0 bg-black/50 transition-all duration-300 pointer-events-auto"
                style={{
                    clipPath: `polygon(
                        0% 0%, 0% 100%, 
                        ${coords.left}px 100%, 
                        ${coords.left}px ${coords.top}px, 
                        ${coords.left + coords.width}px ${coords.top}px, 
                        ${coords.left + coords.width}px ${coords.top + coords.height}px, 
                        ${coords.left}px ${coords.top + coords.height}px, 
                        ${coords.left}px 100%, 
                        100% 100%, 100% 0%
                    )`
                }}
            />

            {/* Tooltip */}
            <div
                className="absolute bg-background p-6 rounded-xl shadow-2xl border-2 border-primary w-80 pointer-events-auto transition-all duration-300"
                style={{
                    top: coords.top + coords.height + 20 > window.innerHeight + window.scrollY - 200
                        ? coords.top - 220
                        : coords.top + coords.height + 20,
                    left: Math.min(Math.max(20, coords.left + (coords.width / 2) - 160), window.innerWidth - 340)
                }}
            >
                <button
                    onClick={completeTour}
                    className="absolute top-2 right-2 p-1 hover:bg-muted rounded-full transition-colors"
                >
                    <X className="w-4 h-4 text-muted-foreground" />
                </button>

                <div className="flex items-center gap-2 mb-2 text-primary">
                    <Sparkles className="w-5 h-5" />
                    <h3 className="font-bold text-lg">{steps[currentStep].title}</h3>
                </div>

                <p className="text-sm text-muted-foreground mb-6">
                    {steps[currentStep].content}
                </p>

                <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                        {steps.map((_, i) => (
                            <div
                                key={i}
                                className={`h-1.5 rounded-full transition-all ${i === currentStep ? 'w-4 bg-primary' : 'w-1.5 bg-primary/20'}`}
                            />
                        ))}
                    </div>
                    <div className="flex gap-2">
                        {currentStep > 0 && (
                            <Button variant="ghost" size="sm" onClick={handleBack}>
                                <ChevronLeft className="w-4 h-4 mr-1" /> Atrás
                            </Button>
                        )}
                        <Button size="sm" onClick={handleNext}>
                            {currentStep === steps.length - 1 ? "Finalizar" : "Siguiente"}
                            {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4 ml-1" />}
                        </Button>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t text-center">
                    <button
                        onClick={completeTour}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-4"
                    >
                        Omitir tour
                    </button>
                </div>
            </div>
        </div>
    )
}
