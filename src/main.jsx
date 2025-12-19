import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './AuthContext.jsx'
import App from './App.jsx'
import './index.css'

// Обработка ошибок при загрузке
window.addEventListener('error', (event) => {
  console.error('Глобальная ошибка:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Необработанное отклонение промиса:', event.reason);
});

try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>,
  )
} catch (error) {
  console.error('Критическая ошибка при рендеринге:', error);
  document.getElementById('root').innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: #110F0E; color: #E8E6D1; font-family: sans-serif; padding: 20px; text-align: center;">
      <div>
        <h1 style="color: #FF5500; margin-bottom: 20px;">Ошибка загрузки приложения</h1>
        <p style="color: #8A8580; margin-bottom: 10px;">${error.message}</p>
        <p style="color: #555; font-size: 12px;">Откройте консоль браузера (F12) для деталей</p>
      </div>
    </div>
  `;
}

