import { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, Check, Trash2, Save } from 'lucide-react';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { getTenantCollection, AVAILABLE_PERMISSIONS, UserProfile } from '../../lib/tenantUtils';
import MRSCard from './MRSCard';

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Form states
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user');
  const [newUserPermissions, setNewUserPermissions] = useState<string[]>([]);

  const tenantId = localStorage.getItem('tenantId');
  const currentUserRole = localStorage.getItem('userRole');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      // Busca usuários na subcoleção do tenant
      const usersRef = collection(db, 'tenants', tenantId, 'users');
      const snapshot = await getDocs(usersRef);
      const usersList = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(usersList);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    try {
      // Nota: Em um cenário real, isso deveria disparar uma Cloud Function para criar o Auth User
      // ou enviar um convite por email. Aqui simulamos criando o registro no banco.
      // O UID seria gerado pelo Firebase Auth na criação real.
      const mockUid = 'user_' + Math.random().toString(36).substr(2, 9);

      const newUser: UserProfile = {
        uid: mockUid,
        email: newUserEmail,
        tenantId: tenantId,
        role: newUserRole,
        permissions: newUserPermissions
      };

      // 1. Salvar na coleção do tenant
      await setDoc(doc(db, 'tenants', tenantId, 'users', mockUid), newUser);
      
      // 2. Salvar no perfil global (para login funcionar)
      await setDoc(doc(db, 'user_profiles', mockUid), newUser);

      alert(`Usuário ${newUserEmail} adicionado! (Nota: Em produção, ele receberia um email para definir a senha)`);
      setShowAddModal(false);
      setNewUserEmail('');
      setNewUserPermissions([]);
      loadUsers();
    } catch (error) {
      console.error("Erro ao adicionar usuário:", error);
      alert("Erro ao adicionar usuário");
    }
  };

  const togglePermission = (permId: string) => {
    setNewUserPermissions(prev => 
      prev.includes(permId) 
        ? prev.filter(p => p !== permId)
        : [...prev, permId]
    );
  };

  if (currentUserRole !== 'master') {
    return <div className="p-4 text-red-600">Acesso negado. Apenas usuários Master podem gerenciar acessos.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#912325] flex items-center gap-2">
          <Users className="w-6 h-6" />
          Gerenciamento de Usuários e Acessos
        </h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-[#912325] text-white rounded-lg hover:bg-[#701a1c] flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Novo Usuário
        </button>
      </div>

      <MRSCard>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Email</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Função</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Permissões</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.uid}>
                  <td className="px-4 py-3 text-sm text-gray-900">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      user.role === 'master' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {user.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {user.role === 'master' ? 'Acesso Total' : user.permissions.join(', ')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {user.role !== 'master' && (
                      <button className="text-red-600 hover:text-red-800">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MRSCard>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-[#912325] mb-4">Adicionar Usuário</h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={e => setNewUserEmail(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#912325]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissões de Acesso</label>
                <div className="space-y-2 border p-3 rounded-lg max-h-48 overflow-y-auto">
                  {AVAILABLE_PERMISSIONS.map(perm => (
                    <label key={perm.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newUserPermissions.includes(perm.id)}
                        onChange={() => togglePermission(perm.id)}
                        className="rounded text-[#912325] focus:ring-[#912325]"
                      />
                      <span className="text-sm text-gray-700">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="w-full py-2 bg-[#912325] text-white rounded-lg font-semibold">Salvar Usuário</button>
            </form>
            <button onClick={() => setShowAddModal(false)} className="w-full mt-2 py-2 text-gray-600">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}