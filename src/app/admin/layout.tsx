"use client"
// v1.1 - Added Manual Cuadre (CL)

import Link from "next/link"
import { BarChart3, List, Settings, LogOut, LayoutDashboard, Wallet, TrendingUp, Bell, Menu, X, Scale, Megaphone } from "lucide-react"
import { NotificationBell } from "@/components/NotificationBell"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useRouter, usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"

const CLIcon = ({ className }: { className?: string }) => (
    <div className={cn("flex items-center justify-center font-black text-[10px] border-2 border-current rounded-[4px] leading-none select-none", className)}>
        CL
    </div>
)

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const router = useRouter()
    const pathname = usePathname()
    const [authorized, setAuthorized] = useState<boolean | null>(null)
    const [role, setRole] = useState<string | null>(null)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    // Cerrar menú móvil cuando cambia la ruta
    useEffect(() => {
        setIsMobileMenuOpen(false)
    }, [pathname])

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
        { href: "/admin/transactions", icon: List, label: "Operaciones" },
        { href: "/admin/deposits", icon: Wallet, label: "Depósitos" },
        { href: "/admin/rates", icon: BarChart3, label: "Tasas" },
        { href: "/admin/users", icon: Settings, label: "Usuarios" },
        { href: "/admin/payment-methods", icon: LayoutDashboard, label: "Cuentas" },
        { href: "/admin/balance", icon: Scale, label: "Cuadre", adminOnly: true },
        { href: "/admin/manual-cuadre", icon: CLIcon, label: "Cierre CL", adminOnly: true },
        { href: "/admin/notifications", icon: Bell, label: "Notificaciones" },
        { href: "/admin/profits", icon: TrendingUp, label: "Ganancias", adminOnly: true },
        { href: "/admin/marketing", icon: Megaphone, label: "Marketing" },
    ].filter(item => !item.adminOnly || role === 'admin')

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40 overflow-x-hidden">
            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-40 sm:hidden animate-in fade-in duration-300"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Mobile Sidebar Drawer */}
            <aside className={cn(
                "fixed inset-y-0 left-0 w-[280px] bg-background z-50 sm:hidden transition-transform duration-300 ease-in-out shadow-2xl flex flex-col",
                isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="h-16 flex items-center justify-between px-6 border-b">
                    <Logo />
                    <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)} className="h-8 w-8">
                        <X className="h-5 w-5" />
                    </Button>
                </div>
                <div className="flex-1 overflow-y-auto py-4">
                    <nav className="flex flex-col gap-2 px-4">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                                    pathname === item.href
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <item.icon className="h-5 w-5" />
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </div>
                <div className="p-4 border-t bg-muted/5">
                    <Button
                        variant="ghost"
                        className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/5 font-medium"
                        onClick={handleLogout}
                    >
                        <LogOut className="h-5 w-5" /> Cerrar Sesión
                    </Button>
                </div>
            </aside>

            {/* Desktop Sidebar */}
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
            <div className="flex flex-col sm:pl-16 min-w-0">
                <header className="h-16 border-b bg-background/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 shadow-sm">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="sm:hidden -ml-2 h-9 w-9"
                            onClick={() => setIsMobileMenuOpen(true)}
                        >
                            <Menu className="h-5 w-5" />
                        </Button>
                        <h2 className="text-base sm:text-lg font-bold text-foreground uppercase tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">Administración</h2>
                        <span className="hidden xs:inline-block text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold ml-1">{role}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <NotificationBell />
                    </div>
                </header>
                <main className="flex flex-col flex-1 gap-4 p-4 sm:px-6 sm:py-6 md:gap-8 min-w-0 w-full">
                    {children}
                </main>
            </div>
        </div>
    )
}
