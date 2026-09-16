import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from './firebase';

export interface Tenant {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  tenantId: string;
  role: 'master' | 'admin' | 'user';
  permissions: string[]; // ex: ['dashboard', 'employees', 'sst']
}

export const AVAILABLE_PERMISSIONS = [
  { id: 'dashboard_rh', label: 'Dashboard RH' },
  { id: 'dashboard_sst', label: 'Dashboard SST' },
  { id: 'employees', label: 'Colaboradores' },
  { id: 'ranking', label: 'Ranking Inteligente' },
  { id: 'settings', label: 'Configurações' },
  { id: 'users', label: 'Gerenciar Usuários' }
];

// Função para obter ou criar o perfil do usuário e seu tenant
export async function initializeUserSession(user: any): Promise<UserProfile | null> {
  if (!user) return null;

  // 1. Verificar se o usuário já tem um perfil global
  const profileRef = doc(db, 'user_profiles', user.uid);
  const profileSnap = await getDoc(profileRef);

  if (profileSnap.exists()) {
    const profile = profileSnap.data() as UserProfile;
    localStorage.setItem('tenantId', profile.tenantId);
    localStorage.setItem('userRole', profile.role);
    localStorage.setItem('userPermissions', JSON.stringify(profile.permissions));
    return profile;
  }

  // 2. Se não tem perfil, verificar se foi convidado (busca na coleção de convites ou usuários de tenants existentes)
  // Para simplificar: Se não tem perfil, assumimos que é um NOVO MASTER criando sua conta
  
  // Criar novo Tenant
  const newTenantRef = doc(collection(db, 'tenants'));
  const newTenant: Tenant = {
    id: newTenantRef.id,
    name: `Empresa de ${user.email}`,
    ownerId: user.uid,
    createdAt: new Date().toISOString()
  };
  
  await setDoc(newTenantRef, newTenant);

  // Criar Perfil Master
  const newProfile: UserProfile = {
    uid: user.uid,
    email: user.email,
    tenantId: newTenant.id,
    role: 'master',
    permissions: AVAILABLE_PERMISSIONS.map(p => p.id) // Master tem tudo
  };

  await setDoc(profileRef, newProfile);

  // Salvar também dentro da coleção do tenant para listagem fácil
  await setDoc(doc(db, 'tenants', newTenant.id, 'users', user.uid), newProfile);

  localStorage.setItem('tenantId', newTenant.id);
  localStorage.setItem('userRole', 'master');
  localStorage.setItem('userPermissions', JSON.stringify(newProfile.permissions));

  return newProfile;
}

// Helper para pegar a referência da coleção correta (Tenant ou Raiz)
export function getTenantCollection(collectionName: string) {
  const tenantId = localStorage.getItem('tenantId');
  if (!tenantId) {
    console.warn('Tenant ID não encontrado, usando coleção raiz (modo fallback)');
    return collection(db, collectionName);
  }
  // Retorna a subcoleção: tenants/{tenantId}/{collectionName}
  return collection(db, 'tenants', tenantId, collectionName);
}