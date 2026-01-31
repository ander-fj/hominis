// Script para gerar dados históricos de 6 meses
// Cole este script no console do browser (F12) e execute

import { generateHistoricalData } from './src/lib/rankingEngine';

console.log('🚀 Iniciando geração de dados históricos...');
await generateHistoricalData();
console.log('✅ Dados históricos gerados com sucesso!');
console.log('🔄 Recarregue a página para ver os novos períodos no filtro.');
