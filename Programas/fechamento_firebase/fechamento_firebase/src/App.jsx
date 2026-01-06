import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PerfilUsuario from './pages/PerfilUsuario.jsx';
import GerenciarUsuarios from './pages/GerenciarUsuarios.jsx';
import Fluxograma from './pages/Fluxograma.jsx';
import Etapas from './pages/Etapas.jsx';
import Relatorios from './pages/Relatorios.jsx';

// Componente para capturar erros e mostrar na tela em vez de tela branca
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Erro capturado pelo Boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-50 text-red-800 font-mono">
          <h1 className="text-2xl font-bold mb-4">Algo deu errado (Tela Branca)</h1>
          <p className="mb-2">O erro abaixo impediu o carregamento da página:</p>
          <pre className="bg-white p-4 rounded border border-red-200 overflow-auto">
            {this.state.error && this.state.error.toString()}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const App = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/perfil" replace />} />
          <Route path="/perfil" element={<PerfilUsuario />} />
          <Route path="/usuarios" element={<GerenciarUsuarios />} />
          <Route path="/fluxograma" element={<Fluxograma />} />
          <Route path="/etapas" element={<Etapas />} />
          <Route path="/relatorios" element={<Relatorios />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;