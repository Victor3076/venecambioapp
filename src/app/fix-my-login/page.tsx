"use client"

import { useEffect, useState } from "react"
import { createUser } from "@/app/admin/users/actions"
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
            // 1. Restaurar Admin
            await createUser({
                phone: "+584144007220",
                fullName: "Administrador Principal",
                role: "admin",
                password: "123456"
            })

            // 2. Restaurar Operador
            await createUser({
                phone: "+584124139923",
                fullName: "MISDEILYS JIMENEZ",
                role: "operator",
                password: "123456"
            })

            setStatus('success')
            setMessage("Usuarios restaurados exitosamente.")
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
                    <CardTitle className="text-2xl font-bold">Restauración de Sistema</CardTitle>
                    <CardDescription>Esta herramienta recreará las cuentas administrativas básicas.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 text-center">
                    {status === 'idle' && (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-600">Al presionar el botón, se crearán las cuentas para +584144007220 y +584124139923 con la clave provisional 123456.</p>
                            <Button onClick={runFix} className="w-full bg-blue-600 hover:bg-blue-700">Comenzar Restauración</Button>
                        </div>
                    )}

                    {status === 'loading' && (
                        <div className="flex flex-col items-center py-6 gap-3">
                            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                            <p className="font-medium animate-pulse text-slate-600">Recreando perfiles de seguridad...</p>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="flex flex-col items-center py-6 gap-4">
                            <CheckCircle2 className="w-16 h-16 text-green-500" />
                            <div className="space-y-1">
                                <p className="text-xl font-bold text-green-700">{message}</p>
                                <p className="text-sm text-slate-500">Ya puedes cerrar esta página e intentar iniciar sesión.</p>
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
                                <p className="text-lg font-bold text-red-700">Ocurrió un error</p>
                                <p className="text-sm text-slate-500">{message}</p>
                            </div>
                            <Button onClick={runFix} variant="secondary">Reintentar</Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
