"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { createUser, updateUser, deleteUser, resetPassword } from "./actions"
import { User, Mail, UserPlus, Shield, Loader2, ArrowLeft, Search, Pencil, Trash2, X, Landmark, Plus, KeyRound, MessageSquare } from "lucide-react"
import { AddAccountDialog } from "@/components/admin/add-account-dialog"

export default function AdminUsersPage() {
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreating, setIsCreating] = useState(false)
    const [newUser, setNewUser] = useState({ phone: '', fullName: '', clientCode: '', role: 'user' as 'user' | 'admin' | 'operator' })
    const [editingUser, setEditingUser] = useState<any>(null)
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')

    // Account Modal State
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false)
    const [selectedUserForAccount, setSelectedUserForAccount] = useState<any>(null)

    const loadUsers = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) console.error(error)
        else setUsers(data || [])

        // Get current user role
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
            setCurrentUserRole(profile?.role || 'user')
        }

        setLoading(false)
    }

    useEffect(() => {
        loadUsers()
    }, [])

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsCreating(true)
        try {
            let result;
            if (editingUser) {
                result = await updateUser(editingUser.id, newUser)
            } else {
                result = await createUser(newUser)
            }

            if (result.success) {
                if (editingUser) {
                    toast.success("Usuario actualizado con éxito")
                } else {
                    toast.success("Usuario creado con éxito. Clave inicial: 123456")
                }
                setNewUser({ phone: '', fullName: '', clientCode: '', role: 'user' })
                setEditingUser(null)
                loadUsers()
            } else {
                toast.error("Error: " + result.error)
            }
        } catch (error: any) {
            toast.error("Error inesperado: " + error.message)
        } finally {
            setIsCreating(false)
        }
    }

    const handleResetPassword = async (id: string, name: string) => {
        if (!confirm(`¿Estás seguro de que deseas reiniciar la contraseña de ${name} a '123456'?`)) return

        try {
            const result = await resetPassword(id)
            if (result.success) {
                loadUsers()
                toast.success("Contraseña reiniciada a 123456")
            } else {
                toast.error("Error al reiniciar: " + result.error)
            }
        } catch (error: any) {
            toast.error("Error inesperado: " + error.message)
        }
    }

    const copyWelcomeMessage = (u: any) => {
        const rawPhone = u.phone || (u.email?.includes('@') ? u.email.split('@')[0] : '')
        const phone = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`
        const message = `Hola, todas nuestras operaciones se realizarán a través de nuestra plataforma oficial: VeneCambio.com 🌐

Aquí tienes tus credenciales personales:

👤 Usuario: ${phone}
🔑 Clave: 123456

Pasos para tu primer ingreso:
 1️⃣ Entra en 🔗 venecambio.com y presiona el botón Ingresar.
 2️⃣ Introduce tu usuario y clave mencionada arriba. 
 3️⃣ 💡 Por seguridad, el sistema te pedirá cambiar tu clave por una nueva al entrar. 
 4️⃣ 🔔 Es muy importante que ACEPTES las notificaciones cuando el navegador te lo pida; así recibirás el aviso de tus pagos al instante. 📲

¡Estamos listos para seguir dándote la mejor atención! 🤝🔥`

        navigator.clipboard.writeText(message)
        toast.success("Mensaje de bienvenida copiado")
    }

    const handleDeleteUser = async (id: string) => {
        if (!confirm("¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede deshacer.")) return

        try {
            const result = await deleteUser(id)
            if (result.success) {
                loadUsers()
                toast.success("Usuario eliminado")
            } else {
                toast.error("Error al eliminar: " + result.error)
            }
        } catch (error: any) {
            toast.error("Error inesperado: " + error.message)
        }
    }

    const startEditing = (u: any) => {
        setEditingUser(u)

        // Try to extract phone from profile, then from technical email if phone is missing
        let displayPhone = u.phone || ''
        if (!displayPhone && u.email?.includes('@venecambio.app')) {
            displayPhone = '+' + u.email.split('@')[0]
        }

        setNewUser({
            phone: displayPhone,
            fullName: u.full_name || '',
            clientCode: u.client_code || '',
            role: u.role || 'user'
        })
    }

    const cancelEditing = () => {
        setEditingUser(null)
        setNewUser({ phone: '', fullName: '', clientCode: '', role: 'user' })
    }

    const openAddAccount = (u: any) => {
        setSelectedUserForAccount(u)
        setIsAccountModalOpen(true)
    }

    const filteredUsers = users.filter(u => {
        const search = searchTerm.toLowerCase()
        return (
            (u.full_name?.toLowerCase() || '').includes(search) ||
            (u.phone?.toLowerCase() || '').includes(search) ||
            (u.email?.toLowerCase() || '').includes(search) ||
            (u.client_code?.toLowerCase() || '').includes(search)
        )
    })

    return (
        <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <Link href="/admin">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>
                        <p className="text-muted-foreground">Crea y administra los accesos de tus clientes.</p>
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {/* Formulario de Creación */}
                <Card className="md:col-span-1 border-2 border-primary/10 h-fit sticky top-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            {editingUser ? <Pencil className="w-5 h-5 text-primary" /> : <UserPlus className="w-5 h-5 text-primary" />}
                            {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                        </CardTitle>
                        <CardDescription>
                            {editingUser ? `Editando perfil de ${editingUser.full_name}` : 'La clave por defecto será: 123456'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSaveUser} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Nombre Completo</label>
                                <Input
                                    required
                                    placeholder="Nombre del cliente"
                                    value={newUser.fullName}
                                    onChange={e => setNewUser({ ...newUser, fullName: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Teléfono (ej: +51...)</label>
                                <Input
                                    required
                                    placeholder="+51999888777"
                                    value={newUser.phone}
                                    onChange={e => {
                                        const val = e.target.value
                                        // Dejar solo números y el + inicial
                                        const cleanVal = val.startsWith('+')
                                            ? '+' + val.slice(1).replace(/\D/g, '')
                                            : val.replace(/\D/g, '')
                                        setNewUser({ ...newUser, phone: cleanVal })
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Código de Cliente (ej: VC 4440)</label>
                                <Input
                                    placeholder="VC 4440"
                                    value={newUser.clientCode}
                                    onChange={e => setNewUser({ ...newUser, clientCode: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Rol</label>
                                <select
                                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={newUser.role}
                                    onChange={e => setNewUser({ ...newUser, role: e.target.value as 'user' | 'admin' | 'operator' })}
                                    disabled={currentUserRole === 'operator'}
                                >
                                    <option value="user">Usuario (Cliente)</option>
                                    {currentUserRole === 'admin' && (
                                        <>
                                            <option value="operator">Operador (Solo Clientes)</option>
                                            <option value="admin">Administrador (Manejador)</option>
                                        </>
                                    )}
                                </select>
                                {currentUserRole === 'operator' && (
                                    <p className="text-[10px] text-muted-foreground">Los operadores solo pueden crear cuentas de tipo Cliente.</p>
                                )}
                            </div>
                            <div className="flex gap-2 pt-2">
                                {editingUser && (
                                    <Button type="button" variant="outline" className="flex-1" onClick={cancelEditing}>
                                        Cancelar
                                    </Button>
                                )}
                                <Button className="flex-[2]" type="submit" disabled={isCreating}>
                                    {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                    {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* Lista de Usuarios */}
                <Card className="md:col-span-2 border-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                        <div>
                            <CardTitle>Usuarios Registrados</CardTitle>
                            <CardDescription>Total de usuarios: {filteredUsers.length}</CardDescription>
                        </div>
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nombre, código o celular..."
                                className="pl-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
                        ) : (
                            <div className="space-y-4">
                                {filteredUsers.length === 0 ? (
                                    <div className="text-center py-10 border-2 border-dashed rounded-xl text-muted-foreground">
                                        No se encontraron usuarios para "{searchTerm}"
                                    </div>
                                ) : (
                                    filteredUsers.map(u => (
                                        <div key={u.id} className={`flex items-center justify-between p-4 border rounded-lg transition-all ${editingUser?.id === u.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/30'}`}>
                                            <div className="flex items-center gap-4">
                                                <div className={`p-2 rounded-full ${u.role === 'admin' ? 'bg-orange-100 text-orange-600' : 'bg-primary/10 text-primary'}`}>
                                                    <User className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="font-bold flex items-center gap-2">
                                                        {u.client_code && <span className="text-primary font-mono bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10 text-xs">{u.client_code}</span>}
                                                        {u.full_name}
                                                        {u.role === 'admin' && <Shield className="w-3 h-3 text-orange-500" />}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <span className="font-semibold">Tel/Email:</span> {u.phone || u.email}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right mr-2 hidden sm:block">
                                                    <div className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${u.must_change_password ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                                                        {u.must_change_password ? 'Pendiente Clave' : 'Activo'}
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground mt-1">
                                                        {new Date(u.created_at).toLocaleDateString()}
                                                    </div>
                                                </div>
                                                <div className="flex gap-1">
                                                    {u.role !== 'admin' && (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                            onClick={() => openAddAccount(u)}
                                                            title="Agregar Cuenta Bancaria"
                                                        >
                                                            <Landmark className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 text-muted-foreground hover:text-green-600"
                                                        onClick={() => copyWelcomeMessage(u)}
                                                        title="Copiar Mensaje de Bienvenida"
                                                    >
                                                        <MessageSquare className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 text-muted-foreground hover:text-orange-500"
                                                        onClick={() => handleResetPassword(u.id, u.full_name)}
                                                        title="Reiniciar Contraseña"
                                                    >
                                                        <KeyRound className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                        onClick={() => startEditing(u)}
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                        onClick={() => handleDeleteUser(u.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Modal de Agregar Cuenta */}
            {selectedUserForAccount && (
                <AddAccountDialog
                    userId={selectedUserForAccount.id}
                    userName={selectedUserForAccount.full_name}
                    isOpen={isAccountModalOpen}
                    onClose={() => {
                        setIsAccountModalOpen(false)
                        setSelectedUserForAccount(null)
                    }}
                    onSuccess={() => {
                        // Opcional: mostrar feedback adicional
                    }}
                />
            )}
        </div>
    )
}
