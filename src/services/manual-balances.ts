import { supabase } from '@/lib/supabase'

export interface BalanceRowData {
    yesterday: string
    today_pass: string
    today_clps: string
    total: number
}

export interface ManualBalanceData {
    id?: string
    created_at?: string
    egli: BalanceRowData
    vicmar: BalanceRowData
    corriente: BalanceRowData
    cyber: BalanceRowData
    adjustment: string
}

export const ManualBalancesService = {
    async getLatest(): Promise<ManualBalanceData | null> {
        const { data, error } = await supabase
            .from('manual_balances')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (error) {
            if (error.code === 'PGRST116') return null // No rows found
            console.error('Error fetching manual balance:', error)
            return null
        }

        return data as ManualBalanceData
    },

    async save(payload: ManualBalanceData) {
        // We always insert a new one to keep history, or update if we want a single row.
        // The user said "separate data", usually daily closures are new rows.
        // Let's check if there's one for TODAY to update it, or just insert.
        // For simplicity and audit, let's just insert new ones for now unless specified.

        // Actually, to keep the UI "loading the last one", updating the last one or 
        // inserting based on date would be better. Let's just insert for now.
        const { data, error } = await supabase
            .from('manual_balances')
            .insert([{
                egli: payload.egli,
                vicmar: payload.vicmar,
                corriente: payload.corriente,
                cyber: payload.cyber,
                adjustment: payload.adjustment
            }])
            .select()

        if (error) {
            console.error('Error saving manual balance:', error)
            throw error
        }

        return data[0]
    }
}
