"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { MessageCircle, ArrowLeft } from "lucide-react"

export default function RegisterPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
            <Card className="w-full max-w-sm shadow-xl border-none">
                <CardHeader className="text-center">
                    <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                        <MessageCircle className="w-8 h-8" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Solicitar Cuenta</CardTitle>
                    <CardDescription>
                        El registro de usuarios está restringido a administradores.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                    <p className="text-sm text-balance text-muted-foreground">
                        Para obtener tu usuario y clave, por favor comunícate con nosotros vía WhatsApp.
                    </p>
                    <Button asChild className="w-full bg-green-600 hover:bg-green-700 h-12 text-base font-bold">
                        <a
                            href="https://wa.me/584227173725"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2"
                        >
                            Solicitar por WhatsApp
                        </a>
                    </Button>
                </CardContent>
                <CardFooter className="flex flex-col gap-4 border-t pt-6 bg-muted/20">
                    <Link href="/login" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-2 transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Volver al Inicio de Sesión
                    </Link>
                </CardFooter>
            </Card>
        </div>
    )
}
