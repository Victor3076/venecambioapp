const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyProfiles() {
    const { data, error, count } = await supabase.from('profiles').select('*', { count: 'exact' });
    if (error) {
        console.error('Error al consultar profiles:', error.message);
        return;
    }
    console.log(`--- Verificando Tabla Profiles ---`);
    console.log(`Registros encontrados: ${count}`);
    if (data.length > 0) {
        console.log('Últimos emails registrados:');
        data.slice(0, 5).forEach(p => console.log(`- ${p.email} (${p.role})`));
    }
}

verifyProfiles();
