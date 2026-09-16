import React, { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center dark:bg-slate-950">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Ocorreu um erro inesperado</h1>
          <p className="max-w-md text-sm text-slate-600 dark:text-slate-300">Se o problema persistir, atualize a página ou tente novamente.</p>
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white" onClick={() => window.location.reload()}>
            Atualizar sistema
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
