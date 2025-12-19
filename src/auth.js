import { UserManager, WebStorageStateStore } from 'oidc-client';

// Конфигурация Bonfire OpenID Connect
// authority должен указывать на базовый URL провайдера
// oidc-client автоматически загрузит метаданные из {authority}/.well-known/openid-configuration
// Проверка обязательных переменных окружения
const clientId = import.meta.env.VITE_BONFIRE_CLIENT_ID;
const clientSecret = import.meta.env.VITE_BONFIRE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  throw new Error(
    'Отсутствуют обязательные переменные окружения!\n' +
    'Создайте файл .env.development или .env.production со следующими переменными:\n' +
    'VITE_BONFIRE_CLIENT_ID=your_client_id\n' +
    'VITE_BONFIRE_CLIENT_SECRET=your_client_secret'
  );
}

const oidcConfig = {
  authority: 'https://api.bonfire.moe',
  client_id: clientId,
  client_secret: clientSecret,
  redirect_uri: import.meta.env.VITE_BONFIRE_REDIRECT_URI || `${window.location.origin}/auth/callback`,
  response_type: 'code',
  scope: 'openid email profile offline_access',
  post_logout_redirect_uri: window.location.origin,
  automaticSilentRenew: true,
  silent_redirect_uri: `${window.location.origin}/auth/silent-callback`,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  loadUserInfo: true,
  filterProtocolClaims: true,
};

// Создаем экземпляр UserManager
export const userManager = new UserManager(oidcConfig);

// Функция для получения текущего пользователя
export async function getCurrentUser() {
  try {
    const user = await userManager.getUser();
    return user;
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    return null;
  }
}

// Функция для получения access token
export async function getAccessToken() {
  try {
    const user = await userManager.getUser();
    return user?.access_token || null;
  } catch (error) {
    console.error('Ошибка получения токена:', error);
    return null;
  }
}

// Функция для входа
export async function signIn() {
  try {
    console.log('Начинаем процесс авторизации...');
    console.log('Redirect URI:', oidcConfig.redirect_uri);
    console.log('Client ID:', oidcConfig.client_id ? '***установлен***' : 'НЕ УСТАНОВЛЕН');
    
    // Создаем URL для авторизации вручную, если signinRedirect не работает
    try {
      // Пытаемся выполнить редирект через oidc-client
      await userManager.signinRedirect();
    } catch (oidcError) {
      console.warn('signinRedirect не сработал, пробуем альтернативный способ:', oidcError);
      
      // Альтернативный способ: создаем URL вручную
      const redirectUri = encodeURIComponent(oidcConfig.redirect_uri);
      const scope = encodeURIComponent(oidcConfig.scope);
      const responseType = encodeURIComponent(oidcConfig.response_type);
      const clientId = encodeURIComponent(oidcConfig.client_id);
      
      // Генерируем state и nonce для безопасности
      const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // Сохраняем state в sessionStorage для проверки при callback
      sessionStorage.setItem('oidc.state', state);
      sessionStorage.setItem('oidc.nonce', nonce);
      
      const authUrl = `https://api.bonfire.moe/openid/authorize?` +
        `client_id=${clientId}&` +
        `redirect_uri=${redirectUri}&` +
        `response_type=${responseType}&` +
        `scope=${scope}&` +
        `state=${state}&` +
        `nonce=${nonce}`;
      
      console.log('Выполняем редирект на:', authUrl);
      window.location.href = authUrl;
    }
  } catch (error) {
    console.error('Ошибка входа:', error);
    console.error('Детали ошибки:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    throw error;
  }
}

// Функция для выхода
export async function signOut() {
  try {
    await userManager.signoutRedirect();
  } catch (error) {
    console.error('Ошибка выхода:', error);
    throw error;
  }
}

// Функция для обработки callback после входа
export async function handleCallback() {
  try {
    const user = await userManager.signinRedirectCallback();
    return user;
  } catch (error) {
    console.error('Ошибка обработки callback:', error);
    throw error;
  }
}

// Функция для обработки silent callback (обновление токена)
export async function handleSilentCallback() {
  try {
    await userManager.signinSilentCallback();
  } catch (error) {
    console.error('Ошибка silent callback:', error);
    throw error;
  }
}

// Подписка на события изменения пользователя
export function subscribeToUserChanges(callback) {
  userManager.events.addUserLoaded(callback);
  userManager.events.addUserUnloaded(callback);
  userManager.events.addAccessTokenExpiring(() => {
    console.log('Токен скоро истечет, обновление...');
  });
  userManager.events.addAccessTokenExpired(() => {
    console.log('Токен истек');
    callback(null);
  });
  
  return () => {
    userManager.events.removeUserLoaded(callback);
    userManager.events.removeUserUnloaded(callback);
  };
}

