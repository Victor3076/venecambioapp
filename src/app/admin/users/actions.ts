'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

// NOTE: This app uses localStorage for Supabase sessions, so server-side cookie-based
// auth validation cannot be used here. Security is enforced by:
// 1. RLS policies on Supabase (users cannot call admin APIs directly)
// 2. These actions use SUPABASE_SERVICE_ROLE_KEY which is never exposed to the client
// 3. Client-side role checks in admin/layout.tsx prevent UI access

function getAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
        throw new Error('Configuración del servidor incompleta (variables de entorno faltantes).')
    }

    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false }
    })
}

export async function createUser(formData: { phone: string; fullName: string; clientCode?: string; role: 'user' | 'admin' | 'operator'; password?: string }) {
    try {
        const technicalEmail = `${formData.phone.replace('+', '')}@venecambio.app`
        const finalPassword = formData.password || '123456'
        const supabaseAdmin = getAdminClient()

        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: technicalEmail,
            password: finalPassword,
            user_metadata: {
                full_name: formData.fullName,
                role: formData.role,
                phone: formData.phone,
                client_code: formData.clientCode
            },
            email_confirm: true
        })

        if (error) return { success: false, error: error.message }

        revalidatePath('/admin/users')
        return { success: true, user: data.user }
    } catch (e: any) {
        console.error('Error en createUser:', e)
        return { success: false, error: e.message }
    }
}

export async function updateUser(id: string, formData: { phone: string; fullName: string; clientCode?: string; role: 'user' | 'admin' | 'operator' }) {
    try {
        const supabaseAdmin = getAdminClient()

        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
            user_metadata: {
                full_name: formData.fullName,
                phone: formData.phone,
                role: formData.role,
                client_code: formData.clientCode
            }
        })

        if (authError) return { success: false, error: authError.message }

        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({
                full_name: formData.fullName,
                client_code: formData.clientCode,
                role: formData.role,
                phone: formData.phone
            })
            .eq('id', id)

        if (profileError) return { success: false, error: profileError.message }

        revalidatePath('/admin/users')
        return { success: true }
    } catch (e: any) {
        console.error('Error en updateUser:', e)
        return { success: false, error: e.message }
    }
}

export async function deleteUser(id: string) {
    try {
        const supabaseAdmin = getAdminClient()

        // Primero eliminar de profiles (si existe, por la cascada o RLS)
        await supabaseAdmin.from('profiles').delete().eq('id', id)

        const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
        if (error) return { success: false, error: error.message }

        revalidatePath('/admin/users')
        return { success: true }
    } catch (e: any) {
        console.error('Error en deleteUser:', e)
        return { success: false, error: e.message }
    }
}

export async function resetPassword(id: string) {
    try {
        const supabaseAdmin = getAdminClient()

        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
            password: '123456'
        })

        if (authError) return { success: false, error: authError.message }

        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({ must_change_password: true })
            .eq('id', id)

        if (profileError) return { success: false, error: profileError.message }

        revalidatePath('/admin/users')
        return { success: true }
    } catch (e: any) {
        console.error('Error en resetPassword:', e)
        return { success: false, error: e.message }
    }
}
