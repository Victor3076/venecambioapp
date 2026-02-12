import { supabase } from '@/lib/supabase'

export interface RatesData {
    id?: string
    usdt_prices: {
        USA: number
        PERU: number
        CHILE: number
        COLOMBIA: number
        VENEZUELA: number
        MONITOR: number
        BCV: number
    }
    margins: Record<string, number> // e.g. { "PEN_VES": 5.0 }
}

export const RatesService = {
    // Get the latest rates configuration
    async getLatest() {
        const { data, error } = await supabase
            .from('rates_configuration')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1)
            .single()

        if (error) {
            console.error('Error fetching rates:', error)
            return null
        }

        return data as RatesData
    },

    // Update rates (creates a new row for history tracking, or updates current depending on preference)
    // For simplicity and history, we can check if we want to just update the single row or insert new.
    // The schema allows multiple rows. Let's just update the existing one or insert if empty to keep it simple for now, 
    // but a single-row pattern is easier for this app.
    async update(usdtPrices: RatesData['usdt_prices'], margins: RatesData['margins']) {

        // First, check if a row exists
        const existing = await this.getLatest()

        if (existing?.id) {
            const { data, error } = await supabase
                .from('rates_configuration')
                .update({
                    usdt_prices: usdtPrices,
                    margins: margins,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id)
                .select()

            if (error) throw error
            return { data, error }
        } else {
            // Fallback insert if table is empty
            const { data, error } = await supabase
                .from('rates_configuration')
                .insert([{
                    usdt_prices: usdtPrices,
                    margins: margins
                }])
                .select()

            if (error) throw error
            return { data, error }
        }
    }
}
