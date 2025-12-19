import express from 'express';
import { verifyBonfireToken } from '../middleware/auth.js';
import { supabase, TABLES } from '../db/supabase.js';

const router = express.Router();

// Получить все категории с номинантами (публичный endpoint)
router.get('/categories', async (req, res) => {
  try {
    const { data: categories, error: categoriesError } = await supabase
      .from(TABLES.CATEGORIES)
      .select('*')
      .order('name');

    if (categoriesError) {
      console.error('Supabase categories error:', categoriesError);
      throw new Error(`Database error: ${categoriesError.message || 'Unknown error'}`);
    }

    if (!categories || categories.length === 0) {
      return res.json({ 
        success: true,
        categories: [] 
      });
    }

    // Получаем номинантов для каждой категории
    const categoriesWithNominees = await Promise.all(
      categories.map(async (category) => {
        try {
          const { data: categoryNominees, error: cnError } = await supabase
            .from(TABLES.CATEGORY_NOMINEES)
            .select(`
              nominee:nominees (
                id,
                name,
                description,
                image_url
              )
            `)
            .eq('category_id', category.id);

          if (cnError) {
            console.error(`Error fetching nominees for category ${category.id}:`, cnError);
            // Возвращаем категорию без номинантов вместо ошибки
            return {
              ...category,
              nominees: [],
            };
          }

          return {
            ...category,
            nominees: (categoryNominees || []).map((cn) => cn.nominee).filter(Boolean),
          };
        } catch (catError) {
          console.error(`Error processing category ${category.id}:`, catError);
          // Возвращаем категорию без номинантов
          return {
            ...category,
            nominees: [],
          };
        }
      })
    );

    res.json({ 
      success: true,
      categories: categoriesWithNominees 
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to fetch categories',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// Проголосовать (требует аутентификации)
// Поддерживаем оба эндпоинта для обратной совместимости
router.post('/vote', verifyBonfireToken, async (req, res) => {
  try {
    const { category_id, nominee_id } = req.body;
    const userId = req.user.id;

    if (!category_id || !nominee_id) {
      return res.status(400).json({ 
        success: false,
        error: 'category_id and nominee_id are required' 
      });
    }

    // Проверяем, что номинант принадлежит категории
    const { data: relation, error: relationError } = await supabase
      .from(TABLES.CATEGORY_NOMINEES)
      .select('*')
      .eq('category_id', category_id)
      .eq('nominee_id', nominee_id)
      .single();

    if (relationError || !relation) {
      return res.status(400).json({ error: 'Invalid category-nominee combination' });
    }

    // Проверяем, не голосовал ли уже пользователь в этой категории
    const { data: existingVote, error: checkError } = await supabase
      .from(TABLES.VOTES)
      .select('*')
      .eq('user_id', userId)
      .eq('category_id', category_id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existingVote) {
      // Обновляем существующий голос
      const { data, error } = await supabase
        .from(TABLES.VOTES)
        .update({ nominee_id, updated_at: new Date().toISOString() })
        .eq('id', existingVote.id)
        .select()
        .single();

      if (error) throw error;
      return res.json({ message: 'Vote updated', vote: data });
    }

    // Создаем новый голос
    const { data, error } = await supabase
      .from(TABLES.VOTES)
      .insert({
        user_id: userId,
        category_id,
        nominee_id,
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ 
      success: true,
      message: 'Vote recorded', 
      vote: data 
    });
  } catch (error) {
    console.error('Error voting:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Альтернативный эндпоинт для отправки голосов (массовое голосование)
router.post('/submit', verifyBonfireToken, async (req, res) => {
  try {
    const { votes } = req.body;
    const userId = req.user.id;

    if (!votes || typeof votes !== 'object') {
      return res.status(400).json({ 
        success: false,
        error: 'votes object is required' 
      });
    }

    const voteEntries = Object.entries(votes);
    if (voteEntries.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'At least one vote is required' 
      });
    }

    const results = [];
    const errors = [];

    // Обрабатываем каждый голос
    for (const [categoryId, nomineeId] of voteEntries) {
      try {
        // Проверяем, что номинант принадлежит категории
        const { data: relation, error: relationError } = await supabase
          .from(TABLES.CATEGORY_NOMINEES)
          .select('*')
          .eq('category_id', categoryId)
          .eq('nominee_id', nomineeId)
          .single();

        if (relationError || !relation) {
          errors.push({ categoryId, error: 'Invalid category-nominee combination' });
          continue;
        }

        // Проверяем, не голосовал ли уже пользователь в этой категории
        const { data: existingVote, error: checkError } = await supabase
          .from(TABLES.VOTES)
          .select('*')
          .eq('user_id', userId)
          .eq('category_id', categoryId)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          errors.push({ categoryId, error: checkError.message });
          continue;
        }

        if (existingVote) {
          // Обновляем существующий голос
          const { data, error } = await supabase
            .from(TABLES.VOTES)
            .update({ nominee_id: nomineeId, updated_at: new Date().toISOString() })
            .eq('id', existingVote.id)
            .select()
            .single();

          if (error) {
            errors.push({ categoryId, error: error.message });
          } else {
            results.push({ categoryId, vote: data, updated: true });
          }
        } else {
          // Создаем новый голос
          const { data, error } = await supabase
            .from(TABLES.VOTES)
            .insert({
              user_id: userId,
              category_id: categoryId,
              nominee_id: nomineeId,
            })
            .select()
            .single();

          if (error) {
            errors.push({ categoryId, error: error.message });
          } else {
            results.push({ categoryId, vote: data, created: true });
          }
        }
      } catch (voteError) {
        errors.push({ categoryId, error: voteError.message });
      }
    }

    if (errors.length > 0 && results.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Failed to submit votes',
        details: errors
      });
    }

    res.json({ 
      success: true,
      message: `Successfully submitted ${results.length} vote(s)`,
      results,
      ...(errors.length > 0 && { warnings: errors })
    });
  } catch (error) {
    console.error('Error submitting votes:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Получить голоса пользователя (требует аутентификации)
router.get('/my-votes', verifyBonfireToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from(TABLES.VOTES)
      .select(`
        id,
        category_id,
        nominee_id,
        created_at,
        category:categories (name),
        nominee:nominees (name)
      `)
      .eq('user_id', userId);

    if (error) throw error;

    // Преобразуем данные в формат, ожидаемый клиентом
    const votesMap = {};
    if (data && Array.isArray(data)) {
      data.forEach(vote => {
        if (vote.category_id) {
          votesMap[vote.category_id] = vote.nominee_id;
        }
      });
    }

    res.json({ 
      success: true,
      votes: votesMap,
      raw: data 
    });
  } catch (error) {
    console.error('Error fetching user votes:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Получить статистику голосования (публичный endpoint)
router.get('/stats', async (req, res) => {
  try {
    const { data: votes, error: votesError } = await supabase
      .from(TABLES.VOTES)
      .select(`
        category_id,
        nominee_id,
        category:categories (id, name),
        nominee:nominees (id, name)
      `);

    if (votesError) throw votesError;

    // Группируем голоса по категориям и номинантам
    const statsMap = {};
    
    if (votes && Array.isArray(votes)) {
      votes.forEach(vote => {
        const catId = vote.category_id;
        const nomId = vote.nominee_id;
        
        if (!statsMap[catId]) {
          statsMap[catId] = {
            category_id: catId,
            category_name: vote.category?.name || 'Unknown',
            nominees: {}
          };
        }
        
        if (!statsMap[catId].nominees[nomId]) {
          statsMap[catId].nominees[nomId] = {
            nominee_id: nomId,
            nominee_name: vote.nominee?.name || 'Unknown',
            vote_count: 0
          };
        }
        
        statsMap[catId].nominees[nomId].vote_count++;
      });
    }

    // Преобразуем в массив для клиента
    const stats = Object.values(statsMap).map(cat => ({
      ...cat,
      nominees: Object.values(cat.nominees)
    }));

    res.json({ 
      success: true,
      stats 
    });
  } catch (error) {
    console.error('Error fetching vote stats:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Получить статистику по конкретной категории
router.get('/stats/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;

    const { data: votes, error: votesError } = await supabase
      .from(TABLES.VOTES)
      .select(`
        nominee_id,
        nominee:nominees (id, name)
      `)
      .eq('category_id', categoryId);

    if (votesError) throw votesError;

    // Подсчитываем голоса
    const nomineeStats = {};
    
    if (votes && Array.isArray(votes)) {
      votes.forEach(vote => {
        const nomId = vote.nominee_id;
        if (!nomineeStats[nomId]) {
          nomineeStats[nomId] = {
            nominee_id: nomId,
            nominee_name: vote.nominee?.name || 'Unknown',
            vote_count: 0
          };
        }
        nomineeStats[nomId].vote_count++;
      });
    }

    res.json({ 
      success: true,
      category_id: categoryId,
      stats: Object.values(nomineeStats)
    });
  } catch (error) {
    console.error('Error fetching category stats:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

export default router;

