import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchCompanyId(currentUser.uid);
      } else {
        setCompanyId(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  async function fetchCompanyId(userId: string) {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setCompanyId(userDoc.data().companyId);
      }
    } catch (error) {
      console.error('Error fetching companyId:', error);
    } finally {
      setLoading(false);
    }
  }

  return { user, companyId, loading };
}