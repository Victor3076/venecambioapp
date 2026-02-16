"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { supabase } from "@/lib/supabase"
import { NotificationsService } from "@/services/notifications"
import { Search, Send, Bell, User, Users, Clock, CheckCircle2, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function AdminNotificationsPage() {
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedUser, setSelectedUser] = useState<any>(null)
    const [isBroadcast, setIsBroadcast] = useState(false)

    const [title, setTitle] = useState('')
    const [message, setMessage] = useState('')
    const [sentHistory, setSentHistory] = useState<any[]>([])

    const loadData = async () => {
        setLoading(true)
        // Load users for selection
        const { data: userData, error: userError } = await supabase
            .from('profiles')
            .select('id, full_name, client_code, phone')
            .order('full_name', { ascending: true })

        if (userError) console.error(userError)
        else setUsers(userData || [])

        // Load recent admin notifications
        const { data: historyData, error: historyError } = await supabase
            .from('notifications')
            .select('*, profiles(full_name)')
            .eq('type', 'admin_broadcast')
            .order('created_at', { ascending: false })
            .limit(10)

        if (historyError) console.error(historyError)
        else setSentHistory(historyData || [])

        setLoading(false)
    }

    useEffect(() => {
        loadData()
    }, [])

    const filteredUsers = users.filter(u => {
        const s = searchTerm.toLowerCase()
        return (u.full_name?.toLowerCase() || '').includes(s) ||
            (u.client_code?.toLowerCase() || '').includes(s) ||
            (u.phone?.toLowerCase() || '').includes(s)
    })

    const handleSend = async () => {
        if (!title || !message) return alert("Por favor completa título y mensaje")
        if (!isBroadcast && !selectedUser) return alert("Selecciona un usuario o marca 'Enviar a todos'")

        setSending(true)
        try {
            if (isBroadcast) {
                // For broadcast, we create one record per user in this implementation 
                // In a huge app, we'd use a different approach, but for Venecambio this works.
                const { data: allUsers } = await supabase.from('profiles').select('id')
                if (allUsers) {
                    await Promise.all(allUsers.map(u =>
                        NotificationsService.create({
                            user_id: u.id,
                            title,
                            message,
                            type: 'info',
                            data: { source: 'admin_broadcast' }
                        })
                    ))
                    // Also create a "log" entry in notifications for the admin history view
                    // We'll use a dummy/null user or just mark its type
                }
                alert("Notificación enviada a todos los usuarios")
            } else {
                await NotificationsService.create({
                    user_id: selectedUser.id,
                    title,
                    message,
                    type: 'info',
                    data: { source: 'admin_direct' }
                })
                alert(`Notificación enviada a ${selectedUser.full_name}`)
            }

            setTitle('')
            setMessage('')
            setSelectedUser(null)
            setIsBroadcast(false)
            loadData()
        } catch (error: any) {
            alert("Error: " + error.message)
        } finally {
            setSending(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Notificaciones</h1>
                    <p className="text-muted-foreground">Envía mensajes personalizados o masivos a los clientes.</p>
                </div>
                <Bell className="w-10 h-10 text-primary/20" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Send Form */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Send className="w-5 h-5" /> Nuevo Mensaje
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center space-x-2 bg-muted/30 p-3 rounded-lg border border-dashed">
                                <Checkbox
                                    id="broadcast"
                                    checked={isBroadcast}
                                    onCheckedChange={(checked) => setIsBroadcast(!!checked)}
                                />
                                <label htmlFor="broadcast" className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2">
                                    <Users className="w-4 h-4" /> Enviar a todos los usuarios (Broadcast)
                                </label>
                            </div>

                            {!isBroadcast && (
                                <div className="space-y-2">
                                    <label className="text-sm font-bold">Destinatario</label>
                                    {selectedUser ? (
                                        <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
                                                    {selectedUser.full_name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm">{selectedUser.full_name}</p>
                                                    <p className="text-[10px] text-muted-foreground">{selectedUser.client_code || 'Sin código'}</p>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)}>Cambiar</Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="Buscar usuario por nombre, código o celular..."
                                                    className="pl-9"
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                />
                                            </div>
                                            <div className="max-h-40 overflow-y-auto border rounded-md divide-y bg-background">
                                                {filteredUsers.length === 0 ? (
                                                    <p className="p-4 text-center text-xs text-muted-foreground">No se encontraron usuarios</p>
                                                ) : (
                                                    filteredUsers.slice(0, 10).map(u => (
                                                        <div
                                                            key={u.id}
                                                            className="p-2 hover:bg-muted cursor-pointer flex items-center justify-between"
                                                            onClick={() => setSelectedUser(u)}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <User className="w-4 h-4 text-muted-foreground" />
                                                                <span className="text-sm">{u.full_name}</span>
                                                            </div>
                                                            <Badge variant="outline" className="text-[10px]">{u.client_code}</Badge>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-bold">Título de la Notificación</label>
                                <Input
                                    placeholder="Ej: Cambio en el horario, Nueva tasa disponible..."
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold">Mensaje</label>
                                <Textarea
                                    placeholder="Escribe el contenido del mensaje aquí..."
                                    rows={4}
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                />
                            </div>

                            <Button
                                className="w-full"
                                size="lg"
                                disabled={sending || (!isBroadcast && !selectedUser)}
                                onClick={handleSend}
                            >
                                {sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</> : 'Enviar Notificación'}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Info / History Summary */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Clock className="w-4 h-4" /> Recientes
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {sentHistory.length === 0 ? (
                                    <p className="text-xs text-muted-foreground text-center py-4">No hay mensajes recientes.</p>
                                ) : (
                                    sentHistory.map(h => (
                                        <div key={h.id} className="text-xs border-l-2 border-primary pl-3 py-1 space-y-1">
                                            <p className="font-bold">{h.title}</p>
                                            <p className="text-muted-foreground line-clamp-2">{h.message}</p>
                                            <p className="text-[10px] opacity-50 flex items-center gap-1">
                                                {new Date(h.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                        <h4 className="text-blue-800 font-bold text-sm flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" /> Tips de Notificaciones
                        </h4>
                        <ul className="text-xs text-blue-700 space-y-2 list-disc pl-4">
                            <li>Usa títulos cortos y llamativos.</li>
                            <li>Las notificaciones masivas llegan a todos los perfiles registrados.</li>
                            <li>Asegúrate de que la información sea relevante para evitar molestias.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}
