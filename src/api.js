const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Таймаут для API запросов (5 секунд)
const API_TIMEOUT = 5000;

// Функция с таймаутом для fetch
function fetchWithTimeout(url, options, timeout = API_TIMEOUT) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Таймаут запроса')), timeout)
    )
  ]);
}

// Получение токена из OIDC
// Импортируем статически, чтобы избежать проблем с code splitting
import { getAccessToken } from './auth.js';

let getAuthToken = async () => {
  try {
    return await getAccessToken();
  } catch (error) {
    console.error('Ошибка получения токена:', error);
    return null;
  }
};

// Утилита для API запросов
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = await getAuthToken();
  
  const config = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  try {
    console.log('API Request:', url, config.method || 'GET', {
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
    });
    const response = await fetchWithTimeout(url, config, API_TIMEOUT);
    
    console.log('API Response status:', response.status, response.statusText);
    
    // Читаем ответ как текст сначала, чтобы можно было парсить JSON или обработать ошибку
    const responseText = await response.text();
    let data;
    
    // Пытаемся распарсить как JSON
    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch (parseError) {
      // Если не JSON, но статус успешный - возвращаем текст
      if (response.ok) {
        return responseText;
      }
      // Если ошибка и не JSON - создаем объект ошибки
      console.error('JSON parse error:', parseError);
      console.error('Response text:', responseText.substring(0, 500));
      throw new Error(`Сервер вернул неверный формат ответа: ${response.status} ${response.statusText}`);
    }
    
    // Обрабатываем ответы сервера
    if (!response.ok) {
      console.error('API Error response:', data);
      
      // Если сервер вернул структурированную ошибку
      if (data && typeof data === 'object') {
        const errorMessage = data.error || data.message || 'Ошибка запроса';
        const error = new Error(errorMessage);
        // Добавляем дополнительные данные об ошибке
        if (data.details) {
          error.details = data.details;
        }
        if (data.success === false) {
          error.serverError = true;
        }
        throw error;
      }
      
      throw new Error(data?.error || `Ошибка сервера: ${response.status} ${response.statusText}`);
    }
    
    // Проверяем структуру успешного ответа
    // Если сервер вернул { success: true, ... }, извлекаем данные
    if (data && typeof data === 'object' && 'success' in data) {
      if (data.success === false) {
        throw new Error(data.error || 'Запрос завершился с ошибкой');
      }
      // Возвращаем данные без флага success, если есть другие поля
      const { success, ...rest } = data;
      return Object.keys(rest).length > 0 ? rest : data;
    }
    
    return data;
  } catch (error) {
    // Обработка сетевых ошибок
    if (error.message.includes('Таймаут запроса')) {
      throw new Error('Превышено время ожидания ответа сервера');
    }
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error('Бекенд недоступен. Убедитесь, что сервер запущен на порту 3000');
    }
    
    // Если это уже наша ошибка с сообщением - пробрасываем как есть
    if (error.message && !error.message.includes('undefined')) {
      throw error;
    }
    
    console.error('API Error:', error);
    throw new Error('Произошла ошибка при выполнении запроса');
  }
}

// Авторизация
export const authAPI = {
  // Получить информацию о текущем пользователе
  getMe: () => apiRequest('/auth/me'),
};

// Категории
export const categoriesAPI = {
  getAll: () => apiRequest('/categories'),
  getById: (id) => apiRequest(`/categories/${id}`),
  create: (title, code, description) => apiRequest('/categories', {
    method: 'POST',
    body: JSON.stringify({ title, code, description }),
  }),
  update: (id, title, code, description) => apiRequest(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ title, code, description }),
  }),
  delete: (id) => apiRequest(`/categories/${id}`, {
    method: 'DELETE',
  }),
  createNominee: (categoryId, name, desc, role, imageUrl) => apiRequest(`/categories/${categoryId}/nominees`, {
    method: 'POST',
    body: JSON.stringify({ name, desc, role, imageUrl }),
  }),
  updateNominee: (categoryId, nomineeId, name, desc, role, imageUrl) => apiRequest(`/categories/${categoryId}/nominees/${nomineeId}`, {
    method: 'PUT',
    body: JSON.stringify({ name, desc, role, imageUrl }),
  }),
  deleteNominee: (categoryId, nomineeId) => apiRequest(`/categories/${categoryId}/nominees/${nomineeId}`, {
    method: 'DELETE',
  }),
};

// Голосование
export const votesAPI = {
  getMyVotes: () => apiRequest('/votes/my-votes'),
  submit: (votes) => apiRequest('/votes/submit', {
    method: 'POST',
    body: JSON.stringify({ votes }),
  }),
  getStats: (categoryId) => apiRequest(`/votes/stats/${categoryId}`),
  getAllStats: () => apiRequest('/votes/stats'),
};

// Админка
export const adminAPI = {
  verifyPassword: (password) => apiRequest('/admin/verify', {
    method: 'POST',
    body: JSON.stringify({ password }),
  }),
};

// Установка функции для получения токена (будет использоваться позже)
export function setAuthTokenGetter(fn) {
  getAuthToken = fn;
}

