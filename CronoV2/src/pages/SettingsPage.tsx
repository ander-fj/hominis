import { Card } from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';
import { Settings, Bell, Shield, Database, Smartphone, FileText, Sun, Moon } from 'lucide-react';

export function SettingsPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="page-container">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Configurações</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Configurações do sistema</p>
      </div>

      <div className="content-grid">
        <Card className="content-card">
          <div className="mb-3 flex items-center gap-2">
            {theme === 'dark' ? <Moon size={18} className="text-amber-400" /> : <Sun size={18} className="text-amber-500" />}
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Aparência</h3>
          </div>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Alterne entre tema claro e escuro. A escolha fica salva para os próximos acessos.
          </p>
          <button
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
          </button>
        </Card>

        <Card className="content-card">
          <div className="mb-3 flex items-center gap-2">
            <Bell size={18} className="text-slate-400 dark:text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Notificações</h3>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Sistema de notificações disponível na Fase 7.</p>
        </Card>

        <Card className="content-card">
          <div className="mb-3 flex items-center gap-2">
            <Shield size={18} className="text-slate-400 dark:text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Segurança e Permissões</h3>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Controle de acesso baseado em perfis: Administrador, Gestor, Técnico e Financeiro.</p>
        </Card>

        <Card className="content-card">
          <div className="mb-3 flex items-center gap-2">
            <Database size={18} className="text-slate-400 dark:text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Banco de Dados</h3>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Sistema conectado ao Supabase. Dados sincronizados em tempo real.</p>
        </Card>

        <Card className="content-card">
          <div className="mb-3 flex items-center gap-2">
            <Smartphone size={18} className="text-slate-400 dark:text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">PWA - App Instalável</h3>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">O sistema pode ser instalado como aplicativo no celular e computador.</p>
        </Card>

        <Card className="content-card">
          <div className="mb-3 flex items-center gap-2">
            <FileText size={18} className="text-slate-400 dark:text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Relatórios</h3>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Módulo de relatórios e exportação disponível na Fase 7.</p>
        </Card>

        <Card className="content-card">
          <div className="mb-3 flex items-center gap-2">
            <Settings size={18} className="text-slate-400 dark:text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Regras do Sistema</h3>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Configuração de limites de despesas, regras de aprovação e obrigatoriedade de evidências disponível nas próximas fases.</p>
        </Card>
      </div>
    </div>
  );
}
