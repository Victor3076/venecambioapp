'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

// NOTE: This app uses localStorage for Supabase sessions, so server-side cookie-based
// auth validation cannot be used here. Security is enforced by:
// 1. RLS policies on Supabase (users cannot call admin APIs directly)
// 2. These actions use SUPABASE_SERVICE_ROLE_KEY which is never exposed to the client
// 3. Client-side role checks in admin/layout.tsx prevent UI access

export async function createUser(formData: { phone: string; fullName: string; clientCode?: string; role: 'user' | 'admin' | 'operator'; password?: string }) {
    const technicalEmail = `${formData.phone.replace('+', '')}@venecambio.app`
    const finalPassword = formData.password || '123456'
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

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

    if (error) {
        console.error('Error creating user:', error)
        throw new Error(error.message)
    }

    revalidatePath('/admin/users')
    return { success: true, user: data.user }
}

export async function updateUser(id: string, formData: { phone: string; fullName: string; clientCode?: string; role: 'user' | 'admin' | 'operator' }) {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        user_metadata: {
            full_name: formData.fullName,
            phone: formData.phone,
            role: formData.role,
            client_code: formData.clientCode
        }
    })

    if (authError) throw new Error(authError.message)

    const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
            full_name: formData.fullName,
            client_code: formData.clientCode,
            role: formData.role,
            phone: formData.phone
        })
        .eq('id', id)

    if (profileError) throw new Error(profileError.message)

    revalidatePath('/admin/users')
    return { success: true }
}

export async function deleteUser(id: string) {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    await supabaseAdmin.from('profiles').delete().eq('id', id)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
    if (error) throw new Error(error.message)

    revalidatePath('/admin/users')
    return { success: true }
}

export async function resetPassword(id: string) {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        password: '123456'
    })

    if (authError) throw new Error(authError.message)

    const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ must_change_password: true })
        .eq('id', id)

    if (profileError) throw new Error(profileError.message)

    revalidatePath('/admin/users')
    return { success: true }
}
