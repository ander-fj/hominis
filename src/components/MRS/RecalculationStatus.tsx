import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, XCircle, Clock, Play, User } from 'lucide-react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface QueueItem {
  period: string;
  status: string;
  created_at: string;
  processed_at: string | null;
  error_message: string | null;
}

export default function RecalculationStatus() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    // Busca o nome de usuário do localStorage quando o componente é montado.
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadQueue = async () => {
    try {
      const queueQuery = query(
        collection(db, 'ranking_recalculation_queue'),
        orderBy('created_at', 'desc'),
      );
      const querySnapshot = await getDocs(queueQuery);

      if (!querySnapshot.empty) {
        const data = querySnapshot.docs.map(doc => doc.data()) as QueueItem[];
        setQueue(data);
      }
    } catch (error) {
      console.error('Erro ao carregar fila:', error);
    } finally {
      setLoading(false);
    }
  };

  const processPendingItems = async () => {
    setProcessing(true);
    try {
      // This logic should be moved to a Firebase Cloud Function for security and reliability.
      // The button will now just inform the user.
      alert('O recálculo é um processo de backend e será iniciado automaticamente.');
      await loadQueue();
    } catch (error) {
      console.error('Erro ao processar pendentes:', error);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'processing':
        return <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pendente',
      processing: 'Processando',
      completed: 'Concluído',
      error: 'Erro'
    };
    return labels[status] || status;
  };

  const pendingCount = queue.filter(q => q.status === 'pending').length;

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="animate-pulse flex items-center gap-2">
          <div className="h-4 w-4 bg-gray-200 rounded"></div>
          <div className="h-4 w-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (queue.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-[#912325]" />
          <h3 className="font-semibold text-[#912325]">Status de Recálculo Automático</h3>
        </div>
        {username && (
          <div className="flex items-center gap-2 text-gray-600">
            <User className="w-4 h-4" />
            <span className="font-medium">{username}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-semibold rounded-full">
                {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
              </span>
              <button
                onClick={processPendingItems}
                disabled={processing}
                className="px-3 py-1.5 bg-gradient-to-r from-[#912325] to-[#701a1c] text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-1.5 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Processar Pendentes
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Período</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Criado em</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Processado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {queue.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-sm font-medium text-gray-900">
                  {new Date(item.period).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(item.status)}
                    <span className="text-sm">{getStatusLabel(item.status)}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-sm text-gray-600">
                  {new Date(item.created_at).toLocaleTimeString('pt-BR')}
                </td>
                <td className="px-4 py-2 text-sm text-gray-600">
                  {item.processed_at ? new Date(item.processed_at).toLocaleTimeString('pt-BR') : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
