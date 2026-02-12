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

async function promoteAdmin() {
    console.log('--- Buscando usuario VICTOR ---');
    const { data: users, error: uError } = await supabase
        .from('profiles')
        .select('*')
        .ilike('full_name', '%VICTOR%');

    if (uError) {
        console.error('Error al buscar usuario:', uError);
        return;
    }

    if (users.length === 0) {
        console.log('No se encontró el usuario VICTOR en profiles.');
        return;
    }

    const victor = users[0];
    console.log(`Usuario encontrado: ${victor.full_name} (${victor.id})`);

    const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', victor.id);

    if (updateError) {
        console.error('Error al promover a admin:', updateError);
    } else {
        console.log('¡Éxito! VICTOR ahora es administrador.');
    }
}

promoteAdmin();
