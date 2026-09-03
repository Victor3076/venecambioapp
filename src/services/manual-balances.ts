import { supabase } from '@/lib/supabase'
import { TransactionsService, Transaction } from './transactions'
import { BankDepositsService, BankDeposit } from './bank-deposits'

export interface EgliDiscountItem {
    id: string
    name: string
    amount: string
}

export interface EgliBreakdownData {
    previous_pending: string
    yesterday_date: string
    yesterday_ops_total: number
    discounts: EgliDiscountItem[]
    calculated_pending: number
}

export interface BalanceRowData {
    yesterday: string
    today_pass: string
    today_clps: string
    total: number
    breakdown?: EgliBreakdownData
}

export interface ManualBalanceData {
    id?: string
    created_at?: string
    egli: BalanceRowData
    vicmar?: BalanceRowData
    corriente: BalanceRowData
    cyber: BalanceRowData
    adjustment: string
}

export type EgliTransactionItem = Transaction & {
    profiles?: { email?: string; full_name?: string }
    description?: string
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
        const { data, error } = await supabase
            .from('manual_balances')
            .insert([{
                egli: payload.egli,
                vicmar: payload.vicmar || { yesterday: "0", today_pass: "0", today_clps: "0", total: 0 },
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
    },

    async getEgliOperations(dateStr: string) {
        // Query transactions for that date
        const txs = (await TransactionsService.getAll({ startDate: dateStr, endDate: dateStr })) as EgliTransactionItem[]
        const deposits = await BankDepositsService.getAll()

        // Build deposit lookups
        const byTxId = new Map<string, BankDeposit>()
        const byGroupId = new Map<string, BankDeposit>()
        const txToGroupMap = new Map<string, string>()

        txs.forEach(t => {
            if (t.id && t.group_id) txToGroupMap.set(t.id, t.group_id)
        })

        deposits.forEach((d: BankDeposit) => {
            if (d.matched_transaction_id) {
                byTxId.set(d.matched_transaction_id, d)
                const groupId = txToGroupMap.get(d.matched_transaction_id)
                if (groupId) byGroupId.set(groupId, d)
            }
        })

        // Filter CLP transactions matching 'egli' (case-insensitive)
        const searchLower = 'egli'
        const matched = txs.filter(tx => {
            if (tx.currency_sent !== 'CLP') return false
            if (tx.status === 'rejected') return false

            const deposit = tx.id ? byTxId.get(tx.id) : undefined || (tx.group_id ? byGroupId.get(tx.group_id) : undefined)

            const matchesSearch =
                tx.profiles?.full_name?.toLowerCase().includes(searchLower) ||
                tx.profiles?.email?.toLowerCase().includes(searchLower) ||
                tx.id?.toLowerCase().includes(searchLower) ||
                tx.reference_id?.toLowerCase().includes(searchLower) ||
                tx.description?.toLowerCase().includes(searchLower) ||
                deposit?.bank_name?.toLowerCase().includes(searchLower) ||
                deposit?.reference_number?.toLowerCase().includes(searchLower) ||
                deposit?.notes?.toLowerCase().includes(searchLower)

            return Boolean(matchesSearch)
        })

        const total = matched.reduce((sum: number, tx) => sum + Number(tx.amount_sent || 0), 0)

        return {
            total,
            count: matched.length,
            operations: matched
        }
    }
}
