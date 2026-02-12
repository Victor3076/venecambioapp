'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

export async function createUser(formData: { phone: string; fullName: string; clientCode?: string; role: 'user' | 'admin'; password?: string }) {
    // Generar un email técnico basado en el teléfono para compatibilidad con Auth
    const technicalEmail = `${formData.phone.replace('+', '')}@venecambio.app`
    const finalPassword = formData.password || '123456'
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: technicalEmail,
        password: finalPassword,
        user_metadata: {
            full_name: formData.fullName,
            role: formData.role,
            phone: formData.phone, // Guardamos el teléfono original en metadata
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

export async function updateUser(id: string, formData: { phone: string; fullName: string; clientCode?: string; role: 'user' | 'admin' }) {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. Actualizar metadata en Auth
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        user_metadata: {
            full_name: formData.fullName,
            phone: formData.phone,
            role: formData.role,
            client_code: formData.clientCode
        }
    })

    if (authError) throw new Error(authError.message)

    // 2. Actualizar tabla public.profiles
    const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
            full_name: formData.fullName,
            client_code: formData.clientCode,
            role: formData.role
            // Nota: El email/phone se maneja via auth
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

    // 1. Borrar de profiles primero para evitar conflictos de FK (si no hay cascade)
    await supabaseAdmin.from('profiles').delete().eq('id', id)

    // 2. Borrar de Auth
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id)

    if (error) throw new Error(error.message)

    revalidatePath('/admin/users')
    return { success: true }
}
