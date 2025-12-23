import { Trophy } from 'lucide-react';

export default function RankingView() {
  return (
    <div className="flex flex-col items-center justify-center h-96 text-center p-8">
      <Trophy className="w-16 h-16 text-gray-300 mb-4" />
      <h2 className="text-2xl font-bold text-gray-700">Componente Desativado</h2>
      <p className="text-gray-500 mt-2">
        Este componente (RankingView) foi substituído pelo <strong>Ranking Inteligente</strong>.
        <br />
        Por favor, utilize o menu lateral para acessar a nova versão.
      </p>
    </div>
  );
}
