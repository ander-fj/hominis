import { useState, useEffect } from 'react';
import { Target, Save, X, Edit2, Download } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface Goal {
  id: string;
  goal_type: string;
  goal_value: number;
  description: string;
  is_minimum: boolean;
}

interface GoalsEditorProps {
  onClose: () => void;
  onUpdate: () => void;
}

export default function GoalsEditor({ onClose, onUpdate }: GoalsEditorProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    setLoading(true);
    try {
      const goalsQuery = query(collection(db, 'sst_goals'), orderBy('goal_type'));
      const querySnapshot = await getDocs(goalsQuery);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Goal[];
      setGoals(data || []);
    } catch (error) {
      console.error('Erro ao carregar metas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal.id);
    setEditValue(goal.goal_value);
  };

  const handleSave = async (goalId: string) => {
    setSaving(true);
    try {
      const goalRef = doc(db, 'sst_goals', goalId);
      await updateDoc(goalRef, {
        goal_value: editValue,
        updated_at: new Date().toISOString()
      });

      await loadGoals();
      setEditingGoal(null);
      onUpdate();
    } catch (error) {
      console.error('Erro ao salvar meta:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingGoal(null);
    setEditValue(0);
  };

  const handleExportPDF = async () => {
    try {
      const element = document.body;
      const originalScrollPos = window.scrollY;

      window.scrollTo(0, 0);

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        scrollY: -window.scrollY,
        scrollX: -window.scrollX,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      });

      window.scrollTo(0, originalScrollPos);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }

      pdf.save('Metas-SST.pdf');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Tente novamente.');
    }
  };

  const getGoalLabel = (type: string) => {
    const labels: Record<string, string> = {
      'conformidade': 'Taxa de Conformidade',
      'incidentes': 'Incidentes por Mês',
      'treinamentos': 'Taxa de Conclusão de Treinamentos',
      'epis': 'EPIs em Boas Condições'
    };
    return labels[type] || type;
  };

  const getGoalIcon = (type: string) => {
    const colors: Record<string, string> = {
      'conformidade': 'text-emerald-600',
      'incidentes': 'text-red-600',
      'treinamentos': 'text-amber-600',
      'epis': 'text-rose-600'
    };
    return colors[type] || 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4">
          <div className="text-center text-gray-600">Carregando metas...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Target className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Editar Metas</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-gradient-to-r from-[#912325] to-[#701a1c] text-white rounded-lg hover:shadow-lg transition-all duration-200 flex items-center gap-2"
              title="Exportar PDF"
            >
              <Download className="w-4 h-4" />
              Exportar PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {goals.map((goal) => (
            <div
              key={goal.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Target className={`w-5 h-5 ${getGoalIcon(goal.goal_type)}`} />
                    <h3 className="font-semibold text-gray-900">
                      {getGoalLabel(goal.goal_type)}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{goal.description}</p>

                  {editingGoal === goal.id ? (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">
                          {goal.is_minimum ? 'Mínimo:' : 'Máximo:'}
                        </span>
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(parseFloat(e.target.value))}
                          className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          step="0.1"
                          min="0"
                          max={goal.goal_type === 'incidentes' ? '100' : '100'}
                        />
                        <span className="text-sm text-gray-600">
                          {goal.goal_type === 'incidentes' ? 'incidentes' : '%'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSave(goal.id)}
                          disabled={saving}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          <Save className="w-4 h-4" />
                          <span className="text-sm">Salvar</span>
                        </button>
                        <button
                          onClick={handleCancel}
                          disabled={saving}
                          className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors"
                        >
                          <X className="w-4 h-4" />
                          <span className="text-sm">Cancelar</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">
                          {goal.is_minimum ? 'Meta mínima:' : 'Meta máxima:'}
                        </span>
                        <span className="text-lg font-bold text-blue-600">
                          {goal.goal_value}{goal.goal_type === 'incidentes' ? '' : '%'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleEdit(goal)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span className="text-sm">Editar</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Dica:</strong> As metas são utilizadas nos gráficos de evolução para indicar se os valores estão acima ou abaixo do esperado.
          </p>
        </div>
      </div>
    </div>
  );
}
