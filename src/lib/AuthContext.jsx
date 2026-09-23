import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

// ---------------------------------------------------------------------------
// Versão local: não há contas, não há login, não há chamada nenhuma à rede.
// O "utilizador" é apenas um perfil guardado no aparelho, usado para o nome
// e para as preferências. O contexto mantém a mesma forma de antes para que
// o App.jsx e o ProtectedRoute continuem a funcionar sem alterações.
// ---------------------------------------------------------------------------

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  const checkUserAuth = useCallback(async () => {
    try {
      const localUser = await base44.auth.me();
      setUser(localUser);
    } catch {
      // Mesmo que o perfil falhe, a app abre à mesma: não há nada a proteger.
      setUser(null);
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  const noop = () => {};

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: true,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authChecked,
      authError: null,
      appPublicSettings: null,
      checkUserAuth,
      checkAppState: checkUserAuth,
      logout: noop,
      navigateToLogin: noop,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
