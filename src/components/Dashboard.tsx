import { useState, useEffect } from 'react';
import { Users, UserX, Clock, Calendar, TrendingUp, ChevronDown, ChevronUp, Briefcase } from 'lucide-react';
import Card from './Card';
import StatCard from './StatCard';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserMetricsModal } from './UserMetricsModal';

interface DashboardStats {
  totalEmployees: number;
  absences: number;
  delays: number;
  averageHours: number;
  activeEmployees: number;
  departmentCount: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    absences: 0,
    delays: 0,
    averageHours: 0,
    activeEmployees: 0,
    departmentCount: 0,
  });
  const [rhExpanded, setRhExpanded] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isMetricsModalOpen, setIsMetricsModalOpen] = useState(false);
  const [employeesData, setEmployeesData] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);

  useEffect(() => {
    setLoading(true);

    // Listener para Colaboradores
    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snapshot) => {
      setEmployeesData(snapshot.docs.map(doc => doc.data()));
    });

    // Listener para Presença (Últimos 30 dias)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const attendanceQuery = query(
      collection(db, 'attendance_records'),
      where('date', '>=', thirtyDaysAgo)
    );
    const unsubAttendance = onSnapshot(attendanceQuery, (snapshot) => {
      setAttendanceData(snapshot.docs.map(doc => doc.data()));
    });

    return () => {
      unsubEmployees();
      unsubAttendance();
    };
  }, []);

  useEffect(() => {
    if (employeesData.length > 0 || attendanceData.length > 0) {
      const totalEmployees = employeesData.length;
      const activeEmployees = employeesData.filter((e: any) => e.active).length;
      const departments = new Set(employeesData.map((e: any) => e.department));

      const absences = attendanceData.filter((a: any) => a.status === 'absent').length;
      const delays = attendanceData.filter((a: any) => a.status === 'late').length;
      const totalHours = attendanceData.reduce((sum: number, a: any) => sum + (a.hours_worked || 0), 0);
      const averageHours = attendanceData.length > 0 ? totalHours / attendanceData.length : 0;
      
      setStats({
        totalEmployees,
        absences,
        delays,
        averageHours,
        activeEmployees,
        departmentCount: departments.size,
      });
      setLoading(false);
    }
  }, [employeesData, attendanceData]);

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
      <div>
        <button
          onClick={() => setIsMetricsModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          Ver Métricas Funcionário
        </button>
      </div>

      <div>
        <button
          onClick={() => setRhExpanded(!rhExpanded)}
          className="w-full flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-semibold text-slate-900">Indicadores de RH</h2>
              <p className="text-sm text-slate-500">Gestão de pessoas e desempenho</p>
            </div>
          </div>
          {rhExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {rhExpanded && (
          <div className="mt-4 space-y-4 animate-in slide-in-from-top duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Colaboradores Ativos"
                value={stats.activeEmployees}
                icon={<Users className="w-6 h-6" />}
                trend={2.5}
                colorClass="from-blue-600 to-cyan-500"
              />
              <StatCard
                title="Faltas (30 dias)"
                value={stats.absences}
                icon={<UserX className="w-6 h-6" />}
                trend={-5.2}
                colorClass="from-red-600 to-rose-500"
              />
              <StatCard
                title="Atrasos (30 dias)"
                value={stats.delays}
                icon={<Clock className="w-6 h-6" />}
                trend={-3.1}
                colorClass="from-amber-600 to-orange-500"
              />
              <StatCard
                title="Horas Médias/Dia"
                value={stats.averageHours.toFixed(1)}
                icon={<Calendar className="w-6 h-6" />}
                trend={1.2}
                colorClass="from-emerald-600 to-teal-500"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card title="Distribuição por Departamento">
                <div className="space-y-3">
                  <DepartmentBar department="Operacional" count={45} total={stats.totalEmployees} color="bg-blue-500" />
                  <DepartmentBar department="Administrativo" count={28} total={stats.totalEmployees} color="bg-cyan-500" />
                  <DepartmentBar department="Comercial" count={18} total={stats.totalEmployees} color="bg-emerald-500" />
                  <DepartmentBar department="TI" count={12} total={stats.totalEmployees} color="bg-violet-500" />
                </div>
              </Card>

              <Card title="Resumo do Mês">
                <div className="space-y-4">
                  <SummaryItem
                    icon={<Users className="w-5 h-5 text-blue-600" />}
                    label="Total de Colaboradores"
                    value={stats.totalEmployees.toString()}
                  />
                  <SummaryItem
                    icon={<Briefcase className="w-5 h-5 text-cyan-600" />}
                    label="Departamentos"
                    value={stats.departmentCount.toString()}
                  />
                  <SummaryItem
                    icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
                    label="Taxa de Presença"
                    value="94.8%"
                  />
                  <SummaryItem
                    icon={<Calendar className="w-5 h-5 text-amber-600" />}
                    label="Média de Horas"
                    value={`${stats.averageHours.toFixed(1)}h`}
                  />
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>

      <UserMetricsModal 
        isOpen={isMetricsModalOpen} 
        onClose={() => setIsMetricsModalOpen(false)} 
      />
    </div>
  );
}

function DepartmentBar({ department, count, total, color }: { department: string; count: number; total: number; color: string }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700">{department}</span>
        <span className="text-sm text-slate-600">{count} colaboradores</span>
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

function SummaryItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
          {icon}
        </div>
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      <span className="text-lg font-bold text-slate-900">{value}</span>
    </div>
  );
}
