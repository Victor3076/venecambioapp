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

async function verifyRates() {
    const { data, error } = await supabase.from('rates_configuration').select('*').limit(1);
    if (error) {
        console.error('Error al consultar rates_configuration:', error.message);
        return;
    }
    console.log(`--- Verificando Tabla Rates Configuration ---`);
    if (data && data.length > 0) {
        console.log('✅ Datos de tasas encontrados. El esquema SQL se ejecutó correctamente.');
        console.log('Precios USD:', JSON.stringify(data[0].usdt_prices));
    } else {
        console.log('❌ Tabla vacía. Posiblemente falta ejecutar el seed o el SQL.');
    }
}

verifyRates();
