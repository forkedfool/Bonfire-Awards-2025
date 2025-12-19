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
  // Убеждаемся, что redirect_uri всегда одинаковый
  const redirectUri = import.meta.env.VITE_BONFIRE_REDIRECT_URI || `${window.location.origin}/auth/callback`;
  
  const config = {
    authority: 'https://api.bonfire.moe',
    client_id: clientId || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    // Scope можно настроить через переменную окружения, по умолчанию используем минимальный набор
    scope: import.meta.env.VITE_BONFIRE_SCOPE || 'openid email profile',
    post_logout_redirect_uri: window.location.origin,
    automaticSilentRenew: true,
    silent_redirect_uri: `${window.location.origin}/auth/silent-callback`,
    userStore: new WebStorageStateStore({ 
      store: window.localStorage
      // Не указываем кастомный prefix - используем дефолтный от oidc-client
    }),
    loadUserInfo: true,
    filterProtocolClaims: true,
    // Явно включаем PKCE для безопасности
    // oidc-client использует PKCE по умолчанию для публичных клиентов
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
    const config = getOidcConfig();
    console.log('Инициализация UserManager с конфигурацией:', {
      authority: config.authority,
      client_id: config.client_id ? '***установлен***' : 'НЕ УСТАНОВЛЕН',
      redirect_uri: config.redirect_uri,
      scope: config.scope
    });
    _userManager = new UserManager(config);
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
    const config = getOidcConfig();
    
    console.log('Начинаем процесс авторизации...');
    console.log('Redirect URI:', config.redirect_uri);
    console.log('Client ID:', config.client_id ? '***установлен***' : 'НЕ УСТАНОВЛЕН');
    
    // Очищаем старые данные перед новым входом (на случай проблем)
    try {
      const oldUser = await manager.getUser();
      if (oldUser) {
        console.log('Найден старый пользователь, очищаем...');
        await manager.removeUser();
      }
    } catch (e) {
      // Игнорируем ошибки при очистке
    }
    
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

// Защита от повторного вызова handleCallback
let callbackProcessing = false;

// Функция для обработки callback после входа
export async function handleCallback() {
  // Защита от повторного вызова
  if (callbackProcessing) {
    console.warn('Callback уже обрабатывается, пропускаем повторный вызов');
    throw new Error('Callback уже обрабатывается');
  }
  
  callbackProcessing = true;
  
  try {
    if (!validateEnvVars()) {
      throw new Error('Не настроены переменные окружения для авторизации');
    }
    
    // Логируем текущий URL для отладки
    console.log('Обработка callback, текущий URL:', window.location.href);
    
    // Проверяем, что в URL есть код авторизации
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');
    
    console.log('Параметры callback:', { 
      hasCode: !!code, 
      hasState: !!state, 
      error: error || null 
    });
    
    if (error) {
      throw new Error(`Ошибка от Bonfire: ${error} (${urlParams.get('error_description') || ''})`);
    }
    
    // Проверяем localStorage перед обработкой
    try {
      const storageKeys = Object.keys(localStorage).filter(key => key.includes('oidc') || key.includes('user'));
      console.log('Ключи в localStorage, связанные с OIDC:', storageKeys);
    } catch (e) {
      console.warn('Не удалось проверить localStorage:', e);
    }
    
    const manager = getUserManager();
    
    // Добавляем обработчики событий для отладки
    manager.events.addUserLoaded((user) => {
      console.log('Событие: пользователь загружен', user?.profile?.email || user?.profile?.sub);
    });
    
    manager.events.addAccessTokenExpiring(() => {
      console.log('Событие: токен скоро истечет');
    });
    
    manager.events.addAccessTokenExpired(() => {
      console.log('Событие: токен истек');
    });
    
    // Пытаемся обработать callback
    console.log('Вызываем signinRedirectCallback...');
    let user;
    try {
      user = await manager.signinRedirectCallback();
    } catch (callbackError) {
      console.error('Ошибка в signinRedirectCallback:', callbackError);
      
      // Если ошибка связана с state, проверяем, может быть проблема в конфигурации
      if (callbackError.message && callbackError.message.includes('state')) {
        console.warn('Проблема с state. Проверяем конфигурацию...');
        const config = getOidcConfig();
        console.log('Текущая конфигурация:', {
          redirect_uri: config.redirect_uri,
          authority: config.authority,
          client_id: config.client_id ? '***установлен***' : 'НЕ УСТАНОВЛЕН'
        });
        
        // Проверяем, что redirect_uri в URL совпадает с конфигурацией
        const currentUrl = new URL(window.location.href);
        const expectedPath = new URL(config.redirect_uri).pathname;
        if (currentUrl.pathname !== expectedPath) {
          console.error(`Несоответствие redirect_uri! Ожидалось: ${expectedPath}, получено: ${currentUrl.pathname}`);
        }
      }
      
      throw callbackError;
    }
    
    if (!user) {
      throw new Error('Не удалось получить пользователя после авторизации');
    }
    
    console.log('Пользователь успешно авторизован:', user.profile?.email || user.profile?.sub);
    console.log('Токен получен:', user.access_token ? 'Да' : 'Нет');
    callbackProcessing = false;
    return user;
  } catch (error) {
    callbackProcessing = false;
    console.error('Ошибка обработки callback:', error);
    console.error('Детали ошибки:', {
      message: error.message,
      name: error.name,
      error: error.toString(),
      stack: error.stack
    });
    
    // Если ошибка связана с state, пытаемся восстановить
    if (error.message && (error.message.includes('state') || error.message.includes('No matching'))) {
      console.warn('Ошибка state - проверяем localStorage');
      try {
        // Выводим все ключи для отладки
        const allKeys = Object.keys(localStorage);
        console.log('Все ключи в localStorage:', allKeys);
        
        // Пытаемся найти state вручную
        const stateKeys = allKeys.filter(key => key.includes('state') || key.includes('oidc'));
        console.log('Ключи, связанные с state:', stateKeys);
        
        // Не очищаем автоматически - это может быть временная проблема
        // Вместо этого предлагаем пользователю попробовать снова
      } catch (e) {
        console.error('Не удалось проверить storage:', e);
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

