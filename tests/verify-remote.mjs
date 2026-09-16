// Verifica remotamente se as tabelas usadas pela pagina Inicio ja existem (usa apenas a anon key)
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const tables = [
  'expenses', 'vehicle_fuelings', 'vehicle_maintenance_events',
  'activity_history', 'checklist_templates', 'activity_evidences', 'activity_locations',
  'notifications', 'automation_rules', 'automation_runs',
  'notification_preferences', 'notification_delivery_queue',
];

(async () => {
  let missing = 0;
  for (const t of tables) {
    try {
      const r = await fetch(`${url}/rest/v1/${t}?select=*&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (r.ok) console.log(`OK        ${t}`);
      else { missing++; console.log(`FALTANDO  ${t} (HTTP ${r.status})`); }
    } catch (e) {
      missing++; console.log(`ERRO      ${t}: ${e.message}`);
    }
  }
  console.log(missing === 0 ? '\nTODAS AS TABELAS DISPONIVEIS — a pagina Inicio deve carregar.' : `\n${missing} tabela(s) ainda faltando.`);
})();
