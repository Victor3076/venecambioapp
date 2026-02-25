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
    // Helper to normalize data from the DB to the frontend ISO format
    // Helper to normalize data from the DB to the frontend ISO format
    normalizeRatesData(data: any): RatesData | null {
        if (!data) return null

        // Start with a clean structure containing only the expected keys
        const normalized: RatesData = {
            usdt_prices: {
                USD: 1,
                PEN: 0,
                CLP: 0,
                COP: 0,
                VES: 0,
                MONITOR: 0,
                BCV: 0
            },
            margins: {}
        }

        // Standard Mapping
        const CURRENCY_MAPPING: Record<string, string> = {
            'USA': 'USD',
            'PERU': 'PEN',
            'CHILE': 'CLP',
            'COLOMBIA': 'COP',
            'VENEZUELA': 'VES'
        }

        // 1. Process USDT Prices
        if (data.usdt_prices) {
            // First pass: Apply standard keys directly
            const standardKeys = ['USD', 'PEN', 'CLP', 'COP', 'VES', 'MONITOR', 'BCV'];
            standardKeys.forEach(key => {
                if (data.usdt_prices[key] !== undefined) {
                    normalized.usdt_prices[key as keyof typeof normalized.usdt_prices] = Number(data.usdt_prices[key]);
                }
            });

            // Second pass: Fill missing standard keys from legacy keys
            Object.entries(CURRENCY_MAPPING).forEach(([legacy, standard]) => {
                if (data.usdt_prices[legacy] !== undefined && (normalized.usdt_prices[standard as keyof typeof normalized.usdt_prices] === 0 || standard === 'USD')) {
                    // Only use legacy if standard is missing (0) or it's USD (which defaults to 1)
                    if (normalized.usdt_prices[standard as keyof typeof normalized.usdt_prices] === 0 || (standard === 'USD' && data.usdt_prices[standard] === undefined)) {
                        normalized.usdt_prices[standard as keyof typeof normalized.usdt_prices] = Number(data.usdt_prices[legacy]);
                    }
                }
            });
        }

        // 2. Process Margins
        if (data.margins) {
            Object.entries(data.margins).forEach(([key, value]) => {
                let newKey = key;
                // Normalize the key (e.g. "PERU_VES" -> "PEN_VES")
                Object.entries(CURRENCY_MAPPING).forEach(([legacy, standard]) => {
                    newKey = newKey.replace(legacy, standard);
                });

                // Only set if not already set by a modern key (modern keys should be processed first or have precedence)
                // Actually, let's just normalize all and if there's a conflict, we'll take the one that looks like a modern key
                normalized.margins[newKey] = Number(value);
            });
        }

        if (data.id) (normalized as any).id = data.id;

        return normalized
    },

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

        return this.normalizeRatesData(data)
    },

    // Subscribe to realtime updates
    subscribe(callback: (data: RatesData) => void) {
        const channel = supabase
            .channel('rates_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'rates_configuration'
                },
                (payload) => {
                    console.log('Realtime update received:', payload)
                    const normalized = this.normalizeRatesData(payload.new || payload.old)
                    if (normalized) {
                        callback(normalized)
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    },

    // Update rates
    async update(usdtPrices: RatesData['usdt_prices'], margins: RatesData['margins']) {
        console.log('--- RatesService: Iniciando actualización ---');

        // CLEANUP: Ensure we only send the keys we want to the DB JSONB
        // This prevents legacy keys from accumulating or overwriting
        const cleanPrices = {
            USD: usdtPrices.USD,
            PEN: usdtPrices.PEN,
            CLP: usdtPrices.CLP,
            COP: usdtPrices.COP,
            VES: usdtPrices.VES,
            MONITOR: usdtPrices.MONITOR,
            BCV: usdtPrices.BCV
        };

        const cleanMargins: Record<string, number> = {};
        Object.entries(margins).forEach(([key, val]) => {
            // Only keep standard pair keys or GENERIC
            if (key === 'GENERIC' || /^[A-Z]{3}_[A-Z]{3}$/.test(key)) {
                cleanMargins[key] = val;
            }
        });

        console.log('Precios limpios a guardar:', cleanPrices);

        // First, check if a row exists
        const existing = await this.getLatest()

        const payload = {
            usdt_prices: cleanPrices,
            margins: cleanMargins,
            updated_at: new Date().toISOString()
        }

        if (existing?.id) {
            console.log('Actualizando registro existente con ID:', (existing as any).id);
            const { data, error } = await supabase
                .from('rates_configuration')
                .update(payload)
                .eq('id', (existing as any).id)
                .select()

            if (error) {
                console.error('Error de Supabase al actualizar:', error);
                throw error
            }
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
            return { data, error }
        }
    }

}
