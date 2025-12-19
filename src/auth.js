import { UserManager, WebStorageStateStore } from 'oidc-client';

// Конфигурация Bonfire OpenID Connect
// authority должен указывать на базовый URL провайдера
// oidc-client автоматически загрузит метаданные из {authority}/.well-known/openid-configuration

// Получаем переменные окружения
const clientId = import.meta.env.VITE_BONFIRE_CLIENT_ID;
// ВАЖНО: client_secret НЕ должен быть на фронтенде для безопасности!
// Если Bonfire требует client_secret для обмена токенов, обмен должен происходить на бекенде
const clientSecret = import.meta.env.VITE_BONFIRE_CLIENT_SECRET;

// Функция для проверки переменных окружения (вызывается при необходимости)
function validateEnvVars() {
  if (!clientId) {
    console.error(
      'Отсутствует обязательная переменная окружения!\n' +
      'Создайте файл .env.development или .env.production со следующей переменной:\n' +
      'VITE_BONFIRE_CLIENT_ID=your_client_id'
    );
    return false;
  }
  
  // Предупреждение, если client_secret на фронтенде (небезопасно!)
  if (clientSecret) {
    console.warn(
      '⚠️ ВНИМАНИЕ: VITE_BONFIRE_CLIENT_SECRET найден на фронтенде!\n' +
      'Это НЕБЕЗОПАСНО для публичных клиентов (SPA).\n' +
      'Если Bonfire требует client_secret, обмен токенов должен происходить на бекенде.\n' +
      'Удалите VITE_BONFIRE_CLIENT_SECRET из .env файлов фронтенда.'
    );
  }
  
  return true;
}

// Создаем конфигурацию
// ВАЖНО: Если Bonfire требует client_secret, его НЕЛЬЗЯ использовать на фронтенде!
// Вместо этого обмен токенов должен происходить на бекенде.
// oidc-client автоматически использует PKCE для безопасности публичных клиентов
function getOidcConfig() {
  const config = {
    authority: 'https://api.bonfire.moe',
    client_id: clientId || '',
    redirect_uri: import.meta.env.VITE_BONFIRE_REDIRECT_URI || `${window.location.origin}/auth/callback`,
    response_type: 'code',
    // Scope можно настроить через переменную окружения, по умолчанию используем минимальный набор
    scope: import.meta.env.VITE_BONFIRE_SCOPE || 'openid email profile',
    post_logout_redirect_uri: window.location.origin,
    automaticSilentRenew: true,
    silent_redirect_uri: `${window.location.origin}/auth/silent-callback`,
    userStore: new WebStorageStateStore({ store: window.localStorage }),
    loadUserInfo: true,
    filterProtocolClaims: true,
  };
  
  // ВАЖНО: НЕ добавляем client_secret на фронтенд!
  // Если Bonfire требует client_secret для обмена токенов, нужно:
  // 1. Убрать client_secret из фронтенда
  // 2. Сделать обмен токенов на бекенде (см. server/routes/auth.js)
  // 3. Или использовать PKCE (oidc-client делает это автоматически)
  
  return config;
}

// Ленивая инициализация UserManager (создается только при необходимости)
let _userManager = null;
function getUserManager() {
  if (!_userManager) {
    if (!validateEnvVars()) {
      throw new Error('Не настроены переменные окружения для авторизации');
    }
    _userManager = new UserManager(getOidcConfig());
  }
  return _userManager;
}

// Экспортируем функцию для получения userManager
export const userManager = new Proxy({}, {
  get(target, prop) {
    return getUserManager()[prop];
  }
});

// Функция для получения текущего пользователя
export async function getCurrentUser() {
  try {
    if (!validateEnvVars()) {
      return null;
    }
    const manager = getUserManager();
    const user = await manager.getUser();
    return user;
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    return null;
  }
}

// Функция для получения access token
export async function getAccessToken() {
  try {
    if (!validateEnvVars()) {
      return null;
    }
    const manager = getUserManager();
    const user = await manager.getUser();
    return user?.access_token || null;
  } catch (error) {
    console.error('Ошибка получения токена:', error);
    return null;
  }
}

// Функция для входа
export async function signIn() {
  // Проверяем переменные окружения перед использованием
  if (!validateEnvVars()) {
    throw new Error('Не настроены переменные окружения для авторизации. Обратитесь к администратору.');
  }

  try {
    const manager = getUserManager();
    await manager.signinRedirect();
  } catch (error) {
    console.error('Ошибка входа:', error);
    throw error;
  }
}

// Функция для выхода
export async function signOut() {
  try {
    if (!validateEnvVars()) {
      return;
    }
    const manager = getUserManager();
    await manager.signoutRedirect();
  } catch (error) {
    console.error('Ошибка выхода:', error);
    throw error;
  }
}

// Функция для обработки callback после входа
export async function handleCallback() {
  try {
    if (!validateEnvVars()) {
      throw new Error('Не настроены переменные окружения для авторизации');
    }
    const manager = getUserManager();
    const user = await manager.signinRedirectCallback();
    
    if (!user) {
      throw new Error('Не удалось получить пользователя после авторизации');
    }
    
    console.log('Пользователь успешно авторизован:', user.profile?.email || user.profile?.sub);
    return user;
  } catch (error) {
    console.error('Ошибка обработки callback:', error);
    console.error('Детали ошибки:', {
      message: error.message,
      name: error.name,
      error: error.toString()
    });
    
    // Если ошибка связана с state, возможно нужно очистить localStorage
    if (error.message && error.message.includes('state')) {
      console.warn('Ошибка state - возможно, нужно очистить localStorage');
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        console.error('Не удалось очистить storage:', e);
      }
    }
    
    throw error;
  }
}

// Функция для обработки silent callback (обновление токена)
export async function handleSilentCallback() {
  try {
    if (!validateEnvVars()) {
      return;
    }
    const manager = getUserManager();
    await manager.signinSilentCallback();
  } catch (error) {
    console.error('Ошибка silent callback:', error);
    throw error;
  }
}

// Подписка на события изменения пользователя
export function subscribeToUserChanges(callback) {
  try {
    if (!validateEnvVars()) {
      // Если переменные не настроены, просто возвращаем пустую функцию отписки
      return () => {};
    }
    const manager = getUserManager();
    manager.events.addUserLoaded(callback);
    manager.events.addUserUnloaded(callback);
    manager.events.addAccessTokenExpiring(() => {
      console.log('Токен скоро истечет, обновление...');
    });
    manager.events.addAccessTokenExpired(() => {
      console.log('Токен истек');
      callback(null);
    });
    
    return () => {
      try {
        manager.events.removeUserLoaded(callback);
        manager.events.removeUserUnloaded(callback);
      } catch (e) {
        // Игнорируем ошибки при отписке
      }
    };
  } catch (error) {
    console.error('Ошибка подписки на события:', error);
    return () => {};
  }
}

