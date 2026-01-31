import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, HardHat, Stethoscope, BookOpen, TrendingDown, Download } from 'lucide-react';
import Card from './Card';
import StatCard from './StatCard';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

interface SSTStats {
  expiredTrainings: number;
  pendingPPE: number;
  expiredExams: number;
  incidents: number;
  complianceRate: number;
}

export default function SSTDashboard() {
  const [stats, setStats] = useState<SSTStats>({
    expiredTrainings: 0,
    pendingPPE: 0,
    expiredExams: 0,
    incidents: 0,
    complianceRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSSTData();
  }, []);

  const loadSSTData = async () => {
    setLoading(true);
    try {
      const trainingsQuery = query(collection(db, 'sst_trainings'), where('status', '==', 'expired'));
      const trainingsSnapshot = await getDocs(trainingsQuery);

      const ppeQuery = query(collection(db, 'sst_ppe'), where('status', '==', 'pending'));
      const ppeSnapshot = await getDocs(ppeQuery);

      const examsQuery = query(collection(db, 'sst_medical_exams'), where('status', '==', 'expired'));
      const examsSnapshot = await getDocs(examsQuery);

      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const incidentsQuery = query(collection(db, 'sst_incidents'), where('incident_date', '>=', ninetyDaysAgo));
      const incidentsSnapshot = await getDocs(incidentsQuery);

      const totalItems = trainingsSnapshot.size + ppeSnapshot.size + examsSnapshot.size;
      const totalPossible = 300;
      const complianceRate = ((totalPossible - totalItems) / totalPossible) * 100;

      setStats({
        expiredTrainings: trainingsSnapshot.size,
        pendingPPE: ppeSnapshot.size,
        expiredExams: examsSnapshot.size,
        incidents: incidentsSnapshot.size,
        complianceRate: Math.max(0, complianceRate),
      });
    } catch (error) {
      console.error('Erro ao carregar dados SST:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-slate-600 mt-4">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Segurança e Saúde do Trabalho</h1>
          <p className="text-slate-600 mt-1">Monitoramento de indicadores de segurança</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
          <Download className="w-4 h-4" />
          Exportar Relatório
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Treinamentos Vencidos"
          value={stats.expiredTrainings}
          icon={<BookOpen className="w-6 h-6" />}
          trend={-8.5}
          colorClass="from-amber-600 to-orange-500"
        />
        <StatCard
          title="EPIs Pendentes"
          value={stats.pendingPPE}
          icon={<HardHat className="w-6 h-6" />}
          trend={-12.3}
          colorClass="from-red-600 to-rose-500"
        />
        <StatCard
          title="Exames Vencidos"
          value={stats.expiredExams}
          icon={<Stethoscope className="w-6 h-6" />}
          trend={-5.7}
          colorClass="from-violet-600 to-purple-500"
        />
        <StatCard
          title="Acidentes (90d)"
          value={stats.incidents}
          icon={<AlertTriangle className="w-6 h-6" />}
          trend={-15.2}
          colorClass="from-rose-600 to-red-500"
        />
        <StatCard
          title="Taxa de Conformidade"
          value={`${stats.complianceRate.toFixed(1)}%`}
          icon={<Shield className="w-6 h-6" />}
          trend={3.8}
          colorClass="from-emerald-600 to-teal-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Treinamentos por Status">
          <div className="space-y-4">
            <TrainingStatusBar status="Válidos" count={156} total={200} color="bg-emerald-500" />
            <TrainingStatusBar status="A Vencer (30d)" count={32} total={200} color="bg-amber-500" />
            <TrainingStatusBar status="Vencidos" count={12} total={200} color="bg-red-500" />
          </div>
        </Card>

        <Card title="EPIs por Tipo">
          <div className="space-y-4">
            <PPEBar type="Capacete" delivered={95} total={100} />
            <PPEBar type="Luvas" delivered={88} total={100} />
            <PPEBar type="Óculos de Proteção" delivered={92} total={100} />
            <PPEBar type="Calçado de Segurança" delivered={97} total={100} />
          </div>
        </Card>
      </div>

      <Card title="Histórico de Incidentes (Últimos 6 Meses)">
        <div className="space-y-4">
          <IncidentMonthBar month="Outubro" incidents={2} severity="low" />
          <IncidentMonthBar month="Setembro" incidents={3} severity="low" />
          <IncidentMonthBar month="Agosto" incidents={1} severity="low" />
          <IncidentMonthBar month="Julho" incidents={4} severity="medium" />
          <IncidentMonthBar month="Junho" incidents={2} severity="low" />
          <IncidentMonthBar month="Maio" incidents={5} severity="medium" />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Exames Médicos">
          <div className="space-y-3">
            <ExamItem type="Admissional" count={8} status="scheduled" />
            <ExamItem type="Periódico" count={45} status="valid" />
            <ExamItem type="Retorno ao Trabalho" count={3} status="scheduled" />
            <ExamItem type="Demissional" count={2} status="scheduled" />
          </div>
        </Card>

        <Card title="Alertas de Segurança">
          <div className="space-y-3">
            <AlertItem
              severity="high"
              message="12 treinamentos vencidos requerem atenção imediata"
            />
            <AlertItem
              severity="medium"
              message="8 exames médicos vencem nos próximos 15 dias"
            />
            <AlertItem
              severity="low"
              message="Atualizar estoque de EPIs do setor operacional"
            />
          </div>
        </Card>

        <Card title="Próximas Ações">
          <div className="space-y-3">
            <ActionItem
              date="20 Out"
              action="Treinamento NR-35 - Turma A"
              participants={15}
            />
            <ActionItem
              date="25 Out"
              action="CIPA - Reunião Mensal"
              participants={8}
            />
            <ActionItem
              date="30 Out"
              action="Inspeção de Segurança - Área 3"
              participants={4}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function TrainingStatusBar({ status, count, total, color }: { status: string; count: number; total: number; color: string }) {
  const percentage = (count / total) * 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700">{status}</span>
        <span className="text-sm text-slate-600">{count} de {total}</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function PPEBar({ type, delivered, total }: { type: string; delivered: number; total: number }) {
  const percentage = (delivered / total) * 100;
  const color = percentage >= 90 ? 'bg-emerald-500' : percentage >= 70 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700">{type}</span>
        <span className="text-sm text-slate-600">{delivered}/{total}</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function IncidentMonthBar({ month, incidents, severity }: { month: string; incidents: number; severity: 'low' | 'medium' | 'high' }) {
  const maxIncidents = 10;
  const percentage = (incidents / maxIncidents) * 100;
  const color = severity === 'high' ? 'bg-red-500' : severity === 'medium' ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700">{month}</span>
        <span className="text-sm text-slate-600">{incidents} incidente(s)</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${Math.max(percentage, 5)}%` }}
        />
      </div>
    </div>
  );
}

function ExamItem({ type, count, status }: { type: string; count: number; status: 'valid' | 'expired' | 'scheduled' }) {
  const statusColors = {
    valid: 'bg-emerald-100 text-emerald-700',
    expired: 'bg-red-100 text-red-700',
    scheduled: 'bg-blue-100 text-blue-700',
  };

  const statusLabels = {
    valid: 'Válidos',
    expired: 'Vencidos',
    scheduled: 'Agendados',
  };

  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
      <span className="text-sm font-medium text-slate-700">{type}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-slate-900">{count}</span>
        <span className={`text-xs px-2 py-1 rounded-full ${statusColors[status]}`}>
          {statusLabels[status]}
        </span>
      </div>
    </div>
  );
}

function AlertItem({ severity, message }: { severity: 'high' | 'medium' | 'low'; message: string }) {
  const severityColors = {
    high: 'bg-red-100 border-red-200 text-red-700',
    medium: 'bg-amber-100 border-amber-200 text-amber-700',
    low: 'bg-blue-100 border-blue-200 text-blue-700',
  };

  const icons = {
    high: <AlertTriangle className="w-4 h-4" />,
    medium: <AlertTriangle className="w-4 h-4" />,
    low: <Shield className="w-4 h-4" />,
  };

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${severityColors[severity]}`}>
      {icons[severity]}
      <p className="text-xs font-medium flex-1">{message}</p>
    </div>
  );
}

function ActionItem({ date, action, participants }: { date: string; action: string; participants: number }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
      <div className="w-12 h-12 bg-blue-100 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
        <span className="text-xs font-medium text-blue-600">{date.split(' ')[0]}</span>
        <span className="text-xs text-blue-500">{date.split(' ')[1]}</span>
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-900">{action}</p>
        <p className="text-xs text-slate-500 mt-1">{participants} participantes</p>
      </div>
    </div>
  );
}
