"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react"
import Link from "next/link"

export default function FixLogin() {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [message, setMessage] = useState("")

    const runFix = async () => {
        setStatus('loading')
        try {
            // 1. Restaurar Admin via Client SDK (No necesita Service Role Key)
            const { error: adminError } = await supabase.auth.signUp({
                email: '584144007220@venecambio.app',
                password: 'password123', // Usaremos una clave más segura por defecto
                options: {
                    data: {
                        full_name: "Administrador Principal",
                        phone: "+584144007220",
                        role: "admin"
                    }
                }
            })

            if (adminError) throw adminError

            // 2. Restaurar Operadora
            const { error: opError } = await supabase.auth.signUp({
                email: '584124139923@venecambio.app',
                password: 'password123',
                options: {
                    data: {
                        full_name: "MISDEILYS JIMENEZ",
                        phone: "+584124139923",
                        role: "operator"
                    }
                }
            })

            if (opError) throw opError

            setStatus('success')
            setMessage("Cuentas creadas. Ahora solo falta ejecutar el SQL para activar los permisos.")
        } catch (error: any) {
            console.error(error)
            setStatus('error')
            setMessage(error.message || "Error al restaurar usuarios")
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <Card className="max-w-md w-full shadow-lg">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">Restauración Directa</CardTitle>
                    <CardDescription>Esta herramienta registrará las cuentas usando el SDK oficial.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 text-center">
                    {status === 'idle' && (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-600">Se registrarán los teléfonos +584144007220 y +584124139923 con la clave: <b>password123</b></p>
                            <Button onClick={runFix} className="w-full bg-blue-600 hover:bg-blue-700">Registrar Cuentas</Button>
                        </div>
                    )}

                    {status === 'loading' && (
                        <div className="flex flex-col items-center py-6 gap-3">
                            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                            <p className="font-medium animate-pulse text-slate-600">Registrando en Supabase Auth...</p>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="flex flex-col items-center py-6 gap-4">
                            <CheckCircle2 className="w-16 h-16 text-green-500" />
                            <div className="space-y-2">
                                <p className="text-xl font-bold text-green-700">¡Registro Completado!</p>
                                <p className="text-sm text-slate-600">Para terminar, ejecuta este SQL en Supabase para darte el rango de Admin:</p>
                                <pre className="bg-slate-100 p-2 text-[10px] text-left rounded overflow-x-auto">
                                    UPDATE public.profiles SET role = 'admin' WHERE email = '584144007220@venecambio.app';
                                </pre>
                            </div>
                            <Button asChild variant="outline" className="mt-4">
                                <Link href="/login">Ir al Login</Link>
                            </Button>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="flex flex-col items-center py-6 gap-4">
                            <AlertTriangle className="w-16 h-16 text-red-500" />
                            <div className="space-y-1">
                                <p className="text-lg font-bold text-red-700">Error detectado</p>
                                <p className="text-sm text-slate-500">{message}</p>
                                <p className="text-[10px] text-slate-400 mt-2">Prueba borrar los usuarios previos en SQL si el error persiste.</p>
                            </div>
                            <Button onClick={runFix} variant="secondary">Reintentar</Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
