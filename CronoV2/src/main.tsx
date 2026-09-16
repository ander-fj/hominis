import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { installGlobalErrorMonitoring } from './shared/monitoring/appHealth';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });
installGlobalErrorMonitoring();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </StrictMode>
);
