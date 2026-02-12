import { supabase } from '@/lib/supabase'

export interface Transaction {
    id?: string
    user_id: string
    status: 'verifying' | 'verified' | 'completed' | 'rejected'
    amount_sent: number
    currency_sent: string
    amount_received: number
    currency_received: string
    exchange_rate: number
    reference_id?: string
    payment_proof_url?: string
    completion_proof_url?: string
    created_at?: string
    updated_at?: string
}

export const TransactionsService = {
    async create(tx: Omit<Transaction, 'id' | 'user_id' | 'status' | 'created_at' | 'updated_at'>) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("No user authenticated")

        const { data, error } = await supabase
            .from('transactions')
            .insert([{
                ...tx,
                user_id: user.id,
                status: 'verifying'
            }])
            .select()

        if (error) throw error
        return data[0]
    },

    async getMyTransactions() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return []

        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching transactions:', error)
            return []
        }

        return data as Transaction[]
    },

    async uploadProof(file: File, transactionId: string) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${transactionId}/${Math.random()}.${fileExt}`
        const filePath = `proofs/${fileName}`

        const { error: uploadError } = await supabase.storage
            .from('payments')
            .upload(filePath, file)

        if (uploadError) {
            console.error('Upload error:', uploadError)
            throw uploadError
        }

        const { data } = supabase.storage
            .from('payments')
            .getPublicUrl(filePath)

        const publicUrl = data.publicUrl

        const { error: updateError } = await supabase
            .from('transactions')
            .update({ payment_proof_url: publicUrl })
            .eq('id', transactionId)

        if (updateError) throw updateError

        return publicUrl
    },

    async getAll() {
        const { data, error } = await supabase
            .from('transactions')
            .select('*, profiles(email, full_name)')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error de Supabase (con join):', JSON.stringify(error, null, 2))

            // Reintento sin el JOIN para ver si al menos cargan los datos básicos
            const { data: fallbackData, error: fallbackError } = await supabase
                .from('transactions')
                .select('*')
                .order('created_at', { ascending: false })

            if (fallbackError) {
                console.error('Error fatal (sin join):', fallbackError)
                return []
            }
            return fallbackData as any
        }

        return data as (Transaction & { profiles: { email: string, full_name: string } })[]
    },

    async updateStatus(id: string, status: Transaction['status'], completionProofUrl?: string) {
        const updateData: any = {
            status: status,
            updated_at: new Date().toISOString()
        }

        if (completionProofUrl) {
            updateData.completion_proof_url = completionProofUrl
        }

        const { error } = await supabase
            .from('transactions')
            .update(updateData)
            .eq('id', id)

        if (error) throw error
    }
}

