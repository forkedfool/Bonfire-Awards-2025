import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  userManager, 
  getCurrentUser, 
  getAccessToken,
  subscribeToUserChanges,
  handleSilentCallback as handleSilentCallbackAuth
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

    // НЕ обрабатываем callback здесь - это делает AuthCallback компонент
    // Проверяем только silent callback
    const url = window.location.href;
    if (url.includes('/auth/silent-callback')) {
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
      
      // Выводим информацию об аккаунте после загрузки
      if (currentUser && currentUser.profile) {
        console.log('=== ИНФОРМАЦИЯ ОБ АККАУНТЕ ===');
        console.log('User ID (sub):', currentUser.profile.sub);
        console.log('Email:', currentUser.profile.email || 'не указан');
        console.log('Username:', currentUser.profile.preferred_username || currentUser.profile.name || 'не указан');
        console.log('Email Verified:', currentUser.profile.email_verified ? 'да' : 'нет');
        console.log('\n📋 Для добавления в админы, добавьте в .env на сервере:');
        console.log(`ADMIN_USER_IDS=${currentUser.profile.sub}`);
        console.log('================================');
      }
    } catch (error) {
      console.error('Ошибка загрузки пользователя:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }


  async function handleSilentCallback() {
    try {
      await handleSilentCallbackAuth();
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

  // Экспортируем функцию для получения ID пользователя в консоли (для отладки)
  if (typeof window !== 'undefined') {
    window.__getUserInfo = () => {
      if (user?.profile) {
        console.log('=== ВАШ ID ПОЛЬЗОВАТЕЛЯ ===');
        console.log('User ID (sub):', user.profile.sub);
        console.log('Email:', user.profile.email);
        console.log('Username:', user.profile.preferred_username || user.profile.name);
        console.log('\nСкопируйте этот ID и добавьте в .env на сервере:');
        console.log(`ADMIN_USER_IDS=${user.profile.sub}`);
        return user.profile.sub;
      } else {
        console.log('Пользователь не авторизован');
        return null;
      }
    };
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth должен использоваться внутри AuthProvider');
  }
  return context;
}

