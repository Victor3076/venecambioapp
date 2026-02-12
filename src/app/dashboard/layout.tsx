"use client"

import { ReactNode, useState, useEffect } from "react"
import Link from "next/link"
import { Home, User, History, LogOut, Shield, BarChart3, List, Globe, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function DashboardLayout({ children }: { children: ReactNode }) {
    const router = useRouter()
    const [profile, setProfile] = useState<{ full_name: string, role: string } | null>(null)
    const [loading, setLoading] = useState(true)

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

    const isAdmin = profile?.role === 'admin'
    const userInitial = profile?.full_name?.charAt(0).toUpperCase() || 'U'

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/30">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen bg-muted/30 text-foreground transition-colors">
            {/* Sidebar */}
            <aside className="w-72 border-r bg-background hidden md:flex flex-col shadow-sm">
                <div className="h-16 flex items-center px-6 border-b font-bold text-xl text-primary tracking-tight">
                    Venecambio
                </div>
                <div className="flex-1 overflow-y-auto">
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

                        {isAdmin && (
                            <>
                                <div className="pt-4 pb-2">
                                    <p className="px-3 py-2 text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">Administración</p>
                                </div>
                                <Link href="/admin" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-primary/10 font-medium text-foreground transition-all group">
                                    <List className="w-4 h-4 text-primary" /> Operaciones
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
                            </>
                        )}
                    </nav>
                </div>
                <div className="p-4 border-t bg-muted/10">
                    <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/5" asChild>
                        <Link href="/login">
                            <LogOut className="w-4 h-4" /> Cerrar Sesión
                        </Link>
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                <header className="h-16 border-b bg-background flex items-center justify-between px-6 shadow-sm sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-lg">{isAdmin ? 'Panel Administrativo' : 'Panel de Usuario'}</h2>
                        {isAdmin && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">Admin</span>}
                    </div>
                    <div className="flex items-center gap-4">
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
