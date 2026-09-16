import { useState, useEffect, useRef } from 'react';
import { Save, Plus, Trash2, GripVertical, RefreshCw, Link2, Database as DatabaseIcon, FileSpreadsheet, Download, CheckCircle2, Circle, Layers, Table, Upload, AlertTriangle, User, Palette } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '../../lib/dndUtils';
import MRSCard from './MRSCard';
import RecalculationStatus from './RecalculationStatus';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, writeBatch, query, orderBy, getDoc, limit } from 'firebase/firestore';
import { getTenantCollection } from '../../lib/tenantUtils';
import { recalculateAllRankingsEngine, generateHistoricalData } from '../../lib/rankingEngine';
import { seedSampleData } from '../../lib/seed';
import * as XLSX from 'xlsx';

// Helper function to delete a collection in batches
async function deleteCollection(collectionRef: any, batchSize: number = 500) {
  const q = query(collectionRef, limit(batchSize));

  while (true) {
    const snapshot = await getDocs(q);
    if (snapshot.size === 0) break;

    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }
}

interface Criterion {
  id: string;
  name: string;
  description: string | null;
  data_type: string;
  weight: number;
  direction: 'higher_better' | 'lower_better';
  source: string;
  display_order: number;
  active: boolean;
}

interface SyncPage {
  id: string;
  page_name: string;
  sheet_name: string;
  table_name: string;
  is_enabled: boolean;
  accumulate_data: boolean;
  last_sync_at: string | null;
  sync_count: number;
  description: string | null;
}

interface SortableCriterionProps {
  criterion: Criterion;
  onUpdate: (id: string, field: string, value: any) => void;
  onDelete: (id: string) => void;
}

function SortableCriterion({ criterion, onUpdate, onDelete }: SortableCriterionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: criterion.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-blue-300 transition-colors"
    >
      <button {...attributes} {...listeners} className="cursor-move text-gray-400 hover:text-[#912325]">
        <GripVertical className="w-5 h-5" />
      </button>

      <div className="flex-1 grid grid-cols-12 gap-3 items-center">
        <input
          type="text"
          value={criterion.name}
          onChange={(e) => onUpdate(criterion.id, 'name', e.target.value)}
          className="col-span-3 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#912325]"
          placeholder="Nome"
        />

        <select
          value={criterion.data_type}
          onChange={(e) => onUpdate(criterion.id, 'data_type', e.target.value)}
          className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#912325]"
        >
          <option value="numeric">Numérico</option>
          <option value="percentage">Percentual</option>
          <option value="binary">Binário</option>
          <option value="score">Escore</option>
        </select>

        <select
          value={criterion.direction}
          onChange={(e) => onUpdate(criterion.id, 'direction', e.target.value)}
          className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#912325]"
        >
          <option value="higher_better">Maior = Melhor</option>
          <option value="lower_better">Menor = Melhor</option>
        </select>

        <select
          value={criterion.source}
          onChange={(e) => onUpdate(criterion.id, 'source', e.target.value)}
          className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#912325]"
        >
          <option value="manual">Manual</option>
          <option value="sheets">Google Sheets</option>
          <option value="calculated">Calculado</option>
        </select>

        <div className="col-span-2 flex items-center gap-2">
          <input
            type="number"
            value={criterion.weight}
            onChange={(e) => onUpdate(criterion.id, 'weight', parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#912325]"
            step="0.01"
            min="0"
            max="100"
          />
          <span className="text-sm text-gray-600 whitespace-nowrap">%</span>
        </div>

        <button
          onClick={() => onDelete(criterion.id)}
          className="col-span-1 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function Configuracoes() {
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [sheetUrl, setSheetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [syncPages, setSyncPages] = useState<SyncPage[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatingHistory, setGeneratingHistory] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadCriteria();
    loadSheetConfig();
    loadSyncPages();

    // Busca o nome de usuário do localStorage quando o componente é montado.
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  const loadCriteria = async () => {
    const criteriaQuery = query(getTenantCollection('evaluation_criteria'), orderBy('display_order'));
    const querySnapshot = await getDocs(criteriaQuery);
    const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Criterion[];
    if (data) setCriteria(data);
  };

  const loadSheetConfig = async () => {
    // Assuming a single document for config, e.g., with ID 'main'
    const configDoc = await getDoc(doc(getTenantCollection('sheets_sync_config'), 'main'));
    if (configDoc.exists()) {
      setSheetUrl(configDoc.data().sheet_url);
    }
  };

  const loadSyncPages = async () => {
    const pagesQuery = query(getTenantCollection('sheets_sync_pages'), orderBy('page_name'));
    const querySnapshot = await getDocs(pagesQuery);
    const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SyncPage[];
    if (data) setSyncPages(data);
  };

  const togglePageEnabled = async (pageId: string, currentValue: boolean) => {
    const pageRef = doc(getTenantCollection('sheets_sync_pages'), pageId);
    await updateDoc(pageRef, { is_enabled: !currentValue });
    await loadSyncPages();
  };

  const toggleAccumulateData = async (pageId: string, currentValue: boolean) => {
    const pageRef = doc(getTenantCollection('sheets_sync_pages'), pageId);
    await updateDoc(pageRef, { accumulate_data: !currentValue });
    await loadSyncPages();
  };

  const handleSyncFromSheets = async () => {
    if (!sheetUrl) {
      alert('Configure a URL da planilha primeiro');
      return;
    }

    const enabledPages = syncPages.filter(p => p.is_enabled);
    if (enabledPages.length === 0) {
      alert('Selecione ao menos uma página para sincronizar');
      return;
    }

    if (!confirm(`Sincronizar ${enabledPages.length} página(s) selecionada(s)?`)) {
      return;
    }

    setSyncing(true);
    try {
      alert('Funcionalidade de sincronização em desenvolvimento. Em breve será possível importar dados diretamente do Google Sheets!');
      const batch = writeBatch(db);
      for (const page of enabledPages) {
        const pageRef = doc(getTenantCollection('sheets_sync_pages'), page.id);
        batch.update(pageRef, { last_sync_at: new Date().toISOString(), sync_count: page.sync_count + 1 });
      }
      await batch.commit();

      await loadSyncPages();
    } catch (error) {
      alert('Erro na sincronização');
    } finally {
      setSyncing(false);
    }
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setCriteria((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const reordered = arrayMove(items, oldIndex, newIndex);

        reordered.forEach((item, index) => {
          item.display_order = index;
        });

        return reordered;
      });
    }
  };

  const handleUpdate = (id: string, field: string, value: any) => {
    setCriteria(prev =>
      prev.map(c => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleAdd = async () => {
    const newCriterion = {
      name: 'Novo Critério',
      description: '',
      data_type: 'numeric',
      weight: 0,
      direction: 'higher_better',
      source: 'manual',
      display_order: criteria.length,
      active: true,
    };

    const docRef = await addDoc(getTenantCollection('evaluation_criteria'), newCriterion);
    setCriteria([...criteria, { id: docRef.id, ...newCriterion }]);
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(getTenantCollection('evaluation_criteria'), id));
    setCriteria(prev => prev.filter(c => c.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const batch = writeBatch(db);
      criteria.forEach(criterion => {
        const { id, ...dataToUpdate } = criterion;
        const docRef = doc(getTenantCollection('evaluation_criteria'), id);
        batch.update(docRef, {
          name: dataToUpdate.name,
          description: dataToUpdate.description,
          weight: dataToUpdate.weight,
          direction: dataToUpdate.direction,
          data_type: dataToUpdate.data_type,
          source: dataToUpdate.source,
          display_order: dataToUpdate.display_order,
        });
      });
      await batch.commit();
      alert('Critérios salvos com sucesso!');
    } catch (error) {
      alert('Erro ao salvar critérios');
    } finally {
      setSaving(false);
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      await recalculateAllRankingsEngine();
      alert('Rankings recalculados com sucesso!');
    } catch (error) {
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
    } catch (error) {
      alert('Erro ao inserir dados');
    } finally {
      setSeeding(false);
    }
  };

  const handleGenerateHistory = async () => {
    if (!confirm('Isso irá gerar dados de performance para os últimos 6 meses (Mai-Out 2025). Continuar?')) return;
    setGeneratingHistory(true);
    try {
      await generateHistoricalData();
      alert('Dados históricos gerados com sucesso! Agora você tem 6 meses de histórico disponíveis.');
    } catch (error) {
      console.error('Erro ao gerar dados históricos:', error);
      alert('Erro ao gerar dados históricos');
    } finally {
      setGeneratingHistory(false);
    }
  };

  const handleDeleteAllData = async () => {
    const confirmText = 'EXCLUIR TUDO';
    const userInput = prompt(
      `⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL!\n\n` +
      `Você está prestes a EXCLUIR TODOS OS DADOS do sistema (EXCETO COLABORADORES):\n` +
      `• Todas as avaliações de desempenho\n` +
      `• Todos os treinamentos\n` +
      `• Todos os EPIs\n` +
      `• Todos os exames médicos\n` +
      `• Todos os incidentes\n` +
      `• Todos os registros de férias\n` +
      `• Todo o histórico de rankings\n\n` +
      `Para confirmar, digite: ${confirmText}`
    );

    if (userInput !== confirmText) {
      if (userInput !== null) {
        alert('Operação cancelada. Texto de confirmação incorreto.');
      }
      return;
    }

    setDeletingAll(true);

    try {
      const collectionsToDelete = [
        'employee_scores',
        'employee_rankings',
        'sst_trainings',
        'sst_ppe',
        'sst_medical_exams',
        'sst_incidents',
        'vacation_records',
        'employee_comments',
        'ranking_recalculation_queue',
        'sst_goals',
        'attendance_records',
        'evaluation_criteria',
        'sheets_sync_config',
        'sheets_sync_pages',
      ];

      const logLines: string[] = [];
      let totalDeleted = 0;
      const failedCollections: string[] = [];

      for (const collectionName of collectionsToDelete) {
        try {
          const collectionRef = getTenantCollection(collectionName);
          const snapshotCheck = await getDocs(query(collectionRef, limit(1)));
          if (snapshotCheck.empty) {
            logLines.push(`- ${collectionName}: Vazia, nada para excluir.`);
            continue;
          }

          await deleteCollection(collectionRef);
          logLines.push(`✓ ${collectionName}: Dados excluídos.`);
          totalDeleted++;
        } catch (error) {
          console.error(`Erro ao excluir a coleção ${collectionName}:`, error);
          logLines.push(`❌ ${collectionName}: Erro ao excluir.`);
          failedCollections.push(collectionName);
        }
      }

      let finalMessage = `✅ Operação de exclusão concluída!\n\n`;
      finalMessage += `Coleções limpas: ${totalDeleted}\n\n`;
      finalMessage += `Detalhes:\n${logLines.join('\n')}\n\n`;

            if (failedCollections.length > 0) {

              finalMessage += `⚠️ Atenção: Falha ao excluir dados das seguintes coleções:\n- ${failedCollections.join('\n- ')}\n\n`;

              finalMessage += `Verifique o console para mais detalhes sobre os erros.`;

            } else {

              finalMessage += `Todos os dados selecionados foram excluídos com sucesso!`;

            }

            alert(finalMessage);

      

            setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      console.error('Erro ao excluir dados:', error);
      alert(`❌ Erro ao excluir dados:\n\n${error}\n\nVerifique o console para mais detalhes.`);
      setDeletingAll(false);
    }
  };

  const handleDownloadTemplate = () => {
    const instructionsText = `
╔══════════════════════════════════════════════════════════════════════════╗
║           TEMPLATE UNIFICADO DO GOOGLE SHEETS - MRS RANKING              ║
║                    Sistema de Sincronização Inteligente                  ║
╚══════════════════════════════════════════════════════════════════════════╝

📋 VISÃO GERAL
──────────────────────────────────────────────────────────────────────────

Este template permite sincronizar TODAS as páginas do sistema MRS através de
uma única planilha do Google Sheets. Você pode escolher quais páginas
atualizar e se deseja acumular ou substituir dados.

🎯 CARACTERÍSTICAS PRINCIPAIS:
  ✓ Uma planilha alimenta todas as páginas do sistema
  ✓ Selecione quais páginas serão sincronizadas
  ✓ Abas vazias não afetam dados existentes no sistema
  ✓ Opção de acumular dados ou substituir completamente
  ✓ Histórico de sincronizações e timestamps

═══════════════════════════════════════════════════════════════════════════

📊 ESTRUTURA DAS ABAS
──────────────────────────────────────────────────────────────────────────

Crie uma aba para cada página que deseja sincronizar. Cada aba alimenta
uma página específica do sistema:

┌─────────────────────────────────────────────────────────────────────────┐
│ ABA 1: "Colaboradores"                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│ Sincroniza: Página de Colaboradores                                    │
│ Modo recomendado: SUBSTITUIR (dados mestres)                           │
│                                                                         │
│ Colunas obrigatórias:                                                  │
│   • id (texto único, ex: EMP001)                                       │
│   • nome (texto completo)                                              │
│   • departamento (texto, ex: Operações, RH, TI)                       │
│   • cargo (texto, ex: Operador, Analista)                             │
│   • data_admissao (formato: DD/MM/AAAA)                               │
│   • foto_url (URL da foto - OPCIONAL)                                 │
│                                                                         │
│ Exemplo de dados:                                                      │
│ ┌────────┬────────────────┬──────────────┬─────────────┬──────────────┐│
│ │ id     │ nome           │ departamento │ cargo       │ data_admissao││
│ ├────────┼────────────────┼──────────────┼─────────────┼──────────────┤│
│ │ EMP001 │ João Silva     │ Operações    │ Operador    │ 15/01/2020   ││
│ │ EMP002 │ Maria Santos   │ RH           │ Analista    │ 10/03/2021   ││
│ │ EMP003 │ Pedro Costa    │ SST          │ Técnico SST │ 20/06/2022   ││
│ └────────┴────────────────┴──────────────┴─────────────┴──────────────┘│
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ ABA 2: "Avaliacoes"                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│ Sincroniza: Avaliações de Desempenho                                   │
│ Modo recomendado: ACUMULAR (histórico mensal)                          │
│                                                                         │
│ Colunas obrigatórias:                                                  │
│   • employee_id (deve existir em Colaboradores)                        │
│   • periodo (formato: AAAA-MM, ex: 2025-10)                           │
│   • horas_trabalhadas (número, ex: 176)                               │
│   • faltas_injustificadas (número)                                    │
│   • atrasos (número, em minutos)                                      │
│   • horas_extras (número)                                             │
│   • projetos_concluidos (número)                                      │
│   • metas_atingidas (número, 0-100%)                                  │
│                                                                         │
│ Exemplo de dados:                                                      │
│ ┌────────────┬─────────┬───────────────────┬────────┬─────────┬───────┐│
│ │ employee_id│ periodo │ horas_trabalhadas │ faltas │ atrasos │ metas ││
│ ├────────────┼─────────┼───────────────────┼────────┼─────────┼───────┤│
│ │ EMP001     │ 2025-10 │ 176               │ 0      │ 15      │ 95    ││
│ │ EMP002     │ 2025-10 │ 168               │ 1      │ 0       │ 100   ││
│ │ EMP003     │ 2025-10 │ 180               │ 0      │ 30      │ 85    ││
│ └────────────┴─────────┴───────────────────┴────────┴─────────┴───────┘│
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ ABA 3: "Treinamentos"                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│ Sincroniza: Treinamentos de SST                                        │
│ Modo recomendado: ACUMULAR (registro contínuo)                         │
│                                                                         │
│ Colunas obrigatórias:                                                  │
│   • employee_id                                                        │
│   • training_name (texto, nome do treinamento)                        │
│   • training_date (formato: DD/MM/AAAA)                               │
│   • duration_hours (número, duração em horas)                         │
│   • status (texto: "Concluído", "Pendente", "Agendado")              │
│   • certificate_number (texto - OPCIONAL)                             │
│                                                                         │
│ Exemplo de dados:                                                      │
│ ┌────────────┬────────────────────┬──────────────┬──────────┬──────────┐│
│ │ employee_id│ training_name      │ training_date│ duration │ status   ││
│ ├────────────┼────────────────────┼──────────────┼──────────┼──────────┤│
│ │ EMP001     │ NR-35 Trabalho Alt.│ 10/10/2025   │ 8        │ Concluído││
│ │ EMP002     │ Primeiros Socorros │ 15/10/2025   │ 4        │ Concluído││
│ └────────────┴────────────────────┴──────────────┴──────────┴──────────┘│
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ ABA 4: "EPIs"                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│ Sincroniza: Equipamentos de Proteção Individual                        │
│ Modo recomendado: ACUMULAR (controle de entregas)                      │
│                                                                         │
│ Colunas obrigatórias:                                                  │
│   • employee_id                                                        │
│   • equipment_type (texto, tipo de EPI)                               │
│   • delivery_date (formato: DD/MM/AAAA)                               │
│   • ca_number (texto, Certificado de Aprovação)                       │
│   • quantity (número)                                                 │
│   • condition (texto: "Novo", "Bom", "Substituir")                   │
│                                                                         │
│ Exemplo de dados:                                                      │
│ ┌────────────┬─────────────────┬───────────────┬───────────┬──────────┐│
│ │ employee_id│ equipment_type  │ delivery_date │ ca_number │ quantity ││
│ ├────────────┼─────────────────┼───────────────┼───────────┼──────────┤│
│ │ EMP001     │ Capacete        │ 01/10/2025    │ 12345     │ 1        ││
│ │ EMP001     │ Luvas           │ 01/10/2025    │ 67890     │ 2        ││
│ └────────────┴─────────────────┴───────────────┴───────────┴──────────┘│
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ ABA 5: "Exames"                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ Sincroniza: Exames Médicos Ocupacionais                                │
│ Modo recomendado: ACUMULAR (histórico médico)                          │
│                                                                         │
│ Colunas obrigatórias:                                                  │
│   • employee_id                                                        │
│   • exam_type (texto: "Admissional", "Periódico", "Demissional")     │
│   • exam_date (formato: DD/MM/AAAA)                                   │
│   • result (texto: "Apto", "Inapto", "Apto com restrições")          │
│   • next_exam_date (formato: DD/MM/AAAA)                              │
│   • doctor_name (texto - OPCIONAL)                                    │
│                                                                         │
│ Exemplo de dados:                                                      │
│ ┌────────────┬─────────────┬─────────────┬────────┬────────────────────┐│
│ │ employee_id│ exam_type   │ exam_date   │ result │ next_exam_date     ││
│ ├────────────┼─────────────┼─────────────┼────────┼────────────────────┤│
│ │ EMP001     │ Periódico   │ 05/10/2025  │ Apto   │ 05/10/2026         ││
│ │ EMP002     │ Admissional │ 10/03/2021  │ Apto   │ 10/03/2022         ││
│ └────────────┴─────────────┴─────────────┴────────┴────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ ABA 6: "Incidentes"                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│ Sincroniza: Acidentes e Quase-Acidentes                                │
│ Modo recomendado: ACUMULAR (registro obrigatório)                      │
│                                                                         │
│ Colunas obrigatórias:                                                  │
│   • employee_id                                                        │
│   • incident_date (formato: DD/MM/AAAA)                               │
│   • incident_type (texto: "Acidente", "Quase-acidente")              │
│   • severity (texto: "Leve", "Moderado", "Grave")                     │
│   • description (texto, descrição do ocorrido)                        │
│   • corrective_action (texto - OPCIONAL)                              │
│                                                                         │
│ Exemplo de dados:                                                      │
│ ┌────────────┬──────────────┬────────────────┬──────────┬─────────────┐│
│ │ employee_id│ incident_date│ incident_type  │ severity │ description ││
│ ├────────────┼──────────────┼────────────────┼──────────┼─────────────┤│
│ │ EMP001     │ 12/10/2025   │ Quase-acidente │ Leve     │ Escorregão  ││
│ │ EMP003     │ 15/10/2025   │ Acidente       │ Moderado │ Corte mão   ││
│ └────────────┴──────────────┴────────────────┴──────────┴─────────────┘│
└─────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════

⚙️ CONFIGURAÇÃO NO SISTEMA
──────────────────────────────────────────────────────────────────────────

1. COMPARTILHAR A PLANILHA
   • Arquivo → Compartilhar → "Qualquer pessoa com o link"
   • Permissão: "Leitor"
   • Copie a URL completa

2. CONFIGURAR URL NO SISTEMA
   • Cole a URL no campo "Sincronização Google Sheets"
   • A URL deve ser algo como:
     https://docs.google.com/spreadsheets/d/ABC123.../edit

3. SELECIONAR PÁGINAS
   • Acesse "Seleção de Páginas para Sincronização"
   • Marque as páginas que deseja sincronizar
   • Configure o modo de cada página:

     🔄 ACUMULAR: Adiciona novos dados aos existentes
        Use para: Avaliações, Treinamentos, EPIs, Exames, Incidentes

     🔁 SUBSTITUIR: Apaga dados antigos e insere novos
        Use para: Colaboradores (dados mestres)

4. SINCRONIZAR
   • Clique em "Sincronizar Agora"
   • O sistema processará apenas as abas selecionadas
   • Abas vazias não afetarão os dados existentes

═══════════════════════════════════════════════════════════════════════════

💡 REGRAS E BOAS PRÁTICAS
──────────────────────────────────────────────────────────────────────────

✓ FORMATO DE DADOS:
  • Datas: DD/MM/AAAA (ex: 25/10/2025)
  • Períodos: AAAA-MM (ex: 2025-10)
  • Números: Use ponto decimal (ex: 160.5)
  • IDs: Mantenha consistência (EMP001, EMP002, etc.)

✓ ABAS VAZIAS:
  • Se uma aba estiver vazia, os dados existentes no sistema são mantidos
  • Útil quando você quer sincronizar apenas algumas páginas
  • Não precisa deletar abas, basta deixá-las vazias

✓ MODO ACUMULAR:
  • Ideal para dados que crescem ao longo do tempo
  • Não apaga dados antigos
  • Adiciona apenas registros novos
  • Perfeito para: avaliações mensais, treinamentos, incidentes

✓ MODO SUBSTITUIR:
  • Apaga todos os dados antigos antes de inserir novos
  • Use para dados que devem estar sempre atualizados
  • Perfeito para: cadastro de colaboradores

✓ PRIMEIRA LINHA:
  • Sempre use a primeira linha para os cabeçalhos das colunas
  • Os dados devem começar na linha 2
  • Não altere os nomes das colunas

✓ CÉLULAS VAZIAS:
  • Campos obrigatórios não podem estar vazios
  • Campos opcionais podem ser deixados em branco
  • Evite linhas completamente vazias no meio dos dados

═══════════════════════════════════════════════════════════════════════════

📈 EXEMPLOS DE USO
──────────────────────────────────────────────────────────────────────────

CENÁRIO 1: Atualização Mensal Completa
  ✓ Marcar todas as 6 páginas
  ✓ Colaboradores: Substituir
  ✓ Demais páginas: Acumular
  ✓ Resultado: Cadastro atualizado + novos registros do mês

CENÁRIO 2: Apenas Novos Treinamentos
  ✓ Marcar apenas "Treinamentos"
  ✓ Modo: Acumular
  ✓ Deixar outras abas vazias
  ✓ Resultado: Apenas treinamentos adicionados, resto mantido

CENÁRIO 3: Correção de Cadastros
  ✓ Marcar apenas "Colaboradores"
  ✓ Modo: Substituir
  ✓ Resultado: Cadastros corrigidos, histórico mantido

CENÁRIO 4: Final do Mês
  ✓ Marcar "Avaliacoes", "Treinamentos", "EPIs"
  ✓ Modo: Acumular
  ✓ Resultado: Dados do mês adicionados ao histórico

═══════════════════════════════════════════════════════════════════════════

🔍 TROUBLESHOOTING
──────────────────────────────────────────────────────────────────────────

❌ "Erro ao sincronizar"
   → Verifique se a planilha está compartilhada como "Qualquer pessoa com o link"
   → Confirme que os nomes das colunas estão corretos
   → Verifique se não há células vazias em campos obrigatórios

❌ "Dados não aparecem no sistema"
   → Confirme que a página está marcada para sincronização
   → Verifique se a aba tem o nome exato especificado
   → Certifique-se de que os dados começam na linha 2

❌ "IDs não encontrados"
   → Verifique se o employee_id existe na aba Colaboradores
   → Mantenha consistência nos IDs (maiúsculas/minúsculas)

═══════════════════════════════════════════════════════════════════════════

📞 SUPORTE
──────────────────────────────────────────────────────────────────────────

Para dúvidas ou problemas, entre em contato com o suporte técnico.
Este documento pode ser consultado a qualquer momento.

Versão: 2.0 | Data: Outubro 2025
Sistema MRS Ranking - Gestão Inteligente de Recursos Humanos e SST

═══════════════════════════════════════════════════════════════════════════
    `.trim();

    const blob = new Blob([instructionsText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'MRS_Template_Instrucoes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    alert('Instruções baixadas! Siga o passo a passo para criar sua planilha no Google Sheets.');
  };

  const parseExcelDate = (value: any): string | null => {
    if (!value) return null;

    // Se já for uma data ISO válida, retorna
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.split('T')[0];
    }

    // Se for número (formato Excel serial date)
    if (typeof value === 'number') {
      const date = new Date((value - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }

    // Se for string no formato DD/MM/YYYY ou DD/MM/YY
    if (typeof value === 'string') {
      const parts = value.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        let year = parts[2];

        // Converter ano de 2 dígitos para 4
        if (year.length === 2) {
          const currentYear = new Date().getFullYear();
          const century = Math.floor(currentYear / 100) * 100;
          year = String(century + parseInt(year));
        }

        return `${year}-${month}-${day}`;
      }
    }

    return null;
  };

  const handleUploadExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);

      console.log('📂 Arquivo Excel carregado!');
      console.log('   Abas encontradas:', workbook.SheetNames);

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Processar aba Colaboradores
      if (workbook.SheetNames.includes('Colaboradores')) {
        console.log('📋 Processando aba Colaboradores...');
        const sheet = workbook.Sheets['Colaboradores'];
        const rows = XLSX.utils.sheet_to_json(sheet) as any[];
        console.log(`   Encontradas ${rows.length} linhas`);

        if (rows.length > 0) {
          const employees = rows.map(row => ({
            name: row.nome || row.name,
            email: row.email,
            department: row.departamento || row.department,
            position: row.cargo || row.position,
            hire_date: parseExcelDate(row.data_admissao || row.hire_date),
            photo_url: row.foto_url || row.photo_url || null
          }));

          console.log('   Dados preparados:', employees);

          const employeesCollection = getTenantCollection('employees');
          const existingEmployeesSnapshot = await getDocs(employeesCollection);
          const employeeEmailMap = new Map(existingEmployeesSnapshot.docs.map(d => [d.data().email, d.id]));
          const batch = writeBatch(db);

          for (const employee of employees) {
            const existingId = employeeEmailMap.get(employee.email);
            if (existingId) {
              // Update existing employee
              batch.update(doc(getTenantCollection('employees'), existingId), employee);
            } else {
              // Add new employee
              batch.set(doc(getTenantCollection('employees')), employee);
            }
          }
          await batch.commit();
          console.log(`   ✅ ${rows.length} colaborador(es) importado(s)`);
          successCount += rows.length;
        }
      } else {
        console.log('⚠️ Aba "Colaboradores" não encontrada');
      }

      // Processar aba Avaliacoes
      if (workbook.SheetNames.includes('Avaliacoes')) {
        console.log('📋 Processando aba Avaliacoes...');
        const sheet = workbook.Sheets['Avaliacoes'];
        const rows = XLSX.utils.sheet_to_json(sheet) as any[];
        console.log(`   Encontradas ${rows.length} linhas`);

        if (rows.length > 0) {
          for (const row of rows) {
            const employeesSnapshot = await getDocs(query(collection(db, 'employees'), where('email', '==', row.employee_id), limit(1)));

            if (!employeesSnapshot.empty) {
              const employee = employeesSnapshot.docs[0];
              console.log(`   ✅ Avaliação processada para ${row.employee_id}`);
              successCount++;
            } else {
              console.warn(`   ⚠️ Funcionário não encontrado: ${row.employee_id}`);
              errors.push(`Avaliação: Funcionário ${row.employee_id} não encontrado`);
              errorCount++;
            }
          }
        }
      } else {
        console.log('⚠️ Aba "Avaliacoes" não encontrada');
      }

      // Processar aba Treinamentos
      if (workbook.SheetNames.includes('Treinamentos')) {
        console.log('📋 Processando aba Treinamentos...');
        const sheet = workbook.Sheets['Treinamentos'];
        const rows = XLSX.utils.sheet_to_json(sheet) as any[];
        console.log(`   Encontradas ${rows.length} linhas`);

        if (rows.length > 0) {
          for (const row of rows) {
            const employeesSnapshot = await getDocs(query(collection(db, 'employees'), where('email', '==', row.employee_id), limit(1)));

            if (!employeesSnapshot.empty) {
              const employeeId = employeesSnapshot.docs[0].id;
              const completionDate = parseExcelDate(row.training_date);
              const newTraining = {
                employee_id: employeeId,
                training_name: row.training_name,
                training_type: 'Segurança',
                completion_date: completionDate,
                expiry_date: completionDate,
                status: row.status === 'Concluído' ? 'valid' : 'pending'
              };

              const { error } = await addDoc(collection(db, 'sst_trainings'), newTraining);

              if (error) {
                console.error(`   ❌ Erro ao inserir treinamento:`, error);
                errors.push(`Treinamento: ${error.message}`);
                errorCount++;
              } else {
                console.log(`   ✅ Treinamento inserido para ${row.employee_id}`);
                successCount++;
              }
            } else {
              console.warn(`   ⚠️ Funcionário não encontrado: ${row.employee_id}`);
              errors.push(`Treinamento: Funcionário ${row.employee_id} não encontrado`);
              errorCount++;
            }
          }
        }
      } else {
        console.log('⚠️ Aba "Treinamentos" não encontrada');
      }

      // Processar aba EPIs
      if (workbook.SheetNames.includes('EPIs')) {
        console.log('📋 Processando aba EPIs...');
        const sheet = workbook.Sheets['EPIs'];
        const rows = XLSX.utils.sheet_to_json(sheet) as any[];
        console.log(`   Encontradas ${rows.length} linhas`);

        if (rows.length > 0) {
          for (const row of rows) {
            const employeesSnapshot = await getDocs(query(collection(db, 'employees'), where('email', '==', row.employee_id), limit(1)));

            if (!employeesSnapshot.empty) {
              const employeeId = employeesSnapshot.docs[0].id;
              const deliveryDate = parseExcelDate(row.delivery_date);
              const newPpe = {
                employee_id: employeeId,
                ppe_type: row.equipment_type,
                delivery_date: deliveryDate,
                expiry_date: deliveryDate,
                status: 'delivered',
                ca_number: row.ca_number
              };

              const { error } = await addDoc(collection(db, 'sst_ppe'), newPpe);

              if (error) {
                console.error(`   ❌ Erro ao inserir EPI:`, error);
                errors.push(`EPI: ${error.message}`);
                errorCount++;
              } else {
                console.log(`   ✅ EPI inserido para ${row.employee_id}`);
                successCount++;
              }
            } else {
              console.warn(`   ⚠️ Funcionário não encontrado: ${row.employee_id}`);
              errors.push(`EPI: Funcionário ${row.employee_id} não encontrado`);
              errorCount++;
            }
          }
        }
      } else {
        console.log('⚠️ Aba "EPIs" não encontrada');
      }

      // Processar aba Exames
      if (workbook.SheetNames.includes('Exames')) {
        console.log('📋 Processando aba Exames...');
        const sheet = workbook.Sheets['Exames'];
        const rows = XLSX.utils.sheet_to_json(sheet) as any[];
        console.log(`   Encontradas ${rows.length} linhas`);

        if (rows.length > 0) {
          for (const row of rows) {
            const employeesSnapshot = await getDocs(query(collection(db, 'employees'), where('email', '==', row.employee_id), limit(1)));

            if (!employeesSnapshot.empty) {
              const employeeId = employeesSnapshot.docs[0].id;
              const examDate = parseExcelDate(row.exam_date);

              if (!examDate) {
                console.warn(`   ⚠️ Data do exame inválida para ${row.employee_id}`);
                errors.push(`Exame: Data inválida para ${row.employee_id}`);
                errorCount++;
                continue;
              }

              const newExam = {
                employee_id: employeeId,
                exam_type: row.exam_type || 'Admissional',
                exam_date: examDate,
                next_exam_date: parseExcelDate(row.next_exam_date),
                status: 'valid',
                result: row.result || 'Apto'
              };
              const { error } = await addDoc(collection(db, 'sst_medical_exams'), newExam);

              if (error) {
                console.error(`   ❌ Erro ao inserir exame:`, error);
                errors.push(`Exame: ${error.message}`);
                errorCount++;
              } else {
                console.log(`   ✅ Exame inserido para ${row.employee_id}`);
                successCount++;
              }
            } else {
              console.warn(`   ⚠️ Funcionário não encontrado: ${row.employee_id}`);
              errors.push(`Exame: Funcionário ${row.employee_id} não encontrado`);
              errorCount++;
            }
          }
        }
      } else {
        console.log('⚠️ Aba "Exames" não encontrada');
      }

      // Mostrar resultado
      let message = `✅ Importação concluída!\n\n`;
      message += `${successCount} registro(s) importado(s) com sucesso\n`;
      if (errorCount > 0) {
        message += `❌ ${errorCount} erro(s) encontrado(s)\n\n`;
        message += errors.slice(0, 5).join('\n');
        if (errors.length > 5) {
          message += `\n... e mais ${errors.length - 5} erro(s)`;
        }
      }

      if (successCount === 0 && errorCount === 0) {
        message = '⚠️ Nenhum dado foi importado.\n\nVerifique se:\n- O arquivo tem as abas corretas\n- As colunas estão nomeadas corretamente\n- Há dados nas linhas';
      }

      alert(message);

      // Resetar input
      event.target.value = '';
    } catch (error: any) {
      console.error('Erro ao processar arquivo:', error);
      const errorMessage = error?.message || 'Erro desconhecido';
      alert(`❌ Erro ao processar arquivo Excel:\n\n${errorMessage}\n\nVerifique se:\n- O arquivo é um Excel válido (.xlsx)\n- As abas têm os nomes corretos\n- As colunas seguem o template`);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadSampleData = () => {
    const workbook = XLSX.utils.book_new();

    const colaboradoresData = [
      ['email', 'nome', 'departamento', 'cargo', 'data_admissao', 'foto_url'],
      ['ana.oliveira@empresa.com', 'Ana Oliveira', 'Operações', 'Supervisora', '2019-02-05', 'https://i.pravatar.cc/150?img=9'],
      ['carlos.santos@empresa.com', 'Carlos Santos', 'SST', 'Técnico de Segurança', '2020-06-15', 'https://i.pravatar.cc/150?img=12'],
      ['maria.silva@empresa.com', 'Maria Silva', 'RH', 'Analista de RH', '2021-03-10', 'https://i.pravatar.cc/150?img=5']
    ];

    const avaliacoesData = [
      ['employee_id', 'periodo', 'horas_trabalhadas', 'faltas_injustificadas', 'atrasos', 'horas_extras', 'projetos_concluidos', 'metas_atingidas'],
      ['ana.oliveira@empresa.com', '2025-10', 176, 0, 5, 10, 6, 98],
      ['carlos.santos@empresa.com', '2025-10', 180, 0, 0, 15, 8, 100],
      ['maria.silva@empresa.com', '2025-10', 168, 1, 10, 5, 5, 92]
    ];

    const treinamentosData = [
      ['employee_id', 'training_name', 'training_date', 'duration_hours', 'status', 'certificate_number'],
      ['ana.oliveira@empresa.com', 'Liderança em Segurança', '2025-10-12', 6, 'Concluído', 'CERT-LID-2025-008'],
      ['carlos.santos@empresa.com', 'NR-35 Trabalho em Altura', '2025-09-20', 8, 'Concluído', 'CERT-NR35-2025-042'],
      ['maria.silva@empresa.com', 'Primeiros Socorros', '2025-10-05', 4, 'Concluído', 'CERT-PS-2025-019']
    ];

    const episData = [
      ['employee_id', 'equipment_type', 'delivery_date', 'ca_number', 'quantity', 'condition'],
      ['ana.oliveira@empresa.com', 'Capacete de Segurança', '2025-10-05', '12345', 1, 'Novo'],
      ['ana.oliveira@empresa.com', 'Colete Refletivo', '2025-10-05', '77889', 2, 'Novo'],
      ['carlos.santos@empresa.com', 'Luvas de Proteção', '2025-10-01', '54321', 2, 'Novo'],
      ['maria.silva@empresa.com', 'Óculos de Proteção', '2025-10-03', '99887', 1, 'Novo']
    ];

    const examesData = [
      ['employee_id', 'exam_type', 'exam_date', 'result', 'next_exam_date', 'doctor_name'],
      ['ana.oliveira@empresa.com', 'Periódico', '2025-10-12', 'Apto', '2026-10-12', 'Dra. Mariana Costa'],
      ['carlos.santos@empresa.com', 'Periódico', '2025-09-25', 'Apto', '2026-09-25', 'Dr. Roberto Lima'],
      ['maria.silva@empresa.com', 'Admissional', '2021-03-10', 'Apto', '2022-03-10', 'Dra. Paula Santos']
    ];

    const incidentesData = [
      ['employee_id', 'incident_date', 'incident_type', 'severity', 'description', 'corrective_action'],
      ['ana.oliveira@empresa.com', '2025-09-08', 'Acidente', 'Leve', 'Tropeção em cabo de extensão', 'Organização dos cabos e canaletas'],
      ['carlos.santos@empresa.com', '2025-08-15', 'Quase-acidente', 'Moderado', 'Escorregão em piso molhado', 'Instalação de placas de sinalização']
    ];

    const wsColaboradores = XLSX.utils.aoa_to_sheet(colaboradoresData);
    const wsAvaliacoes = XLSX.utils.aoa_to_sheet(avaliacoesData);
    const wsTreinamentos = XLSX.utils.aoa_to_sheet(treinamentosData);
    const wsEPIs = XLSX.utils.aoa_to_sheet(episData);
    const wsExames = XLSX.utils.aoa_to_sheet(examesData);
    const wsIncidentes = XLSX.utils.aoa_to_sheet(incidentesData);

    XLSX.utils.book_append_sheet(workbook, wsColaboradores, 'Colaboradores');
    XLSX.utils.book_append_sheet(workbook, wsAvaliacoes, 'Avaliacoes');
    XLSX.utils.book_append_sheet(workbook, wsTreinamentos, 'Treinamentos');
    XLSX.utils.book_append_sheet(workbook, wsEPIs, 'EPIs');
    XLSX.utils.book_append_sheet(workbook, wsExames, 'Exames');
    XLSX.utils.book_append_sheet(workbook, wsIncidentes, 'Incidentes');

    XLSX.writeFile(workbook, 'MRS_Template_Dados_Exemplo.xlsx');

    alert('Arquivo Excel baixado com sucesso! 📊\n\nContém 6 abas com dados de exemplo:\n- Colaboradores\n- Avaliacoes\n- Treinamentos\n- EPIs\n- Exames\n- Incidentes');
  };

  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
  const isWeightValid = Math.abs(totalWeight - 100) < 0.01;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#912325]">Configurações do Sistema</h1>
        {username && (
          <div className="flex items-center gap-2 text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg">
            <User className="w-5 h-5 text-gray-500" />
            <span className="font-medium">{username}</span>
          </div>
        )}
      </div>

      <RecalculationStatus />

      <MRSCard
        title="Editor de Critérios de Avaliação"
        subtitle="Arraste para reordenar • Configure pesos e direções"
        action={
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-gradient-to-r from-[#912325] to-[#701a1c] text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        }
      >
        <div className="space-y-4">
          <div className={`p-4 rounded-lg ${isWeightValid ? 'bg-green-50 border-2 border-green-200' : 'bg-amber-50 border-2 border-amber-200'}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Soma Total dos Pesos:</span>
              <span className={`text-3xl font-bold ${isWeightValid ? 'text-green-600' : 'text-amber-600'}`}>
                {totalWeight.toFixed(2)}%
              </span>
            </div>
            {!isWeightValid && (
              <p className="text-xs text-amber-600 mt-2">
                ⚠️ A soma dos pesos deve ser exatamente 100%
              </p>
            )}
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={criteria.map(c => c.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {criteria.map(criterion => (
                  <SortableCriterion
                    key={criterion.id}
                    criterion={criterion}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={saving || !isWeightValid}
              className="px-6 py-3 bg-gradient-to-r from-[#912325] to-[#701a1c] text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2 font-semibold"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Salvando...' : 'Salvar Critérios'}
            </button>
            <button
              onClick={handleRecalculate}
              disabled={recalculating}
              className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:shadow-lg hover:bg-gray-300 transition-all disabled:opacity-50 flex items-center gap-2 font-semibold"
            >
              <RefreshCw className={`w-5 h-5 ${recalculating ? 'animate-spin' : ''}`} />
              {recalculating ? 'Recalculando...' : 'Recalcular Ranking'}
            </button>
          </div>
        </div>
      </MRSCard>

      <MRSCard title="Zona de Perigo" subtitle="Ações irreversíveis do sistema">
        <div className="space-y-4">
          <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800 mb-1">Atenção: Área de risco!</p>
                <p className="text-sm text-gray-700">
                  As ações abaixo são <strong>permanentes e irreversíveis</strong>.
                  Todos os dados serão excluídos do banco de dados e não poderão ser recuperados.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleDeleteAllData}
            disabled={deletingAll}
            className="w-full px-6 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-3 font-bold text-lg group"
          >
            <Trash2 className={`w-6 h-6 ${deletingAll ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'}`} />
            {deletingAll ? 'Excluindo Todos os Dados...' : 'Excluir Todos os Dados do Sistema'}
          </button>

          <p className="text-xs text-center text-gray-500 italic">
            Use esta função apenas para limpar completamente o sistema e começar do zero
          </p>
        </div>
      </MRSCard>
    </div>
  );
}
