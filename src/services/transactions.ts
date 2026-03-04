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
    beneficiary_data?: any // JSON snapshot of the account
    profit_percentage?: number
    profit_amount?: number
    group_id?: string
    created_at?: string
    updated_at?: string
}

export const TransactionsService = {
    async createBulk(items: Omit<Transaction, 'id' | 'user_id' | 'status' | 'created_at' | 'updated_at'>[]) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("No user authenticated")

        const groupId = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2) + Date.now().toString(36);

        const txsToInsert = items.map(tx => ({
            ...tx,
            user_id: user.id,
            status: 'verifying',
            group_id: groupId
        }))

        const { data, error } = await supabase
            .from('transactions')
            .insert(txsToInsert)
            .select()

        if (error) throw error
        return data
    },

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

    async createForUser(userId: string, tx: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
        const { data, error } = await supabase
            .from('transactions')
            .insert([{
                ...tx,
                user_id: userId,
                status: tx.status || 'verifying'
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

        console.log(`Starting Supabase storage upload to 'payments/proofs/${fileName}'...`)
        const { error: uploadError } = await supabase.storage
            .from('payments')
            .upload(filePath, file)

        if (uploadError) {
            console.error('Database/Storage upload error:', uploadError)
            throw uploadError
        }
        console.log("Storage upload successful")

        const { data } = supabase.storage
            .from('payments')
            .getPublicUrl(filePath)

        const publicUrl = data.publicUrl

        const { data: currentTx } = await supabase
            .from('transactions')
            .select('group_id')
            .eq('id', transactionId)
            .single()

        const { error: updateError } = await supabase
            .from('transactions')
            .update({ payment_proof_url: publicUrl })
            .or(`id.eq.${transactionId}${currentTx?.group_id ? `,group_id.eq.${currentTx.group_id}` : ''}`)

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

    async getVerifying() {
        // Fetch status 'verifying' 
        const { data, error } = await supabase
            .from('transactions')
            .select('*, profiles(email, full_name)')
            .eq('status', 'verifying')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching verifying transactions:', error)
            return []
        }
        return data as (Transaction & { profiles: { email: string, full_name: string } })[]
    },

    async updateStatus(id: string, status: Transaction['status'], completionProofUrl?: string) {
        // First check if it belongs to a group, especially for 'verified' status
        const { data: tx } = await supabase
            .from('transactions')
            .select('group_id')
            .eq('id', id)
            .single()

        const updateData: any = {
            status: status,
            updated_at: new Date().toISOString()
        }

        if (completionProofUrl) {
            updateData.completion_proof_url = completionProofUrl
        }

        const query = supabase
            .from('transactions')
            .update(updateData)

        if (status === 'verified' && tx?.group_id) {
            query.eq('group_id', tx.group_id)
        } else {
            query.eq('id', id)
        }

        const { error } = await query
        if (error) throw error

        // Notify user about status change
        try {
            // Helper to format amounts consistently with the dashboard
            const fmt = (val: number) => {
                return new Intl.NumberFormat('es-VE', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2
                }).format(val)
            }

            // Get all affected transactions to notify their respective owners
            const { data: affectedTxs } = await supabase
                .from('transactions')
                .select('id, user_id, amount_received, currency_received, amount_sent, currency_sent')
                .eq(status === 'verified' && tx?.group_id ? 'group_id' : 'id', status === 'verified' && tx?.group_id ? tx.group_id : id)

            if (affectedTxs) {
                const statusInfo: Record<string, { title: string, message: (tx: any) => string }> = {
                    verified: {
                        title: 'Fondos Verificados',
                        message: (tx) => `Hemos recibido tus ${fmt(tx.amount_sent)} ${tx.currency_sent}. Tu transferencia de ${fmt(tx.amount_received)} ${tx.currency_received} está en proceso.`
                    },
                    completed: {
                        title: 'Operación Finalizada',
                        message: (tx) => `¡Listo! Tus ${fmt(tx.amount_received)} ${tx.currency_received} han sido enviados. Revisa el comprobante en los detalles.`
                    },
                    rejected: {
                        title: 'Operación Rechazada',
                        message: (tx) => `Ha habido un problema con tu operación de ${fmt(tx.amount_sent)} ${tx.currency_sent}. Por favor revisa los detalles o contáctanos.`
                    }
                }

                const config = statusInfo[status]
                if (config) {
                    const { NotificationsService } = await import('./notifications')
                    await Promise.all(affectedTxs.map(t =>
                        NotificationsService.create({
                            user_id: t.user_id,
                            title: config.title,
                            message: config.message(t),
                            type: 'status_update',
                            data: { transaction_id: t.id }
                        })
                    ))
                }
            }
        } catch (notifyError) {
            console.error("Failed to create in-app notification:", notifyError)
            // Don't fail the status update if notification fails
        }
    },

    async getPublicById(id: string) {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('id', id)
            .single()

        if (error) {
            console.error('Error fetching public transaction:', error)
            return null
        }

        return data as Transaction
    },

    subscribe(callback: () => void) {
        const uniqueId = Math.random().toString(36).substring(2, 9)
        const channel = supabase
            .channel(`admin-txs-${uniqueId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'transactions' },
                (payload) => {
                    console.log('TX Change detected:', payload.eventType)
                    callback()
                }
            )
            .subscribe((status) => {
                console.log(`TX Subscription Status [${uniqueId}]:`, status)
            })

        return () => {
            console.log(`Removing TX channel [${uniqueId}]`)
            supabase.removeChannel(channel)
        }
    },

    async delete(id: string) {
        // Step 1: Unlink any bank deposits and return them to available status
        const { error: unlinkError } = await supabase
            .from('bank_deposits')
            .update({
                matched_transaction_id: null,
                status: 'available'
            })
            .eq('matched_transaction_id', id)

        if (unlinkError) {
            console.error("Error unlinking deposits before deletion:", unlinkError)
            throw unlinkError
        }

        // Step 2: Delete the transaction
        const { error: deleteError } = await supabase
            .from('transactions')
            .delete()
            .eq('id', id)

        if (deleteError) throw deleteError
    }
}

