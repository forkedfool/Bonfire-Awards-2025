import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleCallback } from './auth.js';
import { Flame } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    async function processCallback() {
      try {
        await handleCallback();
        // После успешной обработки callback перенаправляем на главную
        navigate('/');
      } catch (error) {
        console.error('Ошибка обработки callback:', error);
        // В случае ошибки тоже перенаправляем на главную
        navigate('/');
      }
    }

    processCallback();
  }, [navigate]);

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

