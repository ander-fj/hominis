import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});

const supabase = createClient(
  envVars.VITE_SUPABASE_URL,
  envVars.VITE_SUPABASE_ANON_KEY
);

async function testDelete() {
  console.log('🧪 Testando chamada RPC truncate_all_data...\n');

  try {
    const { data, error } = await supabase.rpc('truncate_all_data');

    console.log('📦 Resposta:');
    console.log('  Data:', data);
    console.log('  Error:', error);

    if (error) {
      console.error('\n❌ ERRO:', error);
      console.error('  Código:', error.code);
      console.error('  Mensagem:', error.message);
      console.error('  Detalhes:', error.details);
      console.error('  Hint:', error.hint);
    } else if (data) {
      console.log('\n✅ SUCESSO!');
      console.log('\nRegistros deletados:');
      data.forEach(row => {
        console.log(`  ${row.table_name}: ${row.rows_deleted} registros`);
      });

      const total = data.reduce((sum, row) => sum + row.rows_deleted, 0);
      console.log(`\n📊 Total: ${total} registros deletados`);
    }
  } catch (err) {
    console.error('\n💥 EXCEÇÃO:', err);
  }
}

testDelete();
