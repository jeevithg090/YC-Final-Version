import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';

import { auth } from '../services/firebase';

interface AuthContextType {
  /** The signed-in Firebase user, or `null` when signed out. */
  currentUser: User | null;
  /** `true` until Firebase has reported the initial auth state. */
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setCurrentUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = useMemo(() => ({ currentUser, loading }), [currentUser, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => useContext(AuthContext);
