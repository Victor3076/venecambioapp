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
    async getById(id: string) {
        const { data, error } = await supabase
            .from('bank_deposits')
            .select('*')
            .eq('id', id)
            .single()
        if (error) throw error
        return data as BankDeposit
    },
    async create(deposit: Omit<BankDeposit, 'id' | 'status' | 'created_at'>) {
        // Check for duplicates (same reference, currency and day)
        const today = new Date().toISOString().split('T')[0]
        const { data: existing, error: checkError } = await supabase
            .from('bank_deposits')
            .select('id')
            .eq('reference_number', deposit.reference_number)
            .eq('currency', deposit.currency)
            .gte('created_at', `${today}T00:00:00`)
            .lte('created_at', `${today}T23:59:59`)
            .maybeSingle()

        if (checkError) console.error("Error checking for duplicate deposit:", checkError)
        if (existing) {
            throw new Error(`Ya existe un depósito con la referencia ${deposit.reference_number} para ${deposit.currency} el día de hoy.`)
        }

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
        // Step 1: Get transaction details and calculate expected amount
        const { data: tx, error: fetchError } = await supabase
            .from('transactions')
            .select('amount_sent, group_id, currency_sent')
            .eq('id', transactionId)
            .single()

        if (fetchError) throw fetchError

        let expectedAmount = tx.amount_sent
        if (tx.group_id) {
            const { data: groupTxs, error: groupError } = await supabase
                .from('transactions')
                .select('amount_sent')
                .eq('group_id', tx.group_id)
            if (groupError) throw groupError
            expectedAmount = groupTxs.reduce((sum, item) => sum + Number(item.amount_sent), 0)
        }

        // Step 2: Get deposit details and validate amount/currency
        const { data: deposit, error: depFetchError } = await supabase
            .from('bank_deposits')
            .select('amount, currency, status')
            .eq('id', depositId)
            .single()

        if (depFetchError) throw depFetchError
        if (deposit.status !== 'available') throw new Error("El depósito ya no está disponible.")

        if (Number(deposit.amount) !== expectedAmount) {
            throw new Error(`El monto del depósito (${deposit.amount} ${deposit.currency}) no coincide con el total de la operación (${expectedAmount} ${tx.currency_sent}).`)
        }

        // Step 3: Update deposit
        const { error: depositError } = await supabase
            .from('bank_deposits')
            .update({
                status: 'matched',
                matched_transaction_id: transactionId
            })
            .eq('id', depositId)

        if (depositError) throw depositError

        // Step 4: Update transaction(s) status
        const updateQuery = supabase
            .from('transactions')
            .update({ status: 'verified' })

        if (tx.group_id) {
            updateQuery.eq('group_id', tx.group_id)
        } else {
            updateQuery.eq('id', transactionId)
        }

        const { error: txError } = await updateQuery

        if (txError) {
            console.error("Failed to update transaction status after matching deposit")
            throw txError
        }
    },

    // Helper to find potential matches for a transaction
    async findPotentialMatches(transactionId: string) {
        // 1. Get transaction info
        const { data: tx, error: txError } = await supabase
            .from('transactions')
            .select('amount_sent, currency_sent, group_id')
            .eq('id', transactionId)
            .single()

        if (txError) throw txError

        let matchAmount = tx.amount_sent

        // 2. If grouped, get total amount for the group
        if (tx.group_id) {
            const { data: groupTxs, error: groupError } = await supabase
                .from('transactions')
                .select('amount_sent')
                .eq('group_id', tx.group_id)

            if (groupError) throw groupError
            matchAmount = groupTxs.reduce((sum, item) => sum + Number(item.amount_sent), 0)
        }

        // 3. Find deposits with exact total amount and currency
        const { data, error } = await supabase
            .from('bank_deposits')
            .select('*')
            .eq('status', 'available')
            .eq('currency', tx.currency_sent)
            .eq('amount', matchAmount)

        if (error) throw error
        return data as BankDeposit[]
    }
}
