"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function LoginPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [phone, setPhone] = useState("")
    const [password, setPassword] = useState("")

    // Cargar el último teléfono usado
    useEffect(() => {
        const savedPhone = localStorage.getItem("lastPhone")
        if (savedPhone) {
            setPhone(savedPhone)
        }
    }, [])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            // Convertir teléfono a email técnico para Auth
            const technicalEmail = `${phone.replace('+', '')}@venecambio.app`

            const { error } = await supabase.auth.signInWithPassword({
                email: technicalEmail,
                password,
            })

            if (error) throw error

            // Guardar teléfono para agilizar próximo ingreso
            localStorage.setItem("lastPhone", phone)

            // Verificar si debe cambiar clave
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('must_change_password')
                    .eq('id', user.id)
                    .single()

                if (profile?.must_change_password) {
                    router.push("/dashboard/change-password")
                } else {
                    router.push("/dashboard")
                }
            }
        } catch (error: any) {
            console.error("Error al ingresar:", error)
            alert(error.message || "Error al iniciar sesión")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
            <Card className="w-full max-w-sm">
                <form onSubmit={handleLogin}>
                    <CardHeader>
                        <CardTitle className="text-2xl">Iniciar Sesión</CardTitle>
                        <CardDescription>
                            Ingresa tu teléfono y contraseña para acceder.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-2">
                            <label htmlFor="phone" className="text-sm font-medium leading-none">Teléfono (con +)</label>
                            <Input
                                id="phone"
                                type="text"
                                placeholder="+51..."
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <label htmlFor="password" className="text-sm font-medium leading-none">Contraseña</label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Ingresando..." : "Ingresar"}
                        </Button>
                        <div className="text-center text-sm text-muted-foreground">
                            ¿No tienes cuenta?{" "}
                            <a href="https://wa.me/584227173725" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                                Contáctanos
                            </a>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
