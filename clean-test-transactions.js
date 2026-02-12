const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Faltan variables de entorno')
    console.log('Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en tu .env.local')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function cleanTestTransactions() {
    console.log('🔍 Buscando todas las transacciones...\n')

    // Primero, listar todas las transacciones
    const { data: allTx, error: fetchError } = await supabase
        .from('transactions')
        .select('id, created_at, amount_sent, currency_sent, amount_received, currency_received, status, profiles(email, full_name)')
        .order('created_at', { ascending: false })

    if (fetchError) {
        console.error('❌ Error al obtener transacciones:', fetchError)
        return
    }

    if (!allTx || allTx.length === 0) {
        console.log('✅ No hay transacciones en la base de datos.')
        return
    }

    console.log(`📊 Total de transacciones encontradas: ${allTx.length}\n`)
    console.log('Lista de transacciones:\n')

    allTx.forEach((tx, index) => {
        console.log(`${index + 1}. ID: ${tx.id?.substring(0, 8)}...`)
        console.log(`   Usuario: ${tx.profiles?.full_name || 'Sin nombre'} (${tx.profiles?.email || 'Sin email'})`)
        console.log(`   Operación: ${tx.amount_sent} ${tx.currency_sent} → ${tx.amount_received} ${tx.currency_received}`)
        console.log(`   Estado: ${tx.status}`)
        console.log(`   Fecha: ${new Date(tx.created_at).toLocaleString()}`)
        console.log('')
    })

    // Preguntar cuáles eliminar
    console.log('\n⚠️  MODO INTERACTIVO')
    console.log('Para eliminar transacciones de prueba, necesitas identificarlas manualmente.')
    console.log('\nOpciones:')
    console.log('1. Eliminar TODAS las transacciones (⚠️ PELIGROSO)')
    console.log('2. Eliminar solo las transacciones sin usuario válido')
    console.log('3. Salir sin hacer cambios')
    console.log('\nPara este script, voy a mostrar las transacciones y tú decides cuáles eliminar.')
    console.log('Ejecuta este comando SQL en Supabase para eliminar transacciones específicas:')
    console.log('\nDELETE FROM transactions WHERE id = \'ID_DE_LA_TRANSACCION\';')
    console.log('\nO para eliminar todas las de prueba (sin usuario):')
    console.log('\nDELETE FROM transactions WHERE user_id NOT IN (SELECT id FROM auth.users);')
}

cleanTestTransactions()
