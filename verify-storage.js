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

async function listAllBuckets() {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
        console.error('Error:', error.message);
        return;
    }
    console.log('--- Buckets en Supabase ---');
    if (buckets.length === 0) {
        console.log('No se encontraron buckets en Storage.');
    } else {
        buckets.forEach(b => console.log(`- ${b.name} (Público: ${b.public})`));
    }
}

listAllBuckets();
