"use client"

import Link from "next/link"
import { BarChart3, List, Settings, LogOut, LayoutDashboard, Wallet, TrendingUp, Bell } from "lucide-react"
import { NotificationBell } from "@/components/NotificationBell"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Logo } from "@/components/logo"

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const router = useRouter()
    const [authorized, setAuthorized] = useState<boolean | null>(null)
    const [role, setRole] = useState<string | null>(null)

    useEffect(() => {
        const checkAdmin = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push("/login")
                return
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single()

            if (!profile || (profile.role !== 'admin' && profile.role !== 'operator')) {
                router.push("/dashboard")
                setAuthorized(false)
            } else {
                setRole(profile.role)
                setAuthorized(true)
            }
        }
        checkAdmin()
    }, [router])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push("/login")
    }

    if (authorized === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    if (!authorized) return null

    const navItems = [
        { href: "/admin", icon: List, label: "Operaciones" },
        { href: "/admin/rates", icon: BarChart3, label: "Tasas" },
        { href: "/admin/users", icon: Settings, label: "Usuarios" },
        { href: "/admin/payment-methods", icon: LayoutDashboard, label: "Cuentas" },
        { href: "/admin/deposits", icon: Wallet, label: "Depósitos" },
        { href: "/admin/notifications", icon: Bell, label: "Notificaciones" },
        { href: "/admin/profits", icon: TrendingUp, label: "Ganancias", adminOnly: true },
    ].filter(item => !item.adminOnly || role === 'admin')

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
            <aside className="fixed inset-y-0 left-0 z-10 hidden w-16 flex-col border-r bg-background sm:flex shadow-sm">
                <nav className="flex flex-col items-center gap-6 px-2 sm:py-8">
                    <Logo collapsed={true} showText={false} />
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary group relative"
                            title={item.label}
                        >
                            <item.icon className="h-5 w-5" />
                            <span className="absolute left-14 bg-primary text-primary-foreground text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-sm pointer-events-none">
                                {item.label}
                            </span>
                        </Link>
                    ))}
                </nav>
                <nav className="mt-auto flex flex-col items-center gap-4 px-2 sm:py-8">
                    <button
                        onClick={handleLogout}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive group relative"
                        title="Cerrar Sesión"
                    >
                        <LogOut className="h-5 w-5" />
                        <span className="absolute left-14 bg-destructive text-destructive-foreground text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-sm pointer-events-none">
                            Cerrar Sesión
                        </span>
                    </button>
                </nav>
            </aside>
            <div className="flex flex-col sm:pl-16">
                <header className="h-16 border-b bg-background/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-20">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-bold text-foreground uppercase tracking-tight">Administración</h2>
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{role}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <NotificationBell />
                    </div>
                </header>
                <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-6 md:gap-8">
                    {children}
                </main>
            </div>
        </div>
    )
}
