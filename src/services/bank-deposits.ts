import { supabase } from "@/lib/supabase"

export interface BankDeposit {
    id?: string
    amount: number
    currency: string
    reference_number: string
    bank_name?: string
    status: 'available' | 'matched'
    matched_transaction_id?: string
    created_at?: string
}

export const BankDepositsService = {
    async create(deposit: Omit<BankDeposit, 'id' | 'status' | 'created_at'>) {
        const { data, error } = await supabase
            .from('bank_deposits')
            .insert([{
                ...deposit,
                status: 'available'
            }])
            .select()
            .single()

        if (error) throw error
        return data
    },

    async getAvailable(currency?: string) {
        let query = supabase
            .from('bank_deposits')
            .select('*')
            .eq('status', 'available')
            .order('created_at', { ascending: false })

        if (currency) {
            query = query.eq('currency', currency)
        }

        const { data, error } = await query
        if (error) throw error
        return data as BankDeposit[]
    },

    async getAll() {
        const { data, error } = await supabase
            .from('bank_deposits')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) throw error
        return data as BankDeposit[]
    },

    async match(depositId: string, transactionId: string) {
        // Start a "transaction" via RPC if possible, but for now we do it in two steps.
        // Step 1: Update deposit
        const { error: depositError } = await supabase
            .from('bank_deposits')
            .update({
                status: 'matched',
                matched_transaction_id: transactionId
            })
            .eq('id', depositId)
            .eq('status', 'available') // Ensure it wasn't matched just now

        if (depositError) throw depositError

        // Step 2: Update transaction status
        const { error: txError } = await supabase
            .from('transactions')
            .update({ status: 'verified' })
            .eq('id', transactionId)

        if (txError) {
            // Rollback deposit logic would be complex without backend functions, 
            // but we alert the admin.
            console.error("Failed to update transaction status after matching deposit")
            throw txError
        }
    },

    // Helper to find potential matches for a transaction
    async findPotentialMatches(amount: number, currency: string) {
        // Find deposits with exact amount and currency
        const { data, error } = await supabase
            .from('bank_deposits')
            .select('*')
            .eq('status', 'available')
            .eq('currency', currency)
            .eq('amount', amount)

        if (error) throw error
        return data as BankDeposit[]
    }
}
