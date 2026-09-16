import { ReactNode, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { canAccessPage } from '@/shared/security/permissions';
import { useMaintenance } from '@/context/MaintenanceContext';
import { useTheme } from '@/context/ThemeContext';
import { ROLE_LABELS } from '@/types';
import { initials } from '@/lib/utils';
import { OfflineStatus } from '@/components/OfflineStatus';
import {
  LayoutDashboard,
  HardHat,
  ClipboardList,
  Activity,
  CalendarDays,
  Users,
  Truck,
  Building2,
  Settings,
  LogOut,
  Menu,
  X,
  AlertTriangle,
  BarChart3,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  Wallet,
  FileBarChart,
  Bell,
  Bot,
  BrainCircuit,
  ShieldCheck,
} from 'lucide-react';

export type PageKey =
  | 'dashboard'
  | 'management'
  | 'expenses'
  | 'reports'
  | 'notifications' | 'notification-preferences'
  | 'automation'
  | 'intelligence'
  | 'quality'
  | 'projects'
  | 'work-orders'
  | 'activities'
  | 'schedule'
  | 'clients'
  | 'teams'
  | 'vehicles'
  | 'users'
  | 'settings';

interface NavItem {
  key: PageKey;
  label: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Início', icon: <LayoutDashboard size={20} /> },
  { key: 'management', label: 'Gestão', icon: <BarChart3 size={20} /> },
  { key: 'expenses', label: 'Despesas', icon: <Wallet size={20} /> },
  { key: 'reports', label: 'Relatórios', icon: <FileBarChart size={20} /> },
  { key: 'notifications', label: 'Notificações', icon: <Bell size={20} /> },
  { key: 'notification-preferences', label: 'Canais', icon: <Bell size={20} /> },
  { key: 'automation', label: 'Automação', icon: <Bot size={20} /> },
  { key: 'intelligence', label: 'Inteligência', icon: <BrainCircuit size={20} /> },
  { key: 'quality', label: 'Qualidade', icon: <ShieldCheck size={20} /> },
  { key: 'activities', label: 'Atividades', icon: <Activity size={20} /> },
  { key: 'schedule', label: 'Agenda', icon: <CalendarDays size={20} /> },
  { key: 'work-orders', label: 'Ordens de Serviço', icon: <ClipboardList size={20} /> },
  { key: 'projects', label: 'Obras', icon: <HardHat size={20} /> },
  { key: 'clients', label: 'Clientes', icon: <Building2 size={20} /> },
  { key: 'teams', label: 'Equipes', icon: <Users size={20} /> },
  { key: 'vehicles', label: 'Veículos', icon: <Truck size={20} /> },
  { key: 'users', label: 'Usuários', icon: <Users size={20} /> },
  { key: 'settings', label: 'Configurações', icon: <Settings size={20} /> },
];

const MOBILE_NAV: PageKey[] = ['dashboard', 'expenses', 'activities', 'work-orders'];

export function Layout({
  current,
  onNavigate,
  children,
}: {
  current: PageKey;
  onNavigate: (page: PageKey) => void;
  children: ReactNode;
}) {
  const { profile, signOut } = useAuth();
  const allowedNavItems = NAV_ITEMS.filter((item) => canAccessPage(profile?.role, item.key));
  const { alertCount: maintenanceAlertCount } = useMaintenance();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm">
      <div className="fixed right-4 top-3 z-50 hidden lg:block"><OfflineStatus /></div>
      {/* Desktop Sidebar */}
      <aside className={`sticky top-0 z-30 hidden h-[calc(100vh-4px)] overflow-y-auto shrink-0 flex-col border-r border-slate-200 bg-white/95 backdrop-blur-sm transition-[width] duration-300 dark:border-slate-800 dark:bg-slate-900/95 lg:flex ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} px-3 py-5`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
            <HardHat size={22} />
          </div>
          {!sidebarCollapsed && (
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">FieldControl</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Controle de campo</p>
            </div>
          )}
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {allowedNavItems.map((item) => (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                current === item.key
                  ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-amber-950'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <span className="shrink-0">{item.icon}</span>
              {!sidebarCollapsed && <span className="flex-1 text-left">{item.label}</span>}
              {item.key === 'vehicles' && maintenanceAlertCount > 0 && (
                <>
                  {sidebarCollapsed ? (
                    /* Badge compacto sobre o ícone quando o menu está recolhido */
                    <span
                      className={`absolute top-1.5 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none ${current === item.key ? 'bg-amber-300 text-amber-950' : 'bg-rose-500 text-white'}`}
                      title={`${maintenanceAlertCount} alerta(s) de manutenção`}
                    >
                      {maintenanceAlertCount > 99 ? '99+' : maintenanceAlertCount}
                    </span>
                  ) : (
                    <span className={`inline-flex min-w-5 items-center justify-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${current === item.key ? 'bg-amber-400 text-amber-950' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'}`} title={`${maintenanceAlertCount} alerta(s) de manutenção`}>
                      <AlertTriangle size={11} />
                      {maintenanceAlertCount}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3 dark:border-slate-800">
          {/* Usuário e alternância de tema agora ficam apenas no cabeçalho superior */}
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            className={`mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 ${sidebarCollapsed ? 'justify-center' : ''}`}
            title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            {!sidebarCollapsed && <span className="flex-1 text-left">Recolher menu</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white">
            <HardHat size={18} />
          </div>
          <span className="text-sm font-bold text-slate-900 dark:text-white">FieldControl</span>
        </div>
        <div className="flex items-center gap-1">
          <OfflineStatus />
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white"
            title={profile?.name ?? 'Abrir menu'}
          >
            {profile ? initials(profile.name) : '?'}
          </button>
          <button onClick={toggleTheme} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button onClick={() => setMobileMenuOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            <Menu size={22} />
          </button>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 bg-white shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                  {profile ? initials(profile.name) : '?'}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{profile?.name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{profile ? ROLE_LABELS[profile.role] : ''}</p>
                </div>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={20} />
              </button>
            </div>
            <nav className="space-y-1 px-3 py-2">
              {allowedNavItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => { onNavigate(item.key); setMobileMenuOpen(false); }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    current === item.key ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-amber-950' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {item.icon}
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.key === 'vehicles' && maintenanceAlertCount > 0 && (
                    <span className="inline-flex min-w-5 items-center justify-center gap-1 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" title={`${maintenanceAlertCount} alerta(s) de manutenção`}>
                      <AlertTriangle size={11} />
                      {maintenanceAlertCount}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            <div className="absolute bottom-0 left-0 right-0 border-t border-slate-100 p-3 dark:border-slate-800">
              <button
                onClick={toggleTheme}
                className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
              </button>
              <button
                onClick={signOut}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
              >
                <LogOut size={20} />
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 hidden items-center justify-end gap-3 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:flex">
          <button
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          </button>
          <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
              {profile ? initials(profile.name) : '?'}
            </div>
            <div className="leading-tight">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{profile?.name ?? 'Usuário'}</p>
              <p className="truncate text-xs text-slate-400 dark:text-slate-500">{profile ? ROLE_LABELS[profile.role] : ''}</p>
            </div>
            <button onClick={signOut} className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-700 dark:hover:text-rose-400" title="Sair" aria-label="Sair">
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <main className="w-full min-w-0 max-w-none flex-1 pb-20 lg:pb-8 bg-white dark:bg-slate-950">
          {/* Container fluido: acompanha a largura disponível, inclusive quando o menu lateral está recolhido */}
          <div className="w-full px-4 py-6 lg:px-8 lg:py-8 bg-white dark:bg-slate-950">
            <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-slate-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-slate-200 lg:hidden">Use o menu inferior para as ações rápidas ou abra <strong>Menu</strong> para acessar todos os módulos.</div>
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:hidden">
        {MOBILE_NAV.filter((key) => canAccessPage(profile?.role, key)).map((key) => {
          const item = NAV_ITEMS.find((n) => n.key === key)!;
          return (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                current === key ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium text-slate-400 dark:text-slate-500"
        >
          <Menu size={20} />
          Menu
        </button>
      </nav>
    </div>
  );
}
