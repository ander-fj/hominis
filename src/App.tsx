import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Shield,
  TrendingUp,
  Settings,
  BarChart3,
  Trophy,
  Menu,
  X,
  Table,
  Upload
} from 'lucide-react';
import DashboardRH from './components/MRS/DashboardRH';
import DashboardSST from './components/MRS/DashboardSST';
import RankingInteligente from './components/MRS/RankingInteligente';
import Colaboradores from './components/MRS/Colaboradores';
import AnaliseIntegrada from './components/MRS/AnaliseIntegrada';
import Previsoes from './components/MRS/Previsoes';
import Configuracoes from './components/MRS/Configuracoes';
import TabelaDetalhada from './components/MRS/TabelaDetalhada';
import ImportacaoIndividual from './components/MRS/ImportacaoIndividual';
import Login from './components/MRS/Login';

type View = 'dashboard-rh' | 'colaboradores' | 'tabela-detalhada' | 'ranking' | 'dashboard-sst' | 'analise' | 'previsoes' | 'configuracoes' | 'importacao';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState<View>('dashboard-rh');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string>('/Secontaf1.png');
  const [appTitle, setAppTitle] = useState<string>('Gestão RH & SST');
  const [appSubtitle, setAppSubtitle] = useState<string>('Sistema Integrado');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingSubtitle, setIsEditingSubtitle] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Verificar se o usuário está autenticado
    const authStatus = localStorage.getItem('isAuthenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }

    const savedLogo = localStorage.getItem('customLogo');
    if (savedLogo) {
      setLogoUrl(savedLogo);
    }
    const savedTitle = localStorage.getItem('appTitle');
    if (savedTitle) {
      setAppTitle(savedTitle);
    }
    const savedSubtitle = localStorage.getItem('appSubtitle');
    if (savedSubtitle) {
      setAppSubtitle(savedSubtitle);
    }
  }, []);

  const navigation = [
    { id: 'dashboard-rh' as View, label: 'Dashboard RH', icon: LayoutDashboard },
    { id: 'colaboradores' as View, label: 'Colaboradores', icon: Users },
    { id: 'tabela-detalhada' as View, label: 'Tabela Detalhada', icon: Table },
    { id: 'ranking' as View, label: 'Ranking Inteligente', icon: Trophy },
    { id: 'dashboard-sst' as View, label: 'Dashboard SST', icon: Shield },
    { id: 'analise' as View, label: 'Análise Integrada', icon: BarChart3 },
    { id: 'previsoes' as View, label: 'Previsões', icon: TrendingUp },
    { id: 'importacao' as View, label: 'Importação Individual', icon: Upload },
    { id: 'configuracoes' as View, label: 'Configurações', icon: Settings },
  ];

  const renderView = () => {
    switch (currentView) {
      case 'dashboard-rh':
        return <DashboardRH />;
      case 'colaboradores':
        return <Colaboradores />;
      case 'tabela-detalhada':
        return <TabelaDetalhada />;
      case 'ranking':
        return <RankingInteligente />;
      case 'dashboard-sst':
        return <DashboardSST />;
      case 'analise':
        return <AnaliseIntegrada />;
      case 'previsoes':
        return <Previsoes />;
      case 'importacao':
        return <ImportacaoIndividual />;
      case 'configuracoes':
        return <Configuracoes />;
      default:
        return <DashboardRH />;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('username');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex">
        <AnimatePresence mode="wait">
          {sidebarOpen && (
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-72 min-h-screen bg-[#912325] text-white shadow-2xl fixed z-50 flex flex-col"
            >
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex flex-col items-center gap-3 flex-1">
                    <div className="relative w-52 h-32 flex items-center justify-center group">
                      <img
                        src={logoUrl}
                        alt="MRS Logo"
                        className="w-full h-full object-contain"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg"
                        title="Alterar logo"
                      >
                        <Upload className="w-6 h-6 text-white" />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              if (event.target?.result) {
                                setLogoUrl(event.target.result as string);
                                localStorage.setItem('customLogo', event.target.result as string);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </div>
                    <div className="text-center">
                      {isEditingTitle ? (
                        <input
                          type="text"
                          value={appTitle}
                          onChange={(e) => setAppTitle(e.target.value)}
                          onBlur={() => {
                            setIsEditingTitle(false);
                            localStorage.setItem('appTitle', appTitle);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setIsEditingTitle(false);
                              localStorage.setItem('appTitle', appTitle);
                            }
                          }}
                          autoFocus
                          className="text-xl font-bold text-white bg-white/10 px-2 py-1 rounded border-2 border-[#ffcc00] outline-none"
                        />
                      ) : (
                        <h1
                          className="text-xl font-bold text-white cursor-pointer hover:text-[#ffcc00] transition-colors"
                          onClick={() => setIsEditingTitle(true)}
                          title="Clique para editar"
                        >
                          {appTitle}
                        </h1>
                      )}
                      {isEditingSubtitle ? (
                        <input
                          type="text"
                          value={appSubtitle}
                          onChange={(e) => setAppSubtitle(e.target.value)}
                          onBlur={() => {
                            setIsEditingSubtitle(false);
                            localStorage.setItem('appSubtitle', appSubtitle);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setIsEditingSubtitle(false);
                              localStorage.setItem('appSubtitle', appSubtitle);
                            }
                          }}
                          autoFocus
                          className="text-xs text-[#ffcc00] bg-white/10 px-2 py-1 rounded border-2 border-[#ffcc00] outline-none mt-1"
                        />
                      ) : (
                        <p
                          className="text-xs text-[#ffcc00] cursor-pointer hover:text-yellow-300 transition-colors"
                          onClick={() => setIsEditingSubtitle(true)}
                          title="Clique para editar"
                        >
                          {appSubtitle}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="space-y-2">
                  {navigation.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentView === item.id;
                    return (
                      <motion.button
                        key={item.id}
                        onClick={() => {
                          setCurrentView(item.id);
                          if (window.innerWidth < 1024) setSidebarOpen(false);
                        }}
                        whileHover={{ scale: 1.02, x: 5 }}
                        whileTap={{ scale: 0.98 }}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${
                          isActive
                            ? `bg-white/10 shadow-lg`
                            : 'text-gray-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                        <span className="font-medium text-sm">{item.label}</span>
                      </motion.button>
                    );
                  })}
                </nav>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'lg:ml-72' : 'ml-0'}`}>
          <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Menu className="w-6 h-6 text-gray-600" />
                </button>
                <div>
                  <h2 className="text-xl font-bold text-[#912325]">
                    {navigation.find(n => n.id === currentView)?.label}
                  </h2>
                  <p className="text-sm text-gray-500">Sistema de Gestão Integrada</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-[#912325] text-white rounded-lg shadow-md">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Sistema Ativo</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
                  title="Sair do sistema"
                >
                  Sair
                </button>
              </div>
            </div>
          </header>

          <div className="p-6 max-w-[1920px] mx-auto">
            <div key={currentView} className="animate-fade-in">
              {renderView()}
            </div>
          </div>

          <footer className="bg-white border-t border-gray-200 mt-12">
            <div className="px-6 py-4">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-sm text-gray-600">
                  © 2025 Secontaf. Todos os direitos reservados.
                </p>
                <p className="text-sm text-gray-500">
                  contato@secontaf.com.br
                </p>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default App;
