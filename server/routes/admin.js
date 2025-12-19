import express from 'express';
import { verifyAdmin } from '../middleware/admin.js';
import { verifyBonfireToken } from '../middleware/auth.js';
import { config } from '../config.js';
import { supabase, TABLES } from '../db/supabase.js';

const router = express.Router();

// Endpoint для проверки, является ли текущий пользователь админом
router.get('/check', verifyBonfireToken, (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false,
        isAdmin: false,
        error: 'User ID not found' 
      });
    }

    // Детальное логирование для отладки
    console.log('=== ADMIN CHECK DEBUG ===');
    console.log('User ID from token:', userId);
    console.log('User ID type:', typeof userId);
    console.log('Admin IDs from config:', config.admin.userIds);
    console.log('Admin IDs count:', config.admin.userIds?.length || 0);
    
    // Проверяем каждый ID отдельно
    if (config.admin.userIds && config.admin.userIds.length > 0) {
      config.admin.userIds.forEach((adminId, index) => {
        console.log(`Admin ID [${index}]: "${adminId}" (type: ${typeof adminId}, length: ${adminId.length})`);
        console.log(`  Comparison with user ID: "${adminId}" === "${userId}" = ${adminId === userId}`);
        console.log(`  Strict equality: ${adminId === userId}`);
        console.log(`  Includes check: ${config.admin.userIds.includes(userId)}`);
      });
    } else {
      console.log('WARNING: ADMIN_USER_IDS is empty or not set!');
    }
    
    const isAdmin = config.admin.userIds && config.admin.userIds.includes(userId);
    
    console.log(`Result: Is Admin = ${isAdmin}`);
    console.log('========================');
    
    res.json({ 
      success: true,
      isAdmin: isAdmin,
      userId: userId,
      adminIds: config.admin.userIds, // Для отладки
    });
  } catch (error) {
    console.error('Error checking admin status:', error);
    res.status(500).json({ 
      success: false,
      isAdmin: false,
      error: error.message || 'Internal server error' 
    });
  }
});

// Все остальные админ-роуты требуют проверку админских прав
router.use(verifyAdmin);

// ========== КАТЕГОРИИ ==========

// Получить все категории
router.get('/categories', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(TABLES.CATEGORIES)
      .select('*')
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: error.message });
  }
});

// Создать категорию
router.post('/categories', async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const { data, error } = await supabase
      .from(TABLES.CATEGORIES)
      .insert({ name, description })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: error.message });
  }
});

// Обновить категорию
router.put('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const { data, error } = await supabase
      .from(TABLES.CATEGORIES)
      .update({ name, description })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: error.message });
  }
});

// Удалить категорию
router.delete('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Сначала удаляем связи с номинантами
    await supabase
      .from(TABLES.CATEGORY_NOMINEES)
      .delete()
      .eq('category_id', id);

    // Удаляем голоса
    await supabase
      .from(TABLES.VOTES)
      .delete()
      .eq('category_id', id);

    // Удаляем категорию
    const { error } = await supabase
      .from(TABLES.CATEGORIES)
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Category deleted' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== НОМИНАНТЫ ==========

// Получить всех номинантов
router.get('/nominees', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(TABLES.NOMINEES)
      .select('*')
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching nominees:', error);
    res.status(500).json({ error: error.message });
  }
});

// Создать номинанта
router.post('/nominees', async (req, res) => {
  try {
    const { name, description, image_url } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const { data, error } = await supabase
      .from(TABLES.NOMINEES)
      .insert({ name, description, image_url })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error creating nominee:', error);
    res.status(500).json({ error: error.message });
  }
});

// Обновить номинанта
router.put('/nominees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image_url } = req.body;

    const { data, error } = await supabase
      .from(TABLES.NOMINEES)
      .update({ name, description, image_url })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Nominee not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error updating nominee:', error);
    res.status(500).json({ error: error.message });
  }
});

// Удалить номинанта
router.delete('/nominees/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Удаляем связи с категориями
    await supabase
      .from(TABLES.CATEGORY_NOMINEES)
      .delete()
      .eq('nominee_id', id);

    // Удаляем голоса
    await supabase
      .from(TABLES.VOTES)
      .delete()
      .eq('nominee_id', id);

    // Удаляем номинанта
    const { error } = await supabase
      .from(TABLES.NOMINEES)
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Nominee deleted' });
  } catch (error) {
    console.error('Error deleting nominee:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== СВЯЗИ КАТЕГОРИЯ-НОМИНАНТ ==========

// Получить все связи
router.get('/category-nominees', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(TABLES.CATEGORY_NOMINEES)
      .select(`
        id,
        category_id,
        nominee_id,
        category:categories (name),
        nominee:nominees (name)
      `)
      .order('category_id');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching category-nominee relations:', error);
    res.status(500).json({ error: error.message });
  }
});

// Связать номинанта с категорией
router.post('/category-nominees', async (req, res) => {
  try {
    const { category_id, nominee_id } = req.body;

    if (!category_id || !nominee_id) {
      return res.status(400).json({ error: 'category_id and nominee_id are required' });
    }

    // Проверяем, не существует ли уже такая связь
    const { data: existing, error: checkError } = await supabase
      .from(TABLES.CATEGORY_NOMINEES)
      .select('*')
      .eq('category_id', category_id)
      .eq('nominee_id', nominee_id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existing) {
      return res.status(400).json({ error: 'Relation already exists' });
    }

    const { data, error } = await supabase
      .from(TABLES.CATEGORY_NOMINEES)
      .insert({ category_id, nominee_id })
      .select(`
        id,
        category_id,
        nominee_id,
        category:categories (name),
        nominee:nominees (name)
      `)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error creating category-nominee relation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Отвязать номинанта от категории
router.delete('/category-nominees/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Удаляем голоса для этой связи
    const { data: relation } = await supabase
      .from(TABLES.CATEGORY_NOMINEES)
      .select('category_id, nominee_id')
      .eq('id', id)
      .single();

    if (relation) {
      await supabase
        .from(TABLES.VOTES)
        .delete()
        .eq('category_id', relation.category_id)
        .eq('nominee_id', relation.nominee_id);
    }

    const { error } = await supabase
      .from(TABLES.CATEGORY_NOMINEES)
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Relation deleted' });
  } catch (error) {
    console.error('Error deleting category-nominee relation:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== ГОЛОСА И СТАТИСТИКА ==========

// Получить все голоса
router.get('/votes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(TABLES.VOTES)
      .select(`
        id,
        user_id,
        category_id,
        nominee_id,
        created_at,
        updated_at,
        category:categories (name),
        nominee:nominees (name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching votes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получить статистику голосования
router.get('/stats', async (req, res) => {
  try {
    // Общая статистика
    const { count: totalVotes } = await supabase
      .from(TABLES.VOTES)
      .select('*', { count: 'exact', head: true });

    const { count: totalUsers } = await supabase
      .from(TABLES.VOTES)
      .select('user_id', { count: 'exact', head: true });

    // Статистика по категориям
    const { data: categoryStats, error: catError } = await supabase
      .from(TABLES.VOTES)
      .select(`
        category_id,
        category:categories (name),
        nominee_id,
        nominee:nominees (name)
      `);

    if (catError) throw catError;

    // Группируем по категориям
    const statsByCategory = {};
    categoryStats.forEach((vote) => {
      const catId = vote.category_id;
      const catName = vote.category?.name || 'Unknown';
      
      if (!statsByCategory[catId]) {
        statsByCategory[catId] = {
          category_id: catId,
          category_name: catName,
          nominees: {},
        };
      }

      const nomId = vote.nominee_id;
      const nomName = vote.nominee?.name || 'Unknown';
      
      if (!statsByCategory[catId].nominees[nomId]) {
        statsByCategory[catId].nominees[nomId] = {
          nominee_id: nomId,
          nominee_name: nomName,
          votes: 0,
        };
      }

      statsByCategory[catId].nominees[nomId].votes++;
    });

    // Преобразуем в массив
    const categories = Object.values(statsByCategory).map((cat) => ({
      ...cat,
      nominees: Object.values(cat.nominees),
      total_votes: Object.values(cat.nominees).reduce((sum, nom) => sum + nom.votes, 0),
    }));

    res.json({
      total_votes: totalVotes || 0,
      total_users: totalUsers || 0,
      categories,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

