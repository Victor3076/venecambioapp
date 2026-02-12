"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react"

export default function ChangePasswordPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [success, setSuccess] = useState(false)

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password !== confirmPassword) {
            alert("Las contraseñas no coinciden")
            return
        }
        if (password.length < 6) {
            alert("La contraseña debe tener al menos 6 caracteres")
            return
        }

        setLoading(true)
        try {
            // 1. Actualizar contraseña en Auth
            const { error: authError } = await supabase.auth.updateUser({
                password: password
            })
            if (authError) throw authError

            // 2. Marcar must_change_password como false en Profile
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({ must_change_password: false })
                    .eq('id', user.id)

                if (profileError) throw profileError
            }

            setSuccess(true)
            setTimeout(() => {
                router.push("/dashboard")
            }, 2000)
        } catch (error: any) {
            console.error(error)
            alert(error.message || "Error al cambiar contraseña")
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
                <Card className="w-full max-w-md text-center py-12">
                    <CardContent className="space-y-4">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-10 h-10" />
                        </div>
                        <CardTitle className="text-2xl">¡Clave Actualizada!</CardTitle>
                        <CardDescription>Tu seguridad es nuestra prioridad. Redirigiendo al panel...</CardDescription>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
            <Card className="w-full max-w-md shadow-xl border-2 border-primary/20">
                <form onSubmit={handleChangePassword}>
                    <CardHeader className="space-y-1">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                            <Lock className="w-6 h-6 text-primary" />
                        </div>
                        <CardTitle className="text-2xl">Cambia tu contraseña</CardTitle>
                        <CardDescription>
                            Para tu seguridad, debes cambiar la clave temporal "123456" la primera vez que ingresas.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-2 relative">
                            <label className="text-sm font-medium">Nueva Contraseña</label>
                            <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="******"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-8 text-muted-foreground hover:text-primary transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Confirmar Contraseña</label>
                            <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="******"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Actualizando..." : "Guardar y Continuar"}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
