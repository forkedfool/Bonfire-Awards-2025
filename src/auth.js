import { UserManager, WebStorageStateStore, User } from 'oidc-client';

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
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  
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
    // Используем наш бэкенд для обмена токенов
    // Это позволяет использовать client_secret безопасно на бэкенде
    metadata: {
      issuer: 'https://api.bonfire.moe',
      authorization_endpoint: 'https://api.bonfire.moe/openid/authorize',
      token_endpoint: `${API_BASE_URL}/auth/exchange-token`, // Используем наш бэкенд
      userinfo_endpoint: 'https://api.bonfire.moe/openid/userinfo',
      jwks_uri: 'https://api.bonfire.moe/.well-known/jwks.json',
      end_session_endpoint: 'https://api.bonfire.moe/openid/logout',
    },
    // Явно включаем PKCE для безопасности
    // oidc-client использует PKCE по умолчанию для публичных клиентов
  };
  
  // ВАЖНО: НЕ добавляем client_secret на фронтенд!
  // Обмен токенов происходит через наш бэкенд (см. server/routes/auth.js)
  // Бэкенд безопасно использует client_secret если требуется
  
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

// Утилита для логирования всех доступных данных от Bonfire
export function logBonfireUserData(user) {
  if (!user) {
    console.log('Пользователь не авторизован');
    return;
  }

  console.group('📊 Данные пользователя от Bonfire');
  
  // Токены
  console.group('🔑 Токены');
  console.log('Access Token:', user.access_token ? `${user.access_token.substring(0, 20)}...` : 'отсутствует');
  console.log('ID Token:', user.id_token ? `${user.id_token.substring(0, 20)}...` : 'отсутствует');
  console.log('Refresh Token:', user.refresh_token ? 'присутствует' : 'отсутствует');
  console.log('Token Type:', user.token_type || 'Bearer');
  console.log('Expires At:', user.expires_at ? new Date(user.expires_at * 1000).toLocaleString() : 'неизвестно');
  console.log('Scope:', user.scope);
  console.groupEnd();
  
  // Профиль пользователя
  if (user.profile) {
    console.group('👤 Профиль пользователя');
    console.log('Subject (ID):', user.profile.sub);
    console.log('Email:', user.profile.email || 'не указан');
    console.log('Email Verified:', user.profile.email_verified ? 'да' : 'нет');
    console.log('Preferred Username:', user.profile.preferred_username || 'не указан');
    console.log('Name:', user.profile.name || 'не указан');
    console.log('Issuer:', user.profile.iss || 'не указан');
    console.log('Audience:', user.profile.aud || 'не указан');
    
    // Все остальные поля профиля
    const otherFields = Object.keys(user.profile).filter(
      key => !['sub', 'email', 'email_verified', 'preferred_username', 'name', 'iss', 'aud', 'exp', 'iat'].includes(key)
    );
    if (otherFields.length > 0) {
      console.group('📋 Дополнительные поля');
      otherFields.forEach(key => {
        console.log(`${key}:`, user.profile[key]);
      });
      console.groupEnd();
    }
    console.groupEnd();
  } else {
    console.log('Профиль пользователя отсутствует');
  }
  
  // Полный объект (для разработки)
  if (process.env.NODE_ENV === 'development') {
    console.group('🔍 Полный объект User');
    console.log(user);
    console.groupEnd();
  }
  
  console.groupEnd();
}

// Функция для получения access token
export async function getAccessToken() {
  try {
    if (!validateEnvVars()) {
      return null;
    }
    const manager = getUserManager();
    const user = await manager.getUser();
    
    if (!user) {
      return null;
    }
    
    // Проверяем, не истек ли токен
    if (user.expired) {
      console.log('Токен истек, пытаемся обновить...');
      try {
        await manager.signinSilent();
        const refreshedUser = await manager.getUser();
        return refreshedUser?.access_token || null;
      } catch (silentError) {
        console.error('Ошибка обновления токена:', silentError);
        return null;
      }
    }
    
    return user.access_token || null;
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
      console.error('Детали ошибки callback:', {
        message: callbackError.message,
        name: callbackError.name,
        error: callbackError.toString()
      });
      
      // Если ошибка 500 при обмене токенов, пробуем использовать наш бэкенд вручную
      if (callbackError.message && (callbackError.message.includes('500') || callbackError.message.includes('fetch failed'))) {
        console.warn('Ошибка при прямом обмене токенов, пробуем через бэкенд...');
        
        try {
          // Получаем code_verifier из localStorage
          // oidc-client хранит его в ключе вида oidc.{state} или oidc.user:{authority}:{client_id}
          let codeVerifier = null;
          
          // Пробуем найти по state
          const stateKey = `oidc.${state}`;
          try {
            const storedData = localStorage.getItem(stateKey);
            if (storedData) {
              const parsed = JSON.parse(storedData);
              // code_verifier может быть в разных местах в зависимости от версии oidc-client
              codeVerifier = parsed.code_verifier || parsed.codeVerifier || parsed.codeVerifier || null;
            }
          } catch (e) {
            console.warn('Не удалось прочитать state из localStorage:', e);
          }
          
          // Если не нашли, пробуем найти в других ключах oidc
          if (!codeVerifier) {
            try {
              const oidcKeys = Object.keys(localStorage).filter(key => key.startsWith('oidc.'));
              for (const key of oidcKeys) {
                try {
                  const data = JSON.parse(localStorage.getItem(key));
                  if (data && (data.code_verifier || data.codeVerifier)) {
                    codeVerifier = data.code_verifier || data.codeVerifier;
                    console.log('Найден code_verifier в ключе:', key);
                    break;
                  }
                } catch (e) {
                  // Игнорируем ошибки парсинга
                }
              }
            } catch (e) {
              console.warn('Ошибка при поиске code_verifier:', e);
            }
          }
          
          // Обмениваем код на токены через наш бэкенд
          const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
          const config = getOidcConfig();
          
          console.log('Обмен токенов через бэкенд:', {
            code: code ? '***present***' : 'missing',
            hasCodeVerifier: !!codeVerifier,
            redirect_uri: config.redirect_uri,
          });
          
          const tokenResponse = await fetch(`${API_BASE_URL}/auth/exchange-token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              code: code,
              code_verifier: codeVerifier,
              redirect_uri: config.redirect_uri,
            }),
          });
          
          if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('Ошибка обмена токенов через бэкенд:', {
              status: tokenResponse.status,
              error: errorText,
            });
            throw new Error(`Не удалось обменять код на токены: ${tokenResponse.status} ${errorText}`);
          }
          
          const tokens = await tokenResponse.json();
          console.log('Токены получены через бэкенд:', {
            hasAccessToken: !!tokens.access_token,
            hasIdToken: !!tokens.id_token,
            hasRefreshToken: !!tokens.refresh_token,
          });
          
          // Получаем userinfo через бэкенд (для обхода CORS) или декодируем из id_token
          let userInfo = {};
          
          // Сначала пробуем получить через бэкенд
          if (tokens.access_token) {
            try {
              const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
              const userInfoResponse = await fetch(`${API_BASE_URL}/auth/userinfo`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  access_token: tokens.access_token,
                }),
              });
              
              if (userInfoResponse.ok) {
                const userInfoData = await userInfoResponse.json();
                userInfo = userInfoData.userinfo || userInfoData;
              }
            } catch (userInfoError) {
              console.warn('Не удалось получить userinfo через бэкенд:', userInfoError);
            }
          }
          
          // Если userinfo не получен, декодируем из id_token
          if (tokens.id_token && !userInfo.sub) {
            try {
              const idTokenParts = tokens.id_token.split('.');
              if (idTokenParts.length === 3) {
                const payload = JSON.parse(atob(idTokenParts[1]));
                userInfo = { ...userInfo, ...payload };
              }
            } catch (e) {
              console.warn('Не удалось декодировать id_token');
            }
          }
          
          // User класс уже импортирован в начале файла
          const expiresAt = tokens.expires_in 
            ? Math.floor(Date.now() / 1000) + tokens.expires_in 
            : null;
          
          // Создаем User объект через конструктор User класса
          user = new User({
            id_token: tokens.id_token,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || null,
            token_type: tokens.token_type || 'Bearer',
            scope: tokens.scope || config.scope,
            expires_at: expiresAt,
            profile: userInfo,
            state: state,
            session_state: null,
          });
          
          // Сохраняем пользователя в хранилище
          await manager.storeUser(user);
          console.log('Пользователь сохранен после ручного обмена токенов:', {
            email: userInfo.email || userInfo.sub,
            hasToken: !!user.access_token,
          });
        } catch (manualError) {
          console.error('Ошибка при ручном обмене токенов:', manualError);
          // Пробрасываем более информативную ошибку
          throw new Error(`Ошибка обмена токенов: ${manualError.message || callbackError.message}`);
        }
      } else {
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

