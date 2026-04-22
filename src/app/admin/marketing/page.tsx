"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Logo } from "@/components/logo"
import { CheckCircle2, ShieldCheck, Zap, Download, Phone, Globe, Smartphone, MousePointer2, X } from "lucide-react"
import { cn } from "@/lib/utils"

export default function AdminMarketingPage() {
    const [screenshotMode, setScreenshotMode] = useState(false)

    return (
        <div className={cn("flex flex-col items-center gap-8 py-8 px-4", screenshotMode && "bg-black p-0 min-h-screen justify-center")}>
            
            {!screenshotMode && (
                <div className="max-w-2xl w-full space-y-4 text-center">
                    <h1 className="text-3xl font-bold">Generador de Publicidad</h1>
                    <p className="text-muted-foreground">
                        Abre esta página en tu celular, activa el <b>Modo Captura</b> y toma un pantallazo para tus estados de WhatsApp.
                    </p>
                    <Button 
                        size="lg" 
                        onClick={() => setScreenshotMode(true)}
                        className="w-full sm:w-auto gap-2"
                    >
                        <Smartphone className="w-5 h-5" /> Activar Modo Captura
                    </Button>
                </div>
            )}

            {/* THE POSTER */}
            <div className={cn(
                "relative bg-white aspect-[9/16] w-full max-w-[400px] overflow-hidden shadow-2xl transition-all duration-500 rounded-3xl",
                screenshotMode ? "ring-0" : "ring-1 ring-black/5"
            )}>
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/10 rounded-full translate-y-1/2 -translate-x-1/2" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[40%] bg-muted/30 -rotate-12" />

                <div className="relative h-full flex flex-col p-8 z-10">
                    {/* Header */}
                    <div className="flex justify-center mb-10">
                        <Logo className="scale-125" />
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 flex flex-col justify-center gap-8">
                        <div className="space-y-2 text-center">
                            <h2 className="text-4xl font-black tracking-tight leading-tight text-foreground uppercase italic underline decoration-primary decoration-4 underline-offset-4">
                                ¡CAMBIA MÁS RÁPIDO!
                            </h2>
                            <p className="text-xl font-bold text-primary">Usa nuestra plataforma web</p>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center gap-4 bg-muted/40 p-4 rounded-2xl border border-white shadow-sm">
                                <div className="bg-primary/20 p-3 rounded-xl text-primary">
                                    <Zap className="w-6 h-6 fill-primary/30" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg leading-none">INMEDIATEZ</h4>
                                    <p className="text-sm text-muted-foreground">Sin esperas ni demoras.</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 bg-muted/40 p-4 rounded-2xl border border-white shadow-sm">
                                <div className="bg-primary/20 p-3 rounded-xl text-primary">
                                    <ShieldCheck className="w-6 h-6 fill-primary/30" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg leading-none">SEGURIDAD</h4>
                                    <p className="text-sm text-muted-foreground">Tus datos 100% protegidos.</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 bg-muted/40 p-4 rounded-2xl border border-white shadow-sm">
                                <div className="bg-primary/20 p-3 rounded-xl text-primary">
                                    <CheckCircle2 className="w-6 h-6 fill-primary/30" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg leading-none">CONTROL TOTAL</h4>
                                    <p className="text-sm text-muted-foreground">Historial y recibos a mano.</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 bg-primary rounded-2xl p-6 text-center text-primary-foreground shadow-lg shadow-primary/25 space-y-3">
                            <div className="flex justify-center flex-col items-center gap-1">
                                <Globe className="w-8 h-8 opacity-80" />
                                <span className="text-2xl font-black tracking-wide">VeneCambio.com</span>
                            </div>
                            <div className="flex items-center justify-center gap-2 text-xs font-bold opacity-90 uppercase tracking-widest border-t border-white/20 pt-3">
                                <MousePointer2 className="w-3 h-3" /> Haz click en enviar ahora
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-auto text-center border-t pt-6">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                            © 2026 Venecambio • Remesas Inteligentes
                        </p>
                    </div>
                </div>

                {screenshotMode && (
                    <button 
                        onClick={() => setScreenshotMode(false)}
                        className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded-full shadow-lg z-50 animate-pulse"
                    >
                        <X className="w-6 h-6" />
                    </button>
                )}
            </div>

            {!screenshotMode && (
                <Card className="max-w-2xl w-full p-6 space-y-4 bg-primary/5 border-primary/10">
                    <h3 className="font-bold flex items-center gap-2">
                        <Download className="w-5 h-5 text-primary" /> Consejos para compartir:
                    </h3>
                    <ul className="text-sm space-y-2 list-disc list-inside text-muted-foreground">
                        <li><b>iPhone:</b> Pulsa botón lateral + subir volumen.</li>
                        <li><b>Android:</b> Pulsa botón encendido + bajar volumen.</li>
                        <li>Sube la imagen a tu <b>Estado de WhatsApp</b> con el link: <i>https://venecambio.com</i></li>
                    </ul>
                </Card>
            )}
        </div>
    )
}
