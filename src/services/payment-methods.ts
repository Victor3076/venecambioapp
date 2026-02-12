import { supabase } from "@/lib/supabase"

export interface PaymentMethod {
    id: string
    country: string
    method_type: string
    bank_name: string
    account_number: string
    holder_name: string
    holder_id?: string
    details?: any
    is_active: boolean
    created_at: string
}

export const PaymentMethodsService = {
    async getAll() {
        const { data, error } = await supabase
            .from('payment_methods')
            .select('*')
            .order('country', { ascending: true })
        if (error) throw error
        return data as PaymentMethod[]
    },

    async getByCountry(country: string) {
        const { data, error } = await supabase
            .from('payment_methods')
            .select('*')
            .eq('country', country)
            .eq('is_active', true)
        if (error) throw error
        return data as PaymentMethod[]
    },

    async create(method: Omit<PaymentMethod, 'id' | 'created_at'>) {
        const { data, error } = await supabase
            .from('payment_methods')
            .insert(method)
            .select()
            .single()
        if (error) throw error
        return data as PaymentMethod
    },

    async update(id: string, method: Partial<PaymentMethod>) {
        const { data, error } = await supabase
            .from('payment_methods')
            .update(method)
            .eq('id', id)
            .select()
            .single()
        if (error) throw error
        return data as PaymentMethod
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('payment_methods')
            .delete()
            .eq('id', id)
        if (error) throw error
    }
}
