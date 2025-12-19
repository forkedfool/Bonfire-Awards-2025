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
    const response = await fetchWithTimeout(url, config, API_TIMEOUT);
    
    // Если ответ не JSON
    let data;
    try {
      data = await response.json();
    } catch (e) {
      throw new Error('Сервер недоступен или вернул неверный ответ');
    }
    
    if (!response.ok) {
      throw new Error(data.error || 'Ошибка запроса');
    }
    
    return data;
  } catch (error) {
    if (error.message.includes('Таймаут запроса')) {
      throw new Error('Превышено время ожидания ответа сервера');
    }
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error('Бекенд недоступен. Убедитесь, что сервер запущен на порту 3000');
    }
    console.error('API Error:', error);
    throw error;
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

