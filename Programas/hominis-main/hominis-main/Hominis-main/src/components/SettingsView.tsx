import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, GripVertical, RefreshCw, Link2, Download, Upload, Database as DatabaseIcon } from 'lucide-react';
import Card from './Card';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { recalculateAllRankings, autoAdjustWeights } from '../lib/ranking';
import { seedSampleData } from '../lib/seed';

type Criterion = Database['public']['Tables']['evaluation_criteria']['Row'];

export default function SettingsView() {
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [sheetUrl, setSheetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    loadCriteria();
    loadSheetConfig();
  }, []);

  const loadCriteria = async () => {
    const { data } = await supabase
      .from('evaluation_criteria')
      .select('*')
      .order('display_order');
    if (data) setCriteria(data);
  };

  const loadSheetConfig = async () => {
    const { data } = await supabase
      .from('sheets_sync_config')
      .select('*')
      .maybeSingle();
    if (data) setSheetUrl(data.sheet_url);
  };

  const handleWeightChange = (id: string, newWeight: number) => {
    setCriteria(prev =>
      prev.map(c => (c.id === id ? { ...c, weight: newWeight } : c))
    );
  };

  const handleAddCriterion = async () => {
    const newCriterion: Database['public']['Tables']['evaluation_criteria']['Insert'] = {
      name: 'Novo Critério',
      description: 'Descrição do critério',
      data_type: 'numeric',
      weight: 0,
      direction: 'higher_better',
      source: 'manual',
      display_order: criteria.length,
      active: true,
    };

    const { data, error } = await supabase
      .from('evaluation_criteria')
      .insert(newCriterion)
      .select()
      .single();

    if (data && !error) {
      setCriteria([...criteria, data]);
    }
  };

  const handleDeleteCriterion = async (id: string) => {
    await supabase.from('evaluation_criteria').delete().eq('id', id);
    setCriteria(prev => prev.filter(c => c.id !== id));
  };

  const handleSaveCriteria = async () => {
    setSaving(true);
    try {
      for (const criterion of criteria) {
        await supabase
          .from('evaluation_criteria')
          .update({
            name: criterion.name,
            description: criterion.description,
            weight: criterion.weight,
            direction: criterion.direction,
            data_type: criterion.data_type,
            source: criterion.source,
            display_order: criterion.display_order,
          })
          .eq('id', criterion.id);
      }
      alert('Critérios salvos com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar critérios');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoAdjustWeights = async () => {
    const activeCriteria = criteria.filter(c => c.active);
    await autoAdjustWeights(activeCriteria.map(c => c.id));
    await loadCriteria();
  };

  const handleRecalculateRanking = async () => {
    setRecalculating(true);
    try {
      await recalculateAllRankings();
      alert('Rankings recalculados com sucesso!');
    } catch (error) {
      console.error('Erro ao recalcular:', error);
      alert('Erro ao recalcular rankings');
    } finally {
      setRecalculating(false);
    }
  };

  const handleSeedData = async () => {
    if (!confirm('Isso irá inserir dados de exemplo. Continuar?')) return;
    setSeeding(true);
    try {
      await seedSampleData();
      alert('Dados de exemplo inseridos com sucesso!');
      await loadCriteria();
    } catch (error) {
      console.error('Erro ao inserir dados:', error);
      alert('Erro ao inserir dados de exemplo');
    } finally {
      setSeeding(false);
    }
  };

  const handleSaveSheetConfig = async () => {
    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from('sheets_sync_config')
        .select('*')
        .maybeSingle();

      if (existing) {
        await supabase
          .from('sheets_sync_config')
          .update({ sheet_url: sheetUrl })
          .eq('id', existing.id);
      } else {
        await supabase.from('sheets_sync_config').insert({
          sheet_url: sheetUrl,
          sheet_name: 'HR Data',
          data_type: 'employees',
          sync_enabled: true,
        });
      }
      alert('Configuração salva!');
    } catch (error) {
      alert('Erro ao salvar configuração');
    } finally {
      setLoading(false);
    }
  };

  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
  const isWeightValid = Math.abs(totalWeight - 100) < 0.01;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Configurações</h1>
          <p className="text-slate-600 mt-1">Gerencie critérios de avaliação e sincronização de dados</p>
        </div>
      </div>

      <Card
        title="Sincronização Google Sheets"
        subtitle="Configure a URL da planilha para sincronização automática"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              URL da Planilha
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleSaveSheetConfig}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Link2 className="w-4 h-4" />
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Atualizar Dados
            </button>
            <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Importar XLSX
            </button>
            <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2">
              <Download className="w-4 h-4" />
              Exportar XLSX
            </button>
            <button
              onClick={handleSeedData}
              disabled={seeding}
              className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-500 text-white rounded-lg hover:from-violet-700 hover:to-purple-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <DatabaseIcon className="w-4 h-4" />
              {seeding ? 'Inserindo...' : 'Dados de Exemplo'}
            </button>
          </div>
        </div>
      </Card>

      <Card
        title="Critérios de Avaliação"
        subtitle="Configure os critérios e pesos para o ranking inteligente"
        action={
          <div className="flex gap-2">
            <button
              onClick={handleAutoAdjustWeights}
              className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Auto-ajustar Pesos
            </button>
            <button
              onClick={handleAddCriterion}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className={`p-4 rounded-lg ${isWeightValid ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Peso Total:</span>
              <span className={`text-2xl font-bold ${isWeightValid ? 'text-green-600' : 'text-amber-600'}`}>
                {totalWeight.toFixed(2)}%
              </span>
            </div>
            {!isWeightValid && (
              <p className="text-xs text-amber-600 mt-2">
                A soma dos pesos deve ser exatamente 100%
              </p>
            )}
          </div>

          <div className="space-y-3">
            {criteria.map((criterion, index) => (
              <div
                key={criterion.id}
                className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
              >
                <button className="cursor-move text-slate-400 hover:text-slate-600">
                  <GripVertical className="w-5 h-5" />
                </button>

                <div className="flex-1 grid grid-cols-12 gap-3 items-center">
                  <input
                    type="text"
                    value={criterion.name}
                    onChange={(e) =>
                      setCriteria(prev =>
                        prev.map(c => (c.id === criterion.id ? { ...c, name: e.target.value } : c))
                      )
                    }
                    className="col-span-3 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="Nome"
                  />

                  <select
                    value={criterion.data_type}
                    onChange={(e) =>
                      setCriteria(prev =>
                        prev.map(c =>
                          c.id === criterion.id
                            ? { ...c, data_type: e.target.value as Criterion['data_type'] }
                            : c
                        )
                      )
                    }
                    className="col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="numeric">Numérico</option>
                    <option value="percentage">Percentual</option>
                    <option value="binary">Binário</option>
                    <option value="score">Escore</option>
                  </select>

                  <select
                    value={criterion.direction}
                    onChange={(e) =>
                      setCriteria(prev =>
                        prev.map(c =>
                          c.id === criterion.id
                            ? { ...c, direction: e.target.value as Criterion['direction'] }
                            : c
                        )
                      )
                    }
                    className="col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="higher_better">Maior = Melhor</option>
                    <option value="lower_better">Menor = Melhor</option>
                  </select>

                  <select
                    value={criterion.source}
                    onChange={(e) =>
                      setCriteria(prev =>
                        prev.map(c =>
                          c.id === criterion.id
                            ? { ...c, source: e.target.value as Criterion['source'] }
                            : c
                        )
                      )
                    }
                    className="col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="manual">Manual</option>
                    <option value="sheets">Google Sheets</option>
                    <option value="calculated">Calculado</option>
                  </select>

                  <div className="col-span-2 flex items-center gap-2">
                    <input
                      type="number"
                      value={criterion.weight}
                      onChange={(e) => handleWeightChange(criterion.id, parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      step="0.01"
                      min="0"
                      max="100"
                    />
                    <span className="text-sm text-slate-600 whitespace-nowrap">%</span>
                  </div>

                  <div className="col-span-1 flex justify-end">
                    <button
                      onClick={() => handleDeleteCriterion(criterion.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={handleSaveCriteria}
              disabled={saving || !isWeightValid}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar Critérios'}
            </button>
            <button
              onClick={handleRecalculateRanking}
              disabled={recalculating}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 text-white rounded-lg hover:from-emerald-700 hover:to-teal-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
              {recalculating ? 'Recalculando...' : 'Recalcular Ranking'}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
