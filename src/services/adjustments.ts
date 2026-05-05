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
        let allData: CashflowAdjustment[] = []
        let from = 0
        const step = 1000

        while (true) {
            const { data, error } = await supabase
                .from('cashflow_adjustments')
                .select('*')
                .order('created_at', { ascending: false })
                .range(from, from + step - 1)

            if (error) throw error
            if (!data || data.length === 0) break

            allData = [...allData, ...(data as CashflowAdjustment[])]
            if (data.length < step) break
            from += step
            if (from >= 5000) break
        }

        return allData
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
