import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  userManager, 
  getCurrentUser, 
  getAccessToken,
  subscribeToUserChanges 
} from './auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Загружаем текущего пользователя при монтировании
    loadUser();

    // Подписываемся на изменения пользователя
    const unsubscribe = subscribeToUserChanges((updatedUser) => {
      setUser(updatedUser);
    });

    // Проверяем, есть ли callback в URL (после редиректа с Bonfire)
    const url = window.location.href;
    if (url.includes('/auth/callback')) {
      handleAuthCallback();
    } else if (url.includes('/auth/silent-callback')) {
      handleSilentCallback();
    }

    return () => {
      unsubscribe();
    };
  }, []);

  async function loadUser() {
    try {
      setIsLoading(true);
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Ошибка загрузки пользователя:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAuthCallback() {
    try {
      // Импортируем handleCallback из auth.js
      const { handleCallback } = await import('./auth.js');
      const user = await handleCallback();
      setUser(user);
      // Убираем callback из URL
      window.history.replaceState({}, document.title, '/');
    } catch (error) {
      console.error('Ошибка обработки callback:', error);
      setUser(null);
      window.history.replaceState({}, document.title, '/');
    }
  }

  async function handleSilentCallback() {
    try {
      const { handleSilentCallback } = await import('./auth.js');
      await handleSilentCallback();
      await loadUser();
    } catch (error) {
      console.error('Ошибка silent callback:', error);
    }
  }

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    accessToken: user?.access_token || null,
    userInfo: user?.profile || null,
    loadUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth должен использоваться внутри AuthProvider');
  }
  return context;
}

