'use client'

import { useState, useEffect } from 'react'
import { X, Share, PlusSquare, Download } from 'lucide-react'

export function PwaInstallPrompt() {
    const [showPrompt, setShowPrompt] = useState(false)
    const [platform, setPlatform] = useState<'ios' | 'android' | 'other' | null>(null)

    useEffect(() => {
        // Check if app is already installed
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone ||
            document.referrer.includes('android-app://')

        if (isStandalone) return

        // Identify platform
        const userAgent = window.navigator.userAgent.toLowerCase()
        const isIos = /iphone|ipad|ipod/.test(userAgent)
        const isAndroid = /android/.test(userAgent)

        setPlatform(isIos ? 'ios' : isAndroid ? 'android' : 'other')

        // Show prompt after a short delay
        const timer = setTimeout(() => {
            setShowPrompt(true)
        }, 3000)

        return () => clearTimeout(timer)
    }, [])

    if (!showPrompt) return null

    return (
        <div className="fixed bottom-4 left-4 right-4 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-card border shadow-2xl rounded-2xl p-4 md:max-w-md md:mx-auto">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center overflow-hidden">
                            <img src="/logo.png" alt="VeneCambio" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">Instalar VeneCambio</h3>
                            <p className="text-sm text-muted-foreground">Úsala como una aplicación en tu celular</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowPrompt(false)}
                        className="p-1 hover:bg-muted rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                <div className="space-y-4">
                    {platform === 'ios' ? (
                        <div className="bg-muted/50 rounded-xl p-3 text-sm space-y-2">
                            <p className="flex items-center gap-2">
                                1. Toca el botón <strong>Compartir</strong> <Share className="w-4 h-4 inline" /> en la barra inferior.
                            </p>
                            <p className="flex items-center gap-2">
                                2. Busca y selecciona <strong>"Agregar a inicio"</strong> <PlusSquare className="w-4 h-4 inline" />.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-muted/50 rounded-xl p-3 text-sm space-y-2">
                            <p>
                                1. Toca los tres puntos <strong>(⋮)</strong> del navegador.
                            </p>
                            <p className="flex items-center gap-2">
                                2. Selecciona <strong>"Instalar aplicación"</strong> o <strong>"Añadir a pantalla de inicio"</strong>.
                            </p>
                        </div>
                    )}

                    <button
                        onClick={() => setShowPrompt(false)}
                        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                    >
                        <Download className="w-5 h-5" /> Entendido
                    </button>
                </div>
            </div>
        </div>
    )
}
