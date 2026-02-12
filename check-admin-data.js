const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Leer .env.local manualmente
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkData() {
    console.log('--- Verificando Transacciones ---');
    const { data: txs, error: txError } = await supabase
        .from('transactions')
        .select('*');

    if (txError) {
        console.error('Error al leer transacciones:', txError);
    } else {
        console.log(`Total transacciones encontradas: ${txs.length}`);
        if (txs.length > 0) {
            console.log('Última transacción:', JSON.stringify(txs[0], null, 2));
        }
    }

    console.log('\n--- Verificando Perfiles ---');
    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('*');

    if (pError) {
        console.error('Error al leer perfiles:', pError);
    } else {
        console.log(`Total perfiles encontrados: ${profiles.length}`);
        profiles.forEach(p => console.log(`- ${p.full_name} (${p.email}): Role=${p.role}`));
    }

    console.log('\n--- Verificando Cuentas ---');
    const { data: accounts, error: aError } = await supabase
        .from('user_accounts')
        .select('*');

    if (aError) {
        console.error('Error al leer cuentas:', aError);
    } else {
        console.log(`Total cuentas encontradas: ${accounts.length}`);
    }
}

checkData();
