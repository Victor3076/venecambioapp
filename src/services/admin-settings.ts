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
            .single()

        if (error) {
            console.error('Error fetching admin settings:', error)
            return null
        }

        return data as AdminSettings
    },

    async updateSettings(settings: Partial<Omit<AdminSettings, 'id' | 'updated_at'>>) {
        const current = await this.getSettings()
        if (!current) throw new Error("Admin settings not initialized")

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
