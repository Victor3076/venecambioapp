import { supabase } from "@/lib/supabase"

export interface CashflowAdjustment {
    id?: string
    amount: number
    currency: string
    type: 'withdrawal' | 'initialization'
    description?: string
    created_at?: string
    created_by?: string
}

export const AdjustmentsService = {
    async create(adjustment: Omit<CashflowAdjustment, 'id' | 'created_at' | 'created_by'>) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("No user authenticated")

        const { data, error } = await supabase
            .from('cashflow_adjustments')
            .insert([{
                ...adjustment,
                created_by: user.id
            }])
            .select()
            .single()

        if (error) throw error
        return data as CashflowAdjustment
    },

    async getAll() {
        const { data, error } = await supabase
            .from('cashflow_adjustments')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) throw error
        return data as CashflowAdjustment[]
    },

    async getByDate() {
        // Fetching all to handle timezone-aware filtering in the UI
        const { data, error } = await supabase
            .from('cashflow_adjustments')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) throw error
        return data as CashflowAdjustment[]
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('cashflow_adjustments')
            .delete()
            .eq('id', id)

        if (error) throw error
    },

    async update(id: string, updates: Partial<Omit<CashflowAdjustment, 'id' | 'created_at' | 'created_by'>>) {
        const { data, error } = await supabase
            .from('cashflow_adjustments')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data as CashflowAdjustment
    }
}
