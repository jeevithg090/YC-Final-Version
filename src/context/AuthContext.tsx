import React, { createContext, useState, useEffect, useContext } from 'react';

// Define a simple User type for compatibility (no Firebase auth used)
interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

// Create the context interface
interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
}

// Create context with default values
const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
});

// Create provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Simulated auth state - no actual Firebase auth used
  useEffect(() => {
    console.log('Setting up simulated auth in AuthContext');
    
    // Simulate auth loading and then no user
    const timer = setTimeout(() => {
      console.log('Auth simulation complete - no user logged in');
      setCurrentUser(null);
      setLoading(false);
    }, 100); // Shorter timeout to avoid delays

    // Clean up timer
    return () => clearTimeout(timer);
  }, []);

  // Always return the same structure
  const value = {
    currentUser,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = () => {
  return useContext(AuthContext);
};
