import { supabase } from "@/lib/supabase"

export interface AdminSettings {
    id: string
    is_open: boolean
    closed_message: string
    updated_at: string
}

export const AdminSettingsService = {
    async getSettings() {
        const { data, error } = await supabase
            .from('admin_settings')
            .select('*')
            .limit(1)
            .maybeSingle()

        if (error) {
            console.error('Error fetching admin settings:', error)
            return null
        }

        // If no row exists, we return a default object but don't save it yet
        // This allows the UI to work immediately
        if (!data) {
            return {
                id: 'default',
                is_open: true,
                closed_message: 'Nuestro horario de atención es de 10:00 AM a 8:00 PM (Hora Venezuela). Regresa pronto para realizar tus operaciones.',
                updated_at: new Date().toISOString()
            } as AdminSettings
        }

        return data as AdminSettings
    },

    async updateSettings(settings: Partial<Omit<AdminSettings, 'id' | 'updated_at'>>) {
        // Try to get current settings
        const { data: current } = await supabase
            .from('admin_settings')
            .select('*')
            .limit(1)
            .maybeSingle()

        if (!current) {
            // If row doesn't exist, create it (INSERT)
            const { data, error } = await supabase
                .from('admin_settings')
                .insert([{
                    ...settings,
                    updated_at: new Date().toISOString()
                }])
                .select()
                .single()

            if (error) throw error
            return data as AdminSettings
        } else {
            // Row exists, update it
            const { data, error } = await supabase
                .from('admin_settings')
                .update({
                    ...settings,
                    updated_at: new Date().toISOString()
                })
                .eq('id', current.id)
                .select()
                .single()

            if (error) throw error
            return data as AdminSettings
        }
    }
}
