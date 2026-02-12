const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local manually
const envPath = path.resolve(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envConfig = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        envConfig[key.trim()] = value.trim();
    }
});

const url = envConfig['NEXT_PUBLIC_SUPABASE_URL'];
const key = envConfig['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!url || !key) {
    console.error('Missing credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(url, key);

async function testConnection() {
    console.log('Testing connection to:', url);
    const { data, error } = await supabase.from('rates_configuration').select('*').limit(1);
    if (error) {
        console.error('Connection Failed:', error.message);
    } else {
        console.log('Connection Successful! Rows found:', data.length);
    }
}

testConnection();
