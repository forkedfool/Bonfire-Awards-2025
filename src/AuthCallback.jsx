import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleCallback } from './auth.js';
import { useAuth } from './AuthContext.jsx';
import { Flame } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { loadUser } = useAuth();
  const processedRef = useRef(false);

  useEffect(() => {
    // Защита от повторного вызова (React StrictMode вызывает useEffect дважды)
    if (processedRef.current) {
      console.log('Callback уже обработан, пропускаем повторный вызов');
      return;
    }

    async function processCallback() {
      if (processedRef.current) {
        return;
      }
      processedRef.current = true;

      try {
        const user = await handleCallback();
        // Перезагружаем пользователя после успешного callback
        await loadUser();
        
        // Выводим информацию об аккаунте после успешной авторизации
        if (user && user.profile) {
          console.log('=== УСПЕШНАЯ АВТОРИЗАЦИЯ ===');
          console.log('User ID (sub):', user.profile.sub);
          console.log('Email:', user.profile.email || 'не указан');
          console.log('Username:', user.profile.preferred_username || user.profile.name || 'не указан');
          console.log('Access Token:', user.access_token ? `${user.access_token.substring(0, 20)}... (${user.access_token.length} символов)` : 'отсутствует');
          console.log('\n📋 Для добавления в админы, добавьте в .env на сервере:');
          console.log(`ADMIN_USER_IDS=${user.profile.sub}`);
          console.log('================================');
        }
        
        // Небольшая задержка для обновления состояния
        setTimeout(() => {
          navigate('/');
        }, 100);
      } catch (error) {
        console.error('Ошибка обработки callback:', error);
        // В случае ошибки тоже перенаправляем на главную
        navigate('/');
      }
    }

    processCallback();
  }, [navigate, loadUser]);

  return (
    <div className="min-h-screen bg-[#110F0E] text-[#E8E6D1] flex items-center justify-center">
      <div className="text-center">
        <div className="mb-8 p-6 border-2 border-[#FF5500] rounded-full animate-pulse mx-auto w-fit">
          <Flame size={48} className="text-[#FF5500]" />
        </div>
        <h2 className="text-2xl font-heading text-[#E8E6D1] mb-4">
          Завершение авторизации...
        </h2>
        <p className="text-[#8A8580] font-body">
          Пожалуйста, подождите
        </p>
      </div>
    </div>
  );
}

