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

    if (categoriesError) throw categoriesError;

    // Получаем номинантов для каждой категории
    const categoriesWithNominees = await Promise.all(
      categories.map(async (category) => {
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

        if (cnError) throw cnError;

        return {
          ...category,
          nominees: categoryNominees.map((cn) => cn.nominee).filter(Boolean),
        };
      })
    );

    res.json(categoriesWithNominees);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: error.message });
  }
});

// Проголосовать (требует аутентификации)
router.post('/vote', verifyBonfireToken, async (req, res) => {
  try {
    const { category_id, nominee_id } = req.body;
    const userId = req.user.id;

    if (!category_id || !nominee_id) {
      return res.status(400).json({ error: 'category_id and nominee_id are required' });
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

    res.json({ message: 'Vote recorded', vote: data });
  } catch (error) {
    console.error('Error voting:', error);
    res.status(500).json({ error: error.message });
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

    res.json(data);
  } catch (error) {
    console.error('Error fetching user votes:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

