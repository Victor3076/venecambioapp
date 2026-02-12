"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function RegisterPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: name,
                    }
                }
            })

            if (error) throw error

            alert("¡Registro exitoso! Ya puedes iniciar sesión.")
            router.push("/login")
        } catch (error: any) {
            console.error("Error al registrar:", error)
            alert(error.message || "Error al crear la cuenta")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
            <Card className="w-full max-w-sm">
                <form onSubmit={handleRegister}>
                    <CardHeader>
                        <CardTitle className="text-2xl">Crear Cuenta</CardTitle>
                        <CardDescription>
                            Regístrate para gestionar tus envíos y cuentas.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-2">
                            <label htmlFor="name" className="text-sm font-medium leading-none">Nombre Completo</label>
                            <Input
                                id="name"
                                placeholder="Juan Pérez"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <label htmlFor="email" className="text-sm font-medium leading-none">Email</label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="m@ejemplo.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
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
                            {loading ? "Registrando..." : "Registrarse"}
                        </Button>
                        <div className="text-center text-sm text-muted-foreground">
                            ¿Ya tienes cuenta?{" "}
                            <Link href="/login" className="underline hover:text-primary">
                                Inicia Sesión
                            </Link>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
