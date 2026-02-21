"use client"

import { ReactNode, useState, useEffect } from "react"
import Link from "next/link"
import { Home, User, History, LogOut, Shield, BarChart3, List, Globe, UserPlus, Bell, Menu, X, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

import { NotificationBell } from "@/components/NotificationBell"
import { Logo } from "@/components/logo"
import { FcmHandler } from "@/components/FcmHandler"

export default function DashboardLayout({ children }: { children: ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const [profile, setProfile] = useState<{ full_name: string, role: string } | null>(null)
    const [loading, setLoading] = useState(true)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    // Cerrar menú móvil cuando cambia la ruta
    useEffect(() => {
        setIsMobileMenuOpen(false)
    }, [pathname])

    useEffect(() => {
        const loadProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push("/login")
                return
            }

            const { data } = await supabase
                .from('profiles')
                .select('full_name, role')
                .eq('id', user.id)
                .single()

            setProfile(data)
            setLoading(false)
        }
        loadProfile()
    }, [router])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push("/login")
    }

    const isAdmin = profile?.role === 'admin'
    const isStaff = profile?.role === 'admin' || profile?.role === 'operator'
    const userInitial = profile?.full_name?.charAt(0).toUpperCase() || 'U'

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/30">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen bg-muted/30 text-foreground transition-colors overflow-x-hidden">
            <FcmHandler />

            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-40 md:hidden animate-in fade-in duration-300"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Mobile Sidebar Drawer */}
            <aside className={cn(
                "fixed inset-y-0 left-0 w-[280px] bg-background z-50 md:hidden transition-transform duration-300 ease-in-out shadow-2xl flex flex-col",
                isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="h-16 flex items-center justify-between px-6 border-b">
                    <Logo />
                    <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)} className="h-8 w-8">
                        <X className="h-5 w-5" />
                    </Button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <NavigationContent isStaff={isStaff} />
                </div>
                <div className="p-4 border-t bg-muted/5">
                    <LogoutButton onLogout={handleLogout} />
                </div>
            </aside>

            {/* Sidebar (Desktop) */}
            <aside className="w-72 border-r bg-background hidden md:flex flex-col shadow-sm sticky top-0 h-screen">
                <div className="h-16 flex items-center px-6 border-b">
                    <Logo />
                </div>
                <div className="flex-1 overflow-y-auto">
                    <NavigationContent isStaff={isStaff} />
                </div>
                <div className="p-4 border-t bg-muted/10">
                    <LogoutButton onLogout={handleLogout} />
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                <header className="h-16 border-b bg-background flex items-center justify-between px-4 sm:px-6 shadow-sm sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="md:hidden -ml-2 h-9 w-9"
                            onClick={() => setIsMobileMenuOpen(true)}
                        >
                            <Menu className="h-5 w-5" />
                        </Button>
                        <h2 className="font-bold text-base sm:text-lg tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                            {isStaff ? 'Panel Administrativo' : 'Panel de Usuario'}
                        </h2>
                        {isStaff && <span className="hidden xs:inline-block text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter ml-1">
                            {profile?.role === 'admin' ? 'Admin' : 'Operador'}
                        </span>}
                    </div>
                    <div className="flex items-center gap-4">
                        <NotificationBell />
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold leading-none">{profile?.full_name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase mt-0.5">{profile?.role}</p>
                        </div>
                        <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-md shadow-primary/20">
                            {userInitial}
                        </div>
                    </div>
                </header>
                <main className="p-6 md:p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {children}
                </main>
            </div>
        </div>
    )
}

function NavigationContent({ isStaff }: { isStaff: boolean }) {
    return (
        <nav className="p-4 space-y-1">
            <p className="px-3 py-2 text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">Menú Principal</p>
            <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted font-medium transition-all group">
                <Home className="w-4 h-4 text-muted-foreground group-hover:text-primary" /> Inicio
            </Link>
            <Link id="tour-sidebar-accounts" href="/dashboard/accounts" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted font-medium text-muted-foreground hover:text-foreground transition-all group">
                <User className="w-4 h-4 group-hover:text-primary" /> Mis Cuentas
            </Link>
            <Link href="/dashboard/transactions" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted font-medium text-muted-foreground hover:text-foreground transition-all group">
                <History className="w-4 h-4 group-hover:text-primary" /> Historial
            </Link>

            {isStaff && (
                <>
                    <div className="pt-4 pb-2">
                        <p className="px-3 py-2 text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">Administración</p>
                    </div>
                    <Link href="/admin" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-primary/10 font-medium text-foreground transition-all group">
                        <List className="w-4 h-4 text-primary" /> Operaciones
                    </Link>
                    <Link href="/admin/deposits" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-primary/10 font-medium text-foreground transition-all group">
                        <Wallet className="w-4 h-4 text-primary" /> Depósitos
                    </Link>
                    <Link href="/admin/rates" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-primary/10 font-medium text-foreground transition-all group">
                        <BarChart3 className="w-4 h-4 text-primary" /> Gestión de Tasas
                    </Link>
                    <Link href="/admin/users" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-primary/10 font-medium text-foreground transition-all group">
                        <UserPlus className="w-4 h-4 text-primary" /> Usuarios
                    </Link>
                    <Link href="/admin/payment-methods" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-primary/10 font-medium text-foreground transition-all group">
                        <Globe className="w-4 h-4 text-primary" /> Cuentas Empresa
                    </Link>
                    <Link href="/admin/notifications" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-primary/10 font-medium text-foreground transition-all group">
                        <Bell className="w-4 h-4 text-primary" /> Notificaciones
                    </Link>
                </>
            )}
        </nav>
    )
}

function LogoutButton({ onLogout }: { onLogout: () => void }) {
    return (
        <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/5 font-medium"
            onClick={onLogout}
        >
            <LogOut className="w-4 h-4" /> Cerrar Sesión
        </Button>
    )
}
