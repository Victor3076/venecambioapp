import { supabase } from '@/lib/supabase'

export interface UserAccount {
    id?: string
    user_id: string
    alias: string
    country: string
    bank_name: string
    account_number: string
    details: any
    created_at?: string
}

export const AccountsService = {
    async getMyAccounts() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return []

        const { data, error } = await supabase
            .from('user_accounts')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching accounts:', error)
            return []
        }

        return data as UserAccount[]
    },

    async createAccount(account: Omit<UserAccount, 'id' | 'user_id' | 'created_at'>) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("No user authenticated")

        const { data, error } = await supabase
            .from('user_accounts')
            .insert([{
                ...account,
                user_id: user.id
            }])
            .select()

        if (error) throw error
        return data[0]
    },

    async deleteAccount(id: string) {
        const { error } = await supabase
            .from('user_accounts')
            .delete()
            .eq('id', id)

        if (error) throw error
    }
}
