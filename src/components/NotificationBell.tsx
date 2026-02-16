"use client"

import { useState, useEffect } from "react"
import { NotificationsService, Notification } from "@/services/notifications"
import { Bell, BellDot, Check, Clock, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuHeader,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

export function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)

    const loadNotifications = async () => {
        try {
            const [list, count] = await Promise.all([
                NotificationsService.getMyNotifications(),
                NotificationsService.getUnreadCount()
            ])
            setNotifications(list)
            setUnreadCount(count)
        } catch (error) {
            console.error("Error loading notifications:", error)
        }
    }

    useEffect(() => {
        loadNotifications()
        // Simple polling for now
        const interval = setInterval(loadNotifications, 30000)
        return () => clearInterval(interval)
    }, [])

    const handleMarkAsRead = async (id: string) => {
        await NotificationsService.markAsRead(id)
        loadNotifications()
    }

    const handleMarkAllRead = async () => {
        await NotificationsService.markAllAsRead()
        loadNotifications()
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    {unreadCount > 0 ? (
                        <>
                            <BellDot className="h-5 w-5 text-primary animate-pulse" />
                            <Badge className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 bg-primary text-[10px]">
                                {unreadCount}
                            </Badge>
                        </>
                    ) : (
                        <Bell className="h-5 w-5 text-muted-foreground" />
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0 shadow-2xl border-2">
                <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                    <h3 className="font-bold text-sm">Notificaciones</h3>
                    {unreadCount > 0 && (
                        <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2 text-primary" onClick={handleMarkAllRead}>
                            Marcar todo como leído
                        </Button>
                    )}
                </div>
                <div className="max-h-[350px] overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                            No tienes notificaciones aún.
                        </div>
                    ) : (
                        notifications.map(n => (
                            <div
                                key={n.id}
                                className={`p-4 border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer ${!n.is_read ? 'bg-primary/5' : ''}`}
                                onClick={() => !n.is_read && handleMarkAsRead(n.id)}
                            >
                                <div className="flex gap-3">
                                    <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${!n.is_read ? 'bg-primary' : 'bg-transparent'}`} />
                                    <div className="space-y-1">
                                        <p className={`text-sm leading-tight ${!n.is_read ? 'font-bold' : 'font-medium'}`}>{n.title}</p>
                                        <p className="text-xs text-muted-foreground leading-normal">{n.message}</p>
                                        <p className="text-[10px] text-muted-foreground pt-1 flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> {new Date(n.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                <div className="p-2 border-t text-center">
                    <p className="text-[10px] text-muted-foreground">Venecambio Notificaciones</p>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
