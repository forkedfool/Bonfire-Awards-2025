import React from 'react';
import { Flame, Shield, Lock, Eye, FileText, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#110F0E] text-[#E8E6D1] w-full">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Lato:wght@300;400;700&display=swap');
        .font-heading { font-family: 'Cinzel', serif; }
        .font-body { font-family: 'Lato', sans-serif; }
      `}</style>

      {/* NAVBAR */}
      <nav className="flex items-center justify-between px-6 py-6 border-b border-[#3A3532] bg-[#110F0E]/90 backdrop-blur-sm">
        <div 
          className="flex items-center gap-3 cursor-pointer group" 
          onClick={() => navigate('/')}
        >
          <Flame className="text-[#FF5500] group-hover:animate-pulse" size={24} />
          <span className="font-heading font-bold tracking-widest text-lg">
            BONFIRE<span className="text-[#FF5500]">2025</span>
          </span>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="p-4 border border-[#FF5500] rounded-full">
              <Shield className="text-[#FF5500]" size={32} />
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-heading font-bold uppercase mb-4 text-[#E8E6D1]">
            Политика конфиденциальности
          </h1>
          <div className="h-px w-24 bg-[#FF5500] mx-auto"></div>
        </div>

        <div className="space-y-8 font-body text-[#8A8580] leading-relaxed">
          <section>
            <h2 className="text-2xl font-heading text-[#E8E6D1] mb-4 flex items-center gap-3">
              <Lock size={20} className="text-[#FF5500]" />
              1. Общие положения
            </h2>
            <p className="mb-4">
              Настоящая Политика конфиденциальности определяет порядок обработки и защиты персональных данных 
              пользователей веб-приложения Bonfire Awards 2025 (далее — "Приложение").
            </p>
            <p>
              Используя Приложение, вы соглашаетесь с условиями настоящей Политики конфиденциальности.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-heading text-[#E8E6D1] mb-4 flex items-center gap-3">
              <Eye size={20} className="text-[#FF5500]" />
              2. Собираемые данные
            </h2>
            <p className="mb-4">
              При использовании Приложения мы можем собирать следующую информацию:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Данные, необходимые для участия в голосовании</li>
              <li>Информация о ваших голосах и предпочтениях</li>
              <li>Технические данные (IP-адрес, тип браузера, операционная система)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-heading text-[#E8E6D1] mb-4 flex items-center gap-3">
              <FileText size={20} className="text-[#FF5500]" />
              3. Использование данных
            </h2>
            <p className="mb-4">
              Собранные данные используются исключительно для:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Обеспечения функционирования системы голосования</li>
              <li>Подсчета результатов голосования</li>
              <li>Улучшения работы Приложения</li>
              <li>Предотвращения мошенничества и злоупотреблений</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-heading text-[#E8E6D1] mb-4 flex items-center gap-3">
              <Shield size={20} className="text-[#FF5500]" />
              4. Защита данных
            </h2>
            <p>
              Мы применяем современные методы защиты данных для обеспечения безопасности вашей информации. 
              Все данные хранятся в зашифрованном виде и доступны только авторизованным администраторам.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-heading text-[#E8E6D1] mb-4 flex items-center gap-3">
              <Lock size={20} className="text-[#FF5500]" />
              5. Передача данных третьим лицам
            </h2>
            <p>
              Мы не передаем ваши персональные данные третьим лицам, за исключением случаев, 
              предусмотренных законодательством или когда это необходимо для функционирования Приложения.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-heading text-[#E8E6D1] mb-4 flex items-center gap-3">
              <FileText size={20} className="text-[#FF5500]" />
              6. Ваши права
            </h2>
            <p className="mb-4">
              Вы имеете право:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Получать информацию о ваших персональных данных</li>
              <li>Требовать исправления неточных данных</li>
              <li>Требовать удаления ваших данных</li>
              <li>Отозвать согласие на обработку данных</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-heading text-[#E8E6D1] mb-4 flex items-center gap-3">
              <FileText size={20} className="text-[#FF5500]" />
              7. Изменения в Политике конфиденциальности
            </h2>
            <p>
              Мы оставляем за собой право вносить изменения в настоящую Политику конфиденциальности. 
              О существенных изменениях мы уведомим пользователей через Приложение.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-heading text-[#E8E6D1] mb-4 flex items-center gap-3">
              <FileText size={20} className="text-[#FF5500]" />
              8. Контакты
            </h2>
            <p className="mb-4">
              По всем вопросам, связанным с обработкой персональных данных, вы можете обращаться 
              к администраторам Приложения.
            </p>
            <div className="flex items-center gap-3 text-[#E8E6D1]">
              <Mail size={18} className="text-[#FF5500]" />
              <a 
                href="mailto:trelesco@gmail.com" 
                className="hover:text-[#FF5500] transition-colors underline"
              >
                trelesco@gmail.com
              </a>
            </div>
          </section>
        </div>

        <div className="mt-16 text-center">
          <button
            onClick={() => navigate('/')}
            className="px-8 py-3 bg-transparent border border-[#555] text-[#E8E6D1] font-heading font-bold uppercase tracking-widest hover:border-[#FF5500] hover:text-[#FF5500] transition-all duration-300"
          >
            Вернуться на главную
          </button>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-[#0E0D0C] border-t border-[#3A3532] py-8 mt-16">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Flame size={20} className="text-[#FF5500]" />
            <span className="font-heading font-bold text-[#E8E6D1] tracking-widest">BONFIRE</span>
          </div>
          <p className="text-[#555] text-xs font-body">
            EST. 2025
          </p>
        </div>
      </footer>
    </div>
  );
}

