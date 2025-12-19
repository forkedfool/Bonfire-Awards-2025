import React, { useState, useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { 
  Flame, Scroll, Shield, Sword, Crown, Feather, Lock, 
  Edit, Trash2, Plus, BarChart, Save, LogOut, ChevronRight, X 
} from 'lucide-react';
import { categoriesAPI, votesAPI, adminAPI, setAuthTokenGetter } from './api.js';
import { useAuth } from './AuthContext.jsx';
import { signIn, signOut } from './auth.js';
import Privacy from './Privacy.jsx';
import AuthCallback from './AuthCallback.jsx';

export default function BonfireAwardsApp() {
  // Auth
  const { user, isAuthenticated, isLoading: authLoading, accessToken } = useAuth();
  
  // State
  const [categories, setCategories] = useState([]);
  const [view, setView] = useState('landing'); // 'landing', 'voting', 'success', 'admin-login', 'admin-dashboard'
  const [votes, setVotes] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [adminPass, setAdminPass] = useState('');
  
  // Admin Editing State
  const [editingCategory, setEditingCategory] = useState(null);
  const [isEditingCategoryData, setIsEditingCategoryData] = useState(false);
  const [editingCategoryData, setEditingCategoryData] = useState({ title: '', code: '', description: '' });
  const [newNominee, setNewNominee] = useState({ name: '', desc: '', role: '', imageUrl: '' });
  
  // Category Creation State
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryTitle, setNewCategoryTitle] = useState('');
  const [newCategoryCode, setNewCategoryCode] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');

  // Vote Stats для админ-панели
  const [voteStats, setVoteStats] = useState({});

  // Настройка API и загрузка данных при монтировании
  useEffect(() => {
    // Настраиваем получение токена для API из OIDC
    setAuthTokenGetter(async () => {
      return accessToken;
    });

    if (!authLoading) {
      loadInitialData();
    }
  }, [accessToken, authLoading]);

  // Обработка callback после авторизации
  useEffect(() => {
    if (isAuthenticated && user && view === 'landing') {
      // После успешной авторизации автоматически переходим на голосование
      setView('voting');
    }
  }, [isAuthenticated, user, view]);

  async function loadInitialData() {
    try {
      setIsLoading(true);
      
      // Общий таймаут для всей загрузки (10 секунд)
      const loadTimeout = setTimeout(() => {
        console.warn('Таймаут загрузки данных - принудительное завершение');
        setIsLoading(false);
      }, 10000);
      
      // Загружаем категории (не блокируем, если бекенд недоступен)
      try {
        await loadCategories();
      } catch (error) {
        console.warn('Не удалось загрузить категории:', error);
        // Используем пустой массив, если не удалось загрузить
        setCategories([]);
      }
      
      // Загружаем голоса пользователя, если он авторизован
      try {
        await loadUserVotes();
      } catch (error) {
        console.warn('Не удалось загрузить голоса:', error);
      }
      
      clearTimeout(loadTimeout);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const data = await categoriesAPI.getAll();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Ошибка загрузки категорий:', error);
      throw error;
    }
  }

  async function loadUserVotes() {
    try {
      const data = await votesAPI.getMyVotes();
      // Обрабатываем новый формат ответа { success: true, votes: {...} }
      // или старый формат { votes: {...} }
      if (data && typeof data === 'object') {
        setVotes(data.votes || data || {});
      } else {
        setVotes({});
      }
    } catch (error) {
      console.warn('Не удалось загрузить голоса:', error);
      // Не критично, если пользователь не авторизован
    }
  }

  async function loadVoteStats() {
    try {
      const data = await votesAPI.getAllStats();
      const statsMap = {};
      
      // Обрабатываем новый формат ответа { success: true, stats: [...] }
      const stats = data.stats || (Array.isArray(data) ? data : []);
      
      if (Array.isArray(stats)) {
        stats.forEach(stat => {
          if (!statsMap[stat.category_id]) {
            statsMap[stat.category_id] = {};
          }
          statsMap[stat.category_id][stat.nominee_id] = stat.vote_count;
        });
      }
      
      setVoteStats(statsMap);
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
      throw error; // ВАЖНО: пробрасываем ошибку дальше для проверки прав доступа
    }
  }

  // Navigation Handlers
  const handleLogin = async () => {
    try {
      console.log('Нажата кнопка входа, начинаем процесс авторизации...');
      await signIn();
      // После успешного входа произойдет редирект на Bonfire, затем обратно
      // Если редирект не произошел, это нормально - он может быть асинхронным
    } catch (error) {
      console.error('Ошибка при входе:', error);
      alert('Ошибка входа: ' + (error.message || 'Неизвестная ошибка. Проверьте консоль для деталей.'));
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      alert('Ошибка выхода: ' + error.message);
    }
  };

  const handleVote = (catId, nomId) => {
    setVotes(prev => ({ ...prev, [catId]: nomId }));
  };

  const handleSubmit = async () => {
    try {
      await votesAPI.submit(votes);
      setView('success');
    } catch (error) {
      alert('Ошибка при отправке голосов: ' + error.message);
    }
  };

  // Admin Handlers
  const handleAdminLogin = async () => {
    if (!adminPass) {
      alert('Введите пароль');
      return;
    }
    
    try {
      // Проверяем пароль через бекенд
      const result = await adminAPI.verifyPassword(adminPass);
      
      // Проверяем результат
      if (result && result.success === false) {
        throw new Error(result.error || 'Неверный пароль');
      }
      
      // Если пароль верный, загружаем статистику и открываем админ-панель
      try {
        await loadVoteStats();
      } catch (statsError) {
        console.warn('Не удалось загрузить статистику:', statsError);
        // Продолжаем даже если статистика не загрузилась
      }
      
      setView('admin-dashboard');
      setAdminPass(''); // Очищаем пароль после успешного входа
    } catch (error) {
      console.error('Admin login error:', error);
      
      let errorMessage = 'Ошибка доступа';
      if (error.message.includes('403') || error.message.includes('Invalid') || error.message.includes('Неверный')) {
        errorMessage = 'Неверный пароль';
      } else if (error.message.includes('fetch failed') || error.message.includes('Failed to fetch')) {
        errorMessage = 'Сервер недоступен. Убедитесь, что сервер запущен.';
      } else {
        errorMessage = error.message || 'Ошибка доступа';
      }
      
      alert(errorMessage);
      setAdminPass('');
    }
  };

  const handleDeleteNominee = async (catId, nomId) => {
    try {
      await categoriesAPI.deleteNominee(catId, nomId);
      await loadCategories();
    } catch (error) {
      alert('Ошибка удаления номинанта: ' + error.message);
    }
  };

  const handleAddNominee = async (catId) => {
    if (!newNominee.name) return;
    try {
      await categoriesAPI.createNominee(
        catId,
        newNominee.name,
        newNominee.desc,
        newNominee.role,
        newNominee.imageUrl || null
      );
      setNewNominee({ name: '', desc: '', role: '', imageUrl: '' });
      await loadCategories();
    } catch (error) {
      alert('Ошибка добавления номинанта: ' + error.message);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryTitle.trim()) return;
    const code = newCategoryCode.trim() || `CAT_${Math.floor(Math.random() * 1000)}`;
    
    try {
      const result = await categoriesAPI.create(newCategoryTitle, code, newCategoryDescription);
      setNewCategoryTitle('');
      setNewCategoryCode('');
      setNewCategoryDescription('');
      setIsAddingCategory(false);
      await loadCategories();
      if (result.category) {
        setEditingCategory(result.category.id);
      }
    } catch (error) {
      alert('Ошибка добавления категории: ' + error.message);
    }
  };

  const handleUpdateCategory = async (categoryId) => {
    if (!editingCategoryData.title.trim() || !editingCategoryData.code.trim()) {
      alert('Название и код обязательны');
      return;
    }
    
    try {
      await categoriesAPI.update(categoryId, editingCategoryData.title, editingCategoryData.code, editingCategoryData.description);
      setIsEditingCategoryData(false);
      await loadCategories();
    } catch (error) {
      alert('Ошибка обновления категории: ' + error.message);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!confirm('Вы уверены, что хотите удалить эту категорию? Все номинанты и голоса будут удалены.')) {
      return;
    }
    
    try {
      await categoriesAPI.delete(categoryId);
      setEditingCategory(null);
      await loadCategories();
    } catch (error) {
      alert('Ошибка удаления категории: ' + error.message);
    }
  };

  // Получение количества голосов для номинанта (для админ-панели)
  const getVoteCount = (categoryId, nomineeId) => {
    if (!voteStats[categoryId] || !voteStats[categoryId][nomineeId]) {
      return 0;
    }
    return voteStats[categoryId][nomineeId];
  };

  // --- STYLES & ANIMATIONS ---
  const styles = {
    app: {
      backgroundColor: '#110F0E', // Very dark warm charcoal
      color: '#E8E6D1', // Parchment color
      minHeight: '100vh',
      fontFamily: '"Lato", sans-serif',
      overflowX: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }
  };

  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/auth/silent-callback" element={<AuthCallback />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/privacy/" element={<Privacy />} />
      <Route path="/" element={
        <div style={styles.app} className="selection:bg-[#FF5500] selection:text-white">
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Lato:wght@300;400;700&display=swap');
            
            .font-heading { font-family: 'Cinzel', serif; }
            .font-body { font-family: 'Lato', sans-serif; }
            
            /* Embers Animation */
            .ember {
              position: absolute;
              width: 4px;
              height: 4px;
              background: #FF5500;
              border-radius: 50%;
              opacity: 0;
              animation: rise 4s infinite linear;
              filter: blur(1px);
            }
            @keyframes rise {
              0% { transform: translateY(100vh) scale(1); opacity: 0; }
              20% { opacity: 0.8; }
              80% { opacity: 0.4; }
              100% { transform: translateY(-10vh) scale(0); opacity: 0; }
            }

            /* Flicker Effect for Text/Glows */
            .animate-flicker {
              animation: flicker 3s infinite alternate;
            }
            @keyframes flicker {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.85; }
              25% { opacity: 0.95; }
              75% { opacity: 0.9; }
            }

            /* Marquee */
            @keyframes marquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .animate-marquee {
              animation: marquee 30s linear infinite;
            }

            .border-medieval {
              border: 1px solid #3A3532;
              box-shadow: 0 0 0 1px #110F0E, 0 0 0 2px #3A3532;
            }
          `}</style>

          {/* BACKGROUND PARTICLES (Embers) */}
          <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-[#FF5500]/5 via-transparent to-transparent opacity-50"></div>
            {/* Generates random embers positions */}
            {[...Array(20)].map((_, i) => (
              <div key={i} className="ember" style={{
                left: `${Math.random() * 100}%`,
                animationDuration: `${3 + Math.random() * 4}s`,
                animationDelay: `${Math.random() * 2}s`
              }}></div>
            ))}
          </div>

          {/* NAVBAR */}
          <nav className="relative z-50 flex items-center justify-between px-6 py-6 border-b border-[#3A3532] bg-[#110F0E]/90 backdrop-blur-sm">
            <Link to="/" className="flex items-center gap-3 cursor-pointer group">
               <Flame className="text-[#FF5500] group-hover:animate-pulse" size={24} />
               <span className="font-heading font-bold tracking-widest text-lg">BONFIRE<span className="text-[#FF5500]">2025</span></span>
            </Link>
        
        <div className="flex items-center gap-4">
          {isAuthenticated && user?.profile && (
             <div className="flex items-center gap-3">
               <div className="flex items-center gap-2 text-xs font-heading text-[#8A8580] tracking-widest border border-[#3A3532] px-3 py-1">
                 <span className="w-1.5 h-1.5 bg-[#FF5500] rotate-45"></span>
                 {user.profile.preferred_username || user.profile.name || 'USER'}
               </div>
               <button 
                 onClick={handleLogout}
                 className="flex items-center gap-2 text-xs font-heading text-[#555] hover:text-[#FF5500] transition-colors border border-[#3A3532] hover:border-[#FF5500] px-3 py-1"
               >
                 <LogOut size={12} />
                 ВЫХОД
               </button>
             </div>
          )}
          {view === 'admin-dashboard' && (
             <div className="flex items-center gap-2 text-xs font-heading text-[#FF5500] border border-[#FF5500]/30 px-3 py-1 bg-[#FF5500]/5">
               <Crown size={12} />
               LORD'S PANEL
             </div>
          )}
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <div className="relative z-10 flex-grow flex flex-col">
        
        {/* === LOADING VIEW === */}
        {(isLoading || authLoading) && (
          <div className="flex items-center justify-center flex-grow">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5500] mx-auto mb-4"></div>
              <p className="text-[#8A8580] font-body">Загрузка...</p>
            </div>
          </div>
        )}

        {/* === LANDING === */}
        {!isLoading && !authLoading && view === 'landing' && (
          <header className="flex flex-col items-center justify-center flex-grow text-center px-4 py-20">
            
            {/* Center Symbol */}
            <div className="mb-12 relative">
               <div className="w-32 h-32 border border-[#FF5500] rotate-45 absolute top-0 left-0 animate-flicker opacity-20"></div>
               <div className="w-32 h-32 border border-[#FF5500] rotate-45 absolute top-0 left-0 scale-90 opacity-40"></div>
               <div className="w-32 h-32 flex items-center justify-center relative z-10">
                  <Flame size={64} className="text-[#FF5500] drop-shadow-[0_0_15px_rgba(255,85,0,0.5)] animate-flicker" />
               </div>
            </div>

            <div className="mb-8">
              <span className="px-4 py-2 border-y border-[#FF5500]/30 text-[#FF5500] text-xs font-heading tracking-[0.3em] uppercase">
                The Fire is Lit
              </span>
            </div>

            <h1 className="text-5xl md:text-8xl font-bold uppercase tracking-tight leading-none mb-8 font-heading text-[#E8E6D1]">
              Bonfire <br />
              <span className="text-[#FF5500] animate-flicker">Awards</span>
            </h1>

            <p className="max-w-lg text-[#8A8580] text-lg font-body font-light leading-relaxed mb-16 italic">
              "Gather 'round the fire. Cast your stones. <br/>
              Honor the legends of our realm."
            </p>

            {isAuthenticated ? (
              <button 
                onClick={() => setView('voting')}
                className="group relative px-12 py-5 bg-transparent border border-[#FF5500] text-[#FF5500] font-heading font-bold uppercase tracking-widest hover:bg-[#FF5500] hover:text-[#110F0E] transition-all duration-300"
              >
                <div className="flex items-center gap-3">
                  <Scroll size={20} />
                  Начать голосование
                </div>
              </button>
            ) : (
              <button 
                onClick={handleLogin}
                className="group relative px-12 py-5 bg-transparent border border-[#555] text-[#E8E6D1] font-heading font-bold uppercase tracking-widest hover:border-[#FF5500] hover:text-[#FF5500] transition-all duration-300"
              >
                <div className="flex items-center gap-3">
                  <Scroll size={20} />
                  Войти через Bonfire
                </div>
              </button>
            )}
          </header>
        )}

        {/* === VOTING === */}
        {!isLoading && !authLoading && view === 'voting' && (
          !isAuthenticated ? (
            <div className="flex flex-col items-center justify-center flex-grow text-center px-4">
              <div className="mb-8 p-6 border-2 border-[#FF5500] rounded-full">
                <Lock size={48} className="text-[#FF5500]" />
              </div>
              <h2 className="text-4xl font-heading font-bold uppercase mb-4 text-[#E8E6D1]">
                Требуется авторизация
              </h2>
              <p className="text-[#8A8580] font-body mb-8">
                Войдите через Bonfire, чтобы продолжить голосование.
              </p>
              <button 
                onClick={handleLogin}
                className="px-8 py-3 bg-transparent border border-[#FF5500] text-[#FF5500] font-heading font-bold uppercase tracking-widest hover:bg-[#FF5500] hover:text-[#110F0E] transition-all duration-300"
              >
                Войти через Bonfire
              </button>
            </div>
          ) : (
          <main className="container mx-auto px-4 py-16 max-w-5xl">
            <div className="text-center mb-20">
              <h2 className="text-4xl font-heading font-bold uppercase mb-4 text-[#E8E6D1]">The Chronicles</h2>
              <div className="h-px w-24 bg-[#FF5500] mx-auto"></div>
            </div>

            <div className="space-y-32">
              {categories.length === 0 ? (
                <div className="text-center py-20 text-[#8A8580]">
                  <p>Категории пока не добавлены</p>
                </div>
              ) : (
                categories.map((cat, idx) => (
                <div key={cat.id} className="relative">
                  {/* Decorative number */}
                  <div className="absolute -left-4 -top-10 text-9xl font-heading text-[#1A1817] -z-10 select-none">
                    {idx + 1}
                  </div>

                  <div className="flex flex-col items-center mb-12">
                     <span className="text-[#FF5500] font-heading text-xs tracking-[0.2em] mb-2 uppercase">{cat.code || cat.subtitle || 'CATEGORY'}</span>
                     <h3 className="text-3xl md:text-5xl font-heading text-[#E8E6D1]">{cat.title}</h3>
                     {cat.description && (
                       <p className="text-[#8A8580] text-sm font-body font-light italic mt-4 max-w-2xl text-center">
                         {cat.description}
                       </p>
                     )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {cat.nominees.map((nom) => {
                      const isSelected = votes[cat.id] === nom.id;
                      return (
                        <div 
                          key={nom.id}
                          onClick={() => handleVote(cat.id, nom.id)}
                          className={`
                            relative p-8 cursor-pointer transition-all duration-500 group
                            ${isSelected 
                              ? 'bg-[#1A1817] border border-[#FF5500] shadow-[0_0_30px_rgba(255,85,0,0.1)]' 
                              : 'bg-transparent border border-[#3A3532] hover:border-[#8A8580]'
                            }
                          `}
                        >
                           {/* Selection Mark (Seal) */}
                           <div className={`
                             absolute -top-3 -right-3 w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-300
                             ${isSelected ? 'bg-[#FF5500] border-[#FF5500] text-[#110F0E]' : 'bg-[#110F0E] border-[#3A3532] text-transparent'}
                           `}>
                             <Feather size={14} />
                           </div>

                           {/* Image or placeholder */}
                           {nom.imageUrl ? (
                             <div className="w-full aspect-video bg-black border border-[#3A3532] mb-6 relative overflow-hidden">
                               <img
                                 src={nom.imageUrl}
                                 alt={nom.name}
                                 className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                               />
                             </div>
                           ) : (
                             <div className="flex flex-col items-center text-center mb-6">
                                <div className={`mb-6 p-4 rounded-full border ${isSelected ? 'border-[#FF5500] text-[#FF5500]' : 'border-[#3A3532] text-[#555]'}`}>
                                   <Shield size={32} />
                                </div>
                             </div>
                           )}

                           <div className="flex flex-col items-center text-center">
                              <div className="mb-4">
                                 <span className="text-[10px] font-heading text-[#8A8580] tracking-widest uppercase border-b border-[#3A3532] pb-1">
                                   {nom.role}
                                 </span>
                              </div>
                              
                              <h4 className={`font-heading text-xl mb-3 ${isSelected ? 'text-[#E8E6D1]' : 'text-[#AAA]'}`}>
                                {nom.name}
                              </h4>
                              
                              <p className="text-[#666] text-sm font-body font-light italic leading-relaxed">
                                "{nom.desc}"
                              </p>
                           </div>
                        </div>
                      )
                    })}
                    
                    {/* Abstain / Skip */}
                    <div 
                      onClick={() => handleVote(cat.id, 'skip')}
                      className={`
                        border border-dashed border-[#3A3532] p-8 flex flex-col items-center justify-center cursor-pointer opacity-50 hover:opacity-100 transition-all
                        ${votes[cat.id] === 'skip' ? 'border-[#E8E6D1] opacity-100' : ''}
                      `}
                    >
                       <span className="font-heading text-sm text-[#8A8580] uppercase mb-2">Abstain</span>
                       <span className="text-[10px] font-body text-[#555]">Pass judgment later</span>
                    </div>
                  </div>
                </div>
                ))
              )}
            </div>

            {/* Submit UI */}
            <div className={`fixed bottom-12 left-0 right-0 flex justify-center pointer-events-none transition-all duration-500 ${Object.keys(votes).length > 0 ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
              <button 
                onClick={handleSubmit}
                className="pointer-events-auto bg-[#FF5500] text-[#110F0E] font-heading font-bold uppercase tracking-widest text-lg px-12 py-4 hover:bg-[#E8E6D1] transition-colors shadow-lg shadow-[#FF5500]/20 flex items-center gap-4"
              >
                <span>Seal the Votes ({Object.keys(votes).length})</span>
                <Feather size={18} />
              </button>
            </div>
          </main>
          )
        )}

        {/* === SUCCESS === */}
        {view === 'success' && (
          <div className="flex flex-col items-center justify-center flex-grow text-center px-4">
             <div className="mb-8 p-6 border-2 border-[#FF5500] rounded-full animate-pulse">
                <Flame size={48} className="text-[#FF5500]" />
             </div>
             
             <h2 className="text-4xl md:text-6xl font-heading font-bold uppercase text-[#E8E6D1] mb-6">
               Fate Sealed
             </h2>
             <p className="text-[#8A8580] font-body italic mb-12">
               Your judgment has been recorded in the archives.
             </p>
             
             <button 
               onClick={() => setView('landing')}
               className="text-[#FF5500] hover:text-[#E8E6D1] font-heading text-sm uppercase tracking-widest transition-colors border-b border-transparent hover:border-[#E8E6D1]"
             >
               Return to Bonfire
             </button>
          </div>
        )}

        {/* === ADMIN LOGIN === */}
        {view === 'admin-login' && (
          <div className="flex flex-col items-center justify-center flex-grow px-4">
             <div className="w-full max-w-sm p-12 border border-[#3A3532] bg-[#0E0D0C]">
               <div className="flex justify-center mb-8">
                 <Lock className="text-[#FF5500]" size={32} />
               </div>
               <h2 className="text-xl font-heading text-center mb-8 text-[#E8E6D1] tracking-widest uppercase">Keeper Access</h2>
               <input 
                 type="password"
                 placeholder="Secret Phrase"
                 className="w-full bg-[#1A1817] border border-[#3A3532] p-4 text-center font-heading text-[#E8E6D1] focus:outline-none focus:border-[#FF5500] mb-8 placeholder-[#3A3532]"
                 value={adminPass}
                 onChange={(e) => setAdminPass(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
               />
               <button onClick={handleAdminLogin} className="w-full bg-[#3A3532] hover:bg-[#FF5500] hover:text-[#110F0E] text-[#E8E6D1] font-heading text-xs uppercase py-4 transition-colors tracking-widest">
                 Enter
               </button>
               <button onClick={() => setView('landing')} className="w-full mt-4 text-[#555] hover:text-[#888] text-[10px] font-heading uppercase">
                 Depart
               </button>
             </div>
          </div>
        )}

        {/* === ADMIN DASHBOARD === */}
        {view === 'admin-dashboard' && (
          <main className="container mx-auto px-4 py-16 max-w-6xl">
            <div className="flex justify-between items-end mb-12 border-b border-[#3A3532] pb-6">
               <div>
                  <h2 className="text-2xl font-heading font-bold uppercase text-[#E8E6D1] mb-2">The Archives</h2>
                  <p className="text-[#555] font-heading text-xs tracking-widest">MANAGE THE REALM</p>
               </div>
               <button onClick={() => setView('landing')} className="flex items-center gap-2 text-red-900 hover:text-red-500 font-heading text-xs border border-red-900/30 px-4 py-2">
                 <LogOut size={12} /> LEAVE
               </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              <div className="lg:col-span-1 space-y-2">
                 <h3 className="text-[#FF5500] font-heading text-xs uppercase tracking-widest mb-6">Chapters</h3>
                 {categories.map(cat => (
                   <div 
                     key={cat.id}
                     onClick={() => {
                       setEditingCategory(cat.id);
                       setIsEditingCategoryData(false);
                       setEditingCategoryData({
                         title: cat.title,
                         code: cat.code || '',
                         description: cat.description || ''
                       });
                     }}
                     className={`p-4 border cursor-pointer transition-all flex justify-between items-center ${editingCategory === cat.id ? 'border-[#FF5500] bg-[#FF5500]/5 text-[#E8E6D1]' : 'border-[#3A3532] hover:border-[#888] text-[#888]'}`}
                   >
                     <span className="font-heading text-sm">{cat.title}</span>
                     <ChevronRight size={14} />
                   </div>
                 ))}
                 
                 {isAddingCategory ? (
                   <div className="p-4 border border-[#FF5500]">
                      <input 
                        autoFocus placeholder="TITLE"
                        className="w-full bg-transparent border-b border-[#555] p-2 text-xs text-[#E8E6D1] mb-4 outline-none font-heading uppercase"
                        value={newCategoryTitle}
                        onChange={(e) => setNewCategoryTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                      />
                      <input 
                        placeholder="CODE (optional)"
                        className="w-full bg-transparent border-b border-[#555] p-2 text-xs text-[#E8E6D1] mb-4 outline-none font-mono"
                        value={newCategoryCode}
                        onChange={(e) => setNewCategoryCode(e.target.value)}
                      />
                      <textarea 
                        placeholder="Description (optional)"
                        className="w-full bg-transparent border-b border-[#555] p-2 text-xs text-[#E8E6D1] mb-4 outline-none font-body resize-none"
                        rows="2"
                        value={newCategoryDescription}
                        onChange={(e) => setNewCategoryDescription(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button onClick={handleAddCategory} className="flex-1 bg-[#FF5500] text-[#110F0E] text-[10px] font-bold py-2 hover:bg-[#E8E6D1]">ADD</button>
                        <button onClick={() => {
                          setIsAddingCategory(false);
                          setNewCategoryTitle('');
                          setNewCategoryCode('');
                          setNewCategoryDescription('');
                        }} className="flex-1 border border-[#555] text-[#555] text-[10px] py-2 hover:text-[#E8E6D1]">CANCEL</button>
                      </div>
                   </div>
                 ) : (
                   <div onClick={() => setIsAddingCategory(true)} className="p-4 border border-dashed border-[#3A3532] text-[#555] hover:text-[#FF5500] hover:border-[#FF5500] text-center font-heading text-xs cursor-pointer transition-colors mt-4">
                      + NEW CHAPTER
                   </div>
                 )}
              </div>

              <div className="lg:col-span-2">
                 {editingCategory ? (
                   <div className="bg-[#161413] border border-[#3A3532] p-8">
                      {(() => {
                        const cat = categories.find(c => c.id === editingCategory);
                        return (
                          <>
                            <div className="flex justify-between items-start mb-10">
                               {isEditingCategoryData ? (
                                 <div className="flex-1 space-y-3">
                                   <input
                                     placeholder="Category Title"
                                     className="w-full bg-[#110F0E] border border-[#3A3532] p-2 text-sm text-[#E8E6D1] focus:border-[#FF5500] outline-none font-heading uppercase"
                                     value={editingCategoryData.title}
                                     onChange={(e) => setEditingCategoryData({...editingCategoryData, title: e.target.value})}
                                   />
                                   <input
                                     placeholder="Code"
                                     className="w-full bg-[#110F0E] border border-[#3A3532] p-2 text-sm text-[#E8E6D1] focus:border-[#FF5500] outline-none font-mono"
                                     value={editingCategoryData.code}
                                     onChange={(e) => setEditingCategoryData({...editingCategoryData, code: e.target.value})}
                                   />
                                   <textarea
                                     placeholder="Description (optional)"
                                     className="w-full bg-[#110F0E] border border-[#3A3532] p-2 text-sm text-[#E8E6D1] focus:border-[#FF5500] outline-none font-body resize-none"
                                     rows="2"
                                     value={editingCategoryData.description}
                                     onChange={(e) => setEditingCategoryData({...editingCategoryData, description: e.target.value})}
                                   />
                                   <div className="flex gap-2">
                                     <button
                                       onClick={() => handleUpdateCategory(cat.id)}
                                       className="flex-1 bg-[#FF5500] text-[#110F0E] text-xs font-bold py-2 hover:bg-[#E8E6D1]"
                                     >
                                       SAVE
                                     </button>
                                     <button
                                       onClick={() => {
                                         setIsEditingCategoryData(false);
                                         setEditingCategoryData({ title: '', code: '', description: '' });
                                       }}
                                       className="flex-1 border border-[#3A3532] text-[#555] text-xs py-2 hover:text-[#E8E6D1]"
                                     >
                                       CANCEL
                                     </button>
                                   </div>
                                 </div>
                               ) : (
                                 <>
                                   <div>
                                     <span className="text-[#555] font-heading text-[10px] tracking-[0.2em] uppercase block mb-2">{cat.code || cat.subtitle || 'CATEGORY'}</span>
                                     <h3 className="text-2xl font-heading text-[#E8E6D1]">{cat.title}</h3>
                                     {cat.description && (
                                       <p className="text-[#8A8580] text-sm font-body mt-2">{cat.description}</p>
                                     )}
                                   </div>
                                   <div className="flex gap-2">
                                      <button 
                                        onClick={() => {
                                          setEditingCategoryData({
                                            title: cat.title,
                                            code: cat.code || '',
                                            description: cat.description || ''
                                          });
                                          setIsEditingCategoryData(true);
                                        }}
                                        className="p-2 border border-[#3A3532] text-[#555] hover:text-[#E8E6D1] hover:border-[#E8E6D1]"
                                        title="Edit Category"
                                      >
                                        <Edit size={16} />
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteCategory(cat.id)}
                                        className="p-2 border border-red-900/30 text-red-900 hover:text-red-500 hover:bg-red-500/10"
                                        title="Delete Category"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                   </div>
                                 </>
                               )}
                            </div>

                            <div className="space-y-4 mb-10">
                               {cat.nominees.map(nom => {
                                 const votesCount = getVoteCount(cat.id, nom.id);
                                 return (
                                   <div key={nom.id} className="border border-[#3A3532] p-4 flex justify-between items-center group hover:border-[#555] transition-colors">
                                      <div className="flex-grow">
                                         <div className="flex items-center gap-3 mb-2">
                                            <span className="font-heading font-bold text-[#E8E6D1]">{nom.name}</span>
                                            <span className="text-[9px] font-heading bg-[#222] px-2 py-0.5 text-[#888] tracking-wider">{nom.role}</span>
                                         </div>
                                         <div className="flex items-center gap-3">
                                            <div className="h-1 w-32 bg-[#222]">
                                               <div className="h-full bg-[#FF5500]" style={{width: `${Math.min(votesCount, 100)}%`}}></div>
                                            </div>
                                            <span className="text-xs font-heading text-[#FF5500]">{votesCount}</span>
                                         </div>
                                      </div>
                                      <button onClick={() => handleDeleteNominee(cat.id, nom.id)} className="text-[#555] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                        <Trash2 size={16} />
                                      </button>
                                   </div>
                                 );
                               })}
                            </div>

                            <div className="border border-[#3A3532] p-6 bg-[#110F0E]">
                               <h4 className="text-xs font-heading text-[#888] uppercase mb-6 tracking-widest">Scribe New Entry</h4>
                               <div className="grid grid-cols-2 gap-6 mb-6">
                                  <input placeholder="Name" className="bg-transparent border-b border-[#3A3532] py-2 text-sm text-[#E8E6D1] focus:border-[#FF5500] outline-none font-heading" value={newNominee.name} onChange={(e) => setNewNominee({...newNominee, name: e.target.value})} />
                                  <input placeholder="Title/Role" className="bg-transparent border-b border-[#3A3532] py-2 text-sm text-[#E8E6D1] focus:border-[#FF5500] outline-none font-heading" value={newNominee.role} onChange={(e) => setNewNominee({...newNominee, role: e.target.value})} />
                               </div>
                               <input placeholder="Image URL (optional)" className="w-full bg-transparent border-b border-[#3A3532] py-2 text-sm text-[#E8E6D1] focus:border-[#FF5500] outline-none mb-6 font-body" value={newNominee.imageUrl} onChange={(e) => setNewNominee({...newNominee, imageUrl: e.target.value})} />
                               <input placeholder="Legend (Description)" className="w-full bg-transparent border-b border-[#3A3532] py-2 text-sm text-[#E8E6D1] focus:border-[#FF5500] outline-none mb-6 font-body" value={newNominee.desc} onChange={(e) => setNewNominee({...newNominee, desc: e.target.value})} />
                               <button onClick={() => handleAddNominee(cat.id)} className="w-full bg-[#333] hover:bg-[#FF5500] hover:text-[#110F0E] text-[#E8E6D1] font-heading text-xs uppercase py-3 transition-colors flex items-center justify-center gap-2 tracking-widest">
                                 <Plus size={14} /> Inscribe
                               </button>
                            </div>
                          </>
                        );
                      })()}
                   </div>
                 ) : (
                   <div className="h-full flex flex-col items-center justify-center border border-dashed border-[#3A3532] text-[#3A3532] font-heading min-h-[400px]">
                      <BarChart size={48} className="mb-4 opacity-20" />
                      <p className="text-xs tracking-[0.2em]">SELECT A CHRONICLE</p>
                   </div>
                 )}
              </div>
            </div>
          </main>
        )}
      </div>

      {/* FOOTER */}
      <footer className="relative z-20 bg-[#0E0D0C] border-t border-[#3A3532] pb-12">
         {/* Marquee */}
         <div className="overflow-hidden border-b border-[#3A3532] py-3 bg-[#161413]">
           <div className="animate-marquee whitespace-nowrap font-heading text-xs text-[#555] flex gap-16 tracking-[0.2em] uppercase">
             <span>Bonfire Awards 2025</span>
             <Sword size={12} className="text-[#FF5500]" />
             <span>The Night is Dark</span>
             <Sword size={12} className="text-[#FF5500]" />
             <span>History is Written by You</span>
             <Sword size={12} className="text-[#FF5500]" />
             <span>Bonfire Awards 2025</span>
           </div>
         </div>

         <div className="container mx-auto px-6 pt-12 flex flex-col md:flex-row justify-between items-end gap-8">
            <div>
               <div className="flex items-center gap-3 mb-4">
                  <Flame size={20} className="text-[#FF5500]" />
                  <span className="font-heading font-bold text-[#E8E6D1] tracking-widest">BONFIRE</span>
               </div>
               <p className="text-[#555] text-xs font-body max-w-xs leading-relaxed">
                  A minimalist celebration of our server's history. <br/>
                  No neon. No noise. Only the flame.
               </p>
            </div>
            
            <div className="flex flex-col items-end gap-4">
               <Link to="/privacy/" className="flex items-center gap-2 text-[#333] hover:text-[#FF5500] transition-colors">
                  <span className="text-[10px] font-heading uppercase tracking-widest">Privacy Policy</span>
                  <Shield size={12} />
               </Link>
               <button onClick={() => setView('admin-login')} className="flex items-center gap-2 text-[#333] hover:text-[#FF5500] transition-colors">
                  <span className="text-[10px] font-heading uppercase tracking-widest">Keeper Login</span>
                  <Lock size={12} />
               </button>
               <div className="text-[#333] text-[10px] font-heading tracking-widest">
                  EST. 2025
               </div>
            </div>
         </div>
      </footer>
        </div>
      } />
    </Routes>
  );
}

