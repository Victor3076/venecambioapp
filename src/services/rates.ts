import { supabase } from '@/lib/supabase'

export interface RatesData {
    id?: string
    usdt_prices: {
        USD: number
        PEN: number
        CLP: number
        COP: number
        VES: number
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

        if (data?.usdt_prices) {
            const mapping: Record<string, string> = {
                'USA': 'USD',
                'PERU': 'PEN',
                'CHILE': 'CLP',
                'COLOMBIA': 'COP',
                'VENEZUELA': 'VES'
            }
            const normalizedPrices: any = { ...data.usdt_prices }
            Object.entries(mapping).forEach(([old, curr]) => {
                if (data.usdt_prices[old as keyof typeof data.usdt_prices] !== undefined) {
                    normalizedPrices[curr] = data.usdt_prices[old as keyof typeof data.usdt_prices]
                }
            })
            data.usdt_prices = normalizedPrices
        }

        if (data?.margins) {
            const normalizedMargins: Record<string, number> = {}
            const mapping: Record<string, string> = {
                'PERU': 'PEN',
                'CHILE': 'CLP',
                'COLOMBIA': 'COP',
                'USA': 'USD',
                'VENEZUELA': 'VES'
            }

            Object.entries(data.margins).forEach(([key, value]) => {
                let newKey = key
                Object.entries(mapping).forEach(([old, curr]) => {
                    newKey = newKey.replace(old, curr)
                })
                if (!normalizedMargins[newKey]) {
                    normalizedMargins[newKey] = value as number
                }
            })
            data.margins = normalizedMargins
        }

        return data as RatesData
    },

    // Update rates (creates a new row for history tracking, or updates current depending on preference)
    // For simplicity and history, we can check if we want to just update the single row or insert new.
    // The schema allows multiple rows. Let's just update the existing one or insert if empty to keep it simple for now, 
    // but a single-row pattern is easier for this app.
    async update(usdtPrices: RatesData['usdt_prices'], margins: RatesData['margins']) {
        console.log('--- RatesService: Iniciando actualización ---');
        console.log('Precios a guardar:', usdtPrices);
        console.log('Márgenes a guardar:', margins);

        // First, check if a row exists
        const existing = await this.getLatest()

        const payload = {
            usdt_prices: usdtPrices,
            margins: margins,
            updated_at: new Date().toISOString()
        }

        if (existing?.id) {
            console.log('Actualizando registro existente con ID:', existing.id);
            const { data, error } = await supabase
                .from('rates_configuration')
                .update(payload)
                .eq('id', existing.id)
                .select()

            if (error) {
                console.error('Error de Supabase al actualizar:', error);
                throw error
            }
            console.log('Actualización exitosa. Datos devueltos:', data);
            return { data, error }
        } else {
            console.log('No hay registro previo. Insertando nuevo...');
            const { data, error } = await supabase
                .from('rates_configuration')
                .insert([payload])
                .select()

            if (error) {
                console.error('Error de Supabase al insertar:', error);
                throw error
            }
            console.log('Inserción exitosa. Datos devueltos:', data);
            return { data, error }
        }
    }
}
