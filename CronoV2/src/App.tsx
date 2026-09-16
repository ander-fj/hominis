import { Suspense, useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { MaintenanceProvider } from '@/context/MaintenanceContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { OfflineProvider } from '@/context/OfflineContext';
import { Layout, type PageKey } from '@/components/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { Spinner } from '@/components/ui';
import { PageLoading } from '@/components/feedback/PageLoading';
import { lazyNamed } from '@/shared/utils/lazyNamed';
import { canAccessPage } from '@/shared/security/permissions';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';

const DashboardPage = lazyNamed(() => import('@/pages/DashboardPage'), 'DashboardPage');
const ProjectsPage = lazyNamed(() => import('@/pages/ProjectsPage'), 'ProjectsPage');
const WorkOrdersPage = lazyNamed(() => import('@/pages/WorkOrdersPage'), 'WorkOrdersPage');
const ActivitiesPage = lazyNamed(() => import('@/pages/ActivitiesPage'), 'ActivitiesPage');
const MyActivityPage = lazyNamed(() => import('@/pages/MyActivityPage'), 'MyActivityPage');
const ClientsPage = lazyNamed(() => import('@/pages/ClientsPage'), 'ClientsPage');
const TeamsPage = lazyNamed(() => import('@/pages/TeamsPage'), 'TeamsPage');
const VehiclesPage = lazyNamed(() => import('@/pages/VehiclesPage'), 'VehiclesPage');
const UsersPage = lazyNamed(() => import('@/pages/UsersPage'), 'UsersPage');
const ManagementPage = lazyNamed(() => import('@/pages/ManagementPage'), 'ManagementPage');
const SettingsPage = lazyNamed(() => import('@/pages/SettingsPage'), 'SettingsPage');
const ExpensesPage = lazyNamed(() => import('@/pages/ExpensesPage'), 'ExpensesPage');
const SchedulePage = lazyNamed(() => import('@/pages/SchedulePage'), 'SchedulePage');
const ReportsPage = lazyNamed(() => import('@/pages/ReportsPage'), 'ReportsPage');
const NotificationsPage = lazyNamed(() => import('@/pages/NotificationsPage'), 'NotificationsPage');
const NotificationPreferencesPage = lazyNamed(() => import('@/pages/NotificationPreferencesPage'), 'NotificationPreferencesPage');
const AutomationPage = lazyNamed(() => import('@/pages/AutomationPage'), 'AutomationPage');
const OperationalIntelligencePage = lazyNamed(() => import('@/pages/OperationalIntelligencePage'), 'OperationalIntelligencePage');
const QualityPage = lazyNamed(() => import('@/pages/QualityPage'), 'QualityPage');

function AppContent() {
  const { session, profile, loading } = useAuth();
  const [page, setPage] = useState<PageKey>('dashboard');
  const [activityDetailId, setActivityDetailId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Spinner />
      </div>
    );
  }

  if (!session) return <LoginPage />;

  const currentRole = profile?.role;
  const safePage = canAccessPage(currentRole, page) ? page : 'dashboard';

  const openActivity = (id: string) => {
    setActivityDetailId(id);
  };

  const closeActivity = () => {
    setActivityDetailId(null);
  };

  const pages: Record<PageKey, React.ReactNode> = {
    dashboard: <DashboardPage onOpenActivity={openActivity} />,
    expenses: <ExpensesPage />,
    reports: <ReportsPage />,
    notifications: <NotificationsPage />,
    'notification-preferences': <NotificationPreferencesPage />,
    automation: <AutomationPage />,
    intelligence: <OperationalIntelligencePage />,
    quality: <QualityPage />,
    management: <ManagementPage onOpenActivity={openActivity} onNavigate={setPage} />,
    projects: <ProjectsPage />,
    'work-orders': <WorkOrdersPage />,
    activities: <ActivitiesPage onOpenActivity={openActivity} />,
    schedule: <SchedulePage />,
    clients: <ClientsPage />,
    teams: <TeamsPage />,
    vehicles: <VehiclesPage />,
    users: <UsersPage />,
    settings: <SettingsPage />,
  };

  if (activityDetailId) {
    return (
      <Layout current="activities" onNavigate={(p) => { setActivityDetailId(null); setPage(p); }}>
        <Suspense fallback={<PageLoading label="Carregando atividade..." />}><MyActivityPage activityId={activityDetailId} onBack={closeActivity} /></Suspense>
      </Layout>
    );
  }

  return (
    <Layout current={safePage} onNavigate={(next) => { if (canAccessPage(currentRole, next)) setPage(next); }}>
      <Suspense fallback={<PageLoading />}>{pages[safePage]}</Suspense>
    </Layout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <OfflineProvider>
      <AuthProvider>
        <MaintenanceProvider>
          <AppContent />
          <OnboardingModal />
        </MaintenanceProvider>
      </AuthProvider>
      </OfflineProvider>
    </ThemeProvider>
  );
}
