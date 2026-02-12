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

async function testUpload() {
    console.log('--- Intentando Subida de Prueba a "payments" ---');
    const content = 'Test connection ' + new Date().toISOString();
    const { data, error } = await supabase.storage
        .from('payments')
        .upload('test-' + Date.now() + '.txt', content);

    if (error) {
        console.error('❌ Error al subir:', error.message);
    } else {
        console.log('✅ Archivo de prueba subido con éxito:', data.path);
    }
}

testUpload();
