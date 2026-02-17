import { supabase } from "@/lib/supabase"

export interface Notification {
    id: string
    user_id: string
    title: string
    message: string
    type: 'status_update' | 'promotion' | 'alert' | 'info'
    is_read: boolean
    data?: any
    created_at: string
}

export const NotificationsService = {
    async getMyNotifications() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return []

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20)

        if (error) throw error
        return data as Notification[]
    },

    async getUnreadCount() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return 0

        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_read', false)

        if (error) throw error
        return count || 0
    },

    async markAsRead(id: string) {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id)

        if (error) throw error
    },

    async markAllAsRead() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false)

        if (error) throw error
    },

    async create(notification: Omit<Notification, 'id' | 'created_at' | 'is_read'>) {
        const { data, error } = await supabase
            .from('notifications')
            .insert([{
                ...notification,
                is_read: false
            }])
            .select()
            .single()

        if (error) throw error
        return data as Notification
    },

    async broadcast(title: string, message: string, type: string = 'info') {
        const { error } = await supabase.rpc('broadcast_notification', {
            p_title: title,
            p_message: message,
            p_type: type
        })

        if (error) throw error
    }
}
