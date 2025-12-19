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

    // Нормализуем User ID к строке для сравнения (ID может быть числом или строкой)
    const normalizedUserId = String(userId);
    
    // Детальное логирование для отладки
    console.log('=== ADMIN CHECK DEBUG ===');
    console.log('User ID from token (raw):', userId);
    console.log('User ID from token (type):', typeof userId);
    console.log('User ID from token (normalized):', normalizedUserId);
    console.log('Admin IDs from config:', config.admin.userIds);
    console.log('Admin IDs count:', config.admin.userIds?.length || 0);
    
    // Проверяем каждый ID отдельно
    if (config.admin.userIds && config.admin.userIds.length > 0) {
      config.admin.userIds.forEach((adminId, index) => {
        const normalizedAdminId = String(adminId);
        console.log(`Admin ID [${index}]: "${adminId}" (normalized: "${normalizedAdminId}")`);
        console.log(`  Comparison: "${normalizedAdminId}" === "${normalizedUserId}" = ${normalizedAdminId === normalizedUserId}`);
        console.log(`  Includes check (raw): ${config.admin.userIds.includes(userId)}`);
        console.log(`  Includes check (normalized): ${config.admin.userIds.includes(normalizedUserId)}`);
      });
    } else {
      console.log('WARNING: ADMIN_USER_IDS is empty or not set!');
    }
    
    // Сравниваем нормализованные значения (используем some для надежного сравнения)
    const isAdmin = config.admin.userIds && config.admin.userIds.length > 0 && 
      config.admin.userIds.some(adminId => String(adminId) === normalizedUserId);
    
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
    // Поддерживаем как старый формат (name), так и новый (title)
    const { name, title, code, description } = req.body;
    const categoryName = title || name;

    if (!categoryName) {
      return res.status(400).json({ error: 'name or title is required' });
    }

    // Сохраняем code в description как JSON для поддержки дополнительных полей
    let categoryDescription = description || null;
    if (code || description) {
      categoryDescription = JSON.stringify({ 
        code: code || '', 
        description: description || '' 
      });
    }

    const { data, error } = await supabase
      .from(TABLES.CATEGORIES)
      .insert({ name: categoryName, description: categoryDescription })
      .select()
      .single();

    if (error) throw error;
    
    // Преобразуем ответ для фронтенда
    const response = { ...data, title: data.name };
    if (categoryDescription) {
      try {
        const parsed = JSON.parse(categoryDescription);
        if (parsed.code) response.code = parsed.code;
        if (parsed.description) response.description = parsed.description;
      } catch (e) {
        response.description = categoryDescription;
      }
    }
    delete response.name;
    
    res.json(response);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: error.message });
  }
});

// Обновить категорию
router.put('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Поддерживаем как старый формат (name), так и новый (title)
    const { name, title, code, description } = req.body;
    
    const updateData = {};
    if (title !== undefined) updateData.name = title;
    if (name !== undefined && title === undefined) updateData.name = name;
    
    // Сохраняем code в description как JSON
    if (code !== undefined || description !== undefined) {
      updateData.description = JSON.stringify({ 
        code: code || '', 
        description: description || '' 
      });
    }

    const { data, error } = await supabase
      .from(TABLES.CATEGORIES)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Преобразуем ответ для фронтенда
    const response = { ...data, title: data.name };
    if (data.description) {
      try {
        const parsed = JSON.parse(data.description);
        if (parsed.code) response.code = parsed.code;
        if (parsed.description) response.description = parsed.description;
      } catch (e) {
        response.description = data.description;
      }
    }
    delete response.name;

    res.json(response);
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
    
    console.log('[ADMIN] Loaded nominees from DB:', data?.length || 0);
    
    // Преобразуем данные для фронтенда
    const transformed = (data || []).map(nom => {
      const nominee = { ...nom };
      console.log('[ADMIN] Processing nominee:', { id: nominee.id, name: nominee.name, image_url: nominee.image_url });
      if (nominee.image_url !== undefined && nominee.image_url !== null && String(nominee.image_url).trim() !== '') {
        nominee.imageUrl = String(nominee.image_url).trim();
        console.log('[ADMIN] Set imageUrl:', nominee.imageUrl);
        delete nominee.image_url;
      } else {
        nominee.imageUrl = null;
        console.log('[ADMIN] No image_url, set imageUrl to null');
      }
      // Парсим description как JSON, если это возможно
      if (nominee.description) {
        try {
          const parsed = JSON.parse(nominee.description);
          if (parsed.desc) nominee.desc = parsed.desc;
          if (parsed.role) nominee.role = parsed.role;
        } catch (e) {
          nominee.desc = nominee.description;
        }
      }
      return nominee;
    });
    
    res.json(transformed);
  } catch (error) {
    console.error('Error fetching nominees:', error);
    res.status(500).json({ error: error.message });
  }
});

// Создать номинанта
router.post('/nominees', async (req, res) => {
  try {
    const { name, description, image_url } = req.body;

    console.log('[ADMIN] POST /nominees - Received:', { name, description, image_url, body: req.body });

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    // Обрабатываем image_url - может прийти как image_url или imageUrl
    const processedImageUrl = image_url && String(image_url).trim() !== '' ? String(image_url).trim() : null;
    console.log('[ADMIN] Processed image_url for DB:', processedImageUrl);

    const { data, error } = await supabase
      .from(TABLES.NOMINEES)
      .insert({ name, description, image_url: processedImageUrl })
      .select()
      .single();

    if (error) {
      console.error('[ADMIN] Error creating nominee:', error);
      throw error;
    }
    
    console.log('[ADMIN] Created nominee in DB:', { id: data.id, name: data.name, image_url: data.image_url });
    
    // Преобразуем ответ для фронтенда
    const response = {
      ...data,
      imageUrl: data.image_url || null,
    };
    delete response.image_url;
    
    console.log('[ADMIN] Returning response:', { id: response.id, name: response.name, imageUrl: response.imageUrl });
    
    // Парсим description для извлечения desc и role
    if (data.description) {
      try {
        const parsed = JSON.parse(data.description);
        response.desc = parsed.desc || '';
        response.role = parsed.role || '';
      } catch (e) {
        response.desc = data.description;
      }
    }
    
    res.json(response);
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

    console.log('[ADMIN] PUT /nominees/:id - Received:', { id, name, description, image_url, body: req.body });

    // Обрабатываем image_url - может прийти как image_url или imageUrl
    const processedImageUrl = image_url && String(image_url).trim() !== '' ? String(image_url).trim() : null;
    console.log('[ADMIN] Processed image_url for DB:', processedImageUrl);

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (image_url !== undefined) updateData.image_url = processedImageUrl;

    const { data, error } = await supabase
      .from(TABLES.NOMINEES)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[ADMIN] Error updating nominee:', error);
      throw error;
    }
    if (!data) {
      return res.status(404).json({ error: 'Nominee not found' });
    }

    console.log('[ADMIN] Updated nominee in DB:', { id: data.id, name: data.name, image_url: data.image_url });

    // Преобразуем ответ для фронтенда
    const response = {
      ...data,
      imageUrl: data.image_url || null,
    };
    delete response.image_url;
    
    console.log('[ADMIN] Returning response:', { id: response.id, name: response.name, imageUrl: response.imageUrl });
    
    // Парсим description для извлечения desc и role
    if (data.description) {
      try {
        const parsed = JSON.parse(data.description);
        response.desc = parsed.desc || '';
        response.role = parsed.role || '';
      } catch (e) {
        response.desc = data.description;
      }
    }

    res.json(response);
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

// ========== НОМИНАНТЫ В КАТЕГОРИЯХ ==========

// Создать номинанта в категории
router.post('/categories/:categoryId/nominees', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { name, desc, role, imageUrl } = req.body;

    console.log('[ADMIN] Creating nominee in category:', { categoryId, name, imageUrl });

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    // Преобразуем imageUrl (camelCase) в image_url (snake_case) для базы данных
    const image_url = imageUrl && imageUrl.trim() !== '' ? imageUrl.trim() : null;
    console.log('[ADMIN] Processed image_url:', image_url);
    
    // Сохраняем desc и role в description как JSON для поддержки дополнительных полей
    let description = null;
    if (desc || role) {
      description = JSON.stringify({ desc: desc || '', role: role || '' });
    }

    // Создаем номинанта
    const { data: nominee, error: nomineeError } = await supabase
      .from(TABLES.NOMINEES)
      .insert({ name, description, image_url })
      .select()
      .single();

    if (nomineeError) throw nomineeError;

    // Связываем номинанта с категорией
    const { data: relation, error: relationError } = await supabase
      .from(TABLES.CATEGORY_NOMINEES)
      .insert({ category_id: categoryId, nominee_id: nominee.id })
      .select()
      .single();

    if (relationError) {
      // Если связь не удалась, удаляем созданного номинанта
      await supabase.from(TABLES.NOMINEES).delete().eq('id', nominee.id);
      throw relationError;
    }

    // Возвращаем номинанта в формате фронтенда
    const response = {
      ...nominee,
      imageUrl: nominee.image_url || null,
      desc: desc || '',
      role: role || '',
    };
    delete response.image_url;

    console.log('[ADMIN] Created nominee response:', { id: response.id, name: response.name, imageUrl: response.imageUrl });

    res.json(response);
  } catch (error) {
    console.error('Error creating nominee in category:', error);
    res.status(500).json({ error: error.message });
  }
});

// Обновить номинанта в категории
router.put('/categories/:categoryId/nominees/:nomineeId', async (req, res) => {
  try {
    const { categoryId, nomineeId } = req.params;
    const { name, desc, role, imageUrl } = req.body;

    // Проверяем, что номинант принадлежит категории
    const { data: relation, error: relationError } = await supabase
      .from(TABLES.CATEGORY_NOMINEES)
      .select('*')
      .eq('category_id', categoryId)
      .eq('nominee_id', nomineeId)
      .single();

    if (relationError || !relation) {
      return res.status(404).json({ error: 'Nominee not found in this category' });
    }

    // Преобразуем imageUrl (camelCase) в image_url (snake_case)
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (imageUrl !== undefined) updateData.image_url = imageUrl || null;
    
    // Сохраняем desc и role в description как JSON
    if (desc !== undefined || role !== undefined) {
      updateData.description = JSON.stringify({ 
        desc: desc || '', 
        role: role || '' 
      });
    }

    const { data: nominee, error: nomineeError } = await supabase
      .from(TABLES.NOMINEES)
      .update(updateData)
      .eq('id', nomineeId)
      .select()
      .single();

    if (nomineeError) throw nomineeError;
    if (!nominee) {
      return res.status(404).json({ error: 'Nominee not found' });
    }

    // Возвращаем номинанта в формате фронтенда
    const response = {
      ...nominee,
      imageUrl: nominee.image_url,
    };
    delete response.image_url;
    
    // Парсим description для извлечения desc и role
    if (nominee.description) {
      try {
        const parsed = JSON.parse(nominee.description);
        response.desc = parsed.desc || '';
        response.role = parsed.role || '';
      } catch (e) {
        response.desc = nominee.description;
      }
    }

    res.json(response);
  } catch (error) {
    console.error('Error updating nominee in category:', error);
    res.status(500).json({ error: error.message });
  }
});

// Удалить номинанта из категории
router.delete('/categories/:categoryId/nominees/:nomineeId', async (req, res) => {
  try {
    const { categoryId, nomineeId } = req.params;

    // Удаляем связь с категорией
    const { error: relationError } = await supabase
      .from(TABLES.CATEGORY_NOMINEES)
      .delete()
      .eq('category_id', categoryId)
      .eq('nominee_id', nomineeId);

    if (relationError) throw relationError;

    // Проверяем, есть ли еще связи с этим номинантом
    const { data: otherRelations, error: checkError } = await supabase
      .from(TABLES.CATEGORY_NOMINEES)
      .select('id')
      .eq('nominee_id', nomineeId)
      .limit(1);

    if (checkError) throw checkError;

    // Если больше нет связей, удаляем номинанта
    if (!otherRelations || otherRelations.length === 0) {
      // Удаляем голоса для этого номинанта
      await supabase
        .from(TABLES.VOTES)
        .delete()
        .eq('nominee_id', nomineeId);

      // Удаляем номинанта
      const { error: deleteError } = await supabase
        .from(TABLES.NOMINEES)
        .delete()
        .eq('id', nomineeId);

      if (deleteError) throw deleteError;
    }

    res.json({ message: 'Nominee removed from category' });
  } catch (error) {
    console.error('Error deleting nominee from category:', error);
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

// ========== НАСТРОЙКИ ==========

// Получить статус голосования
router.get('/voting-status', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(TABLES.SETTINGS)
      .select('value')
      .eq('key', 'voting_enabled')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // По умолчанию голосование включено, если настройка не найдена
    const votingEnabled = data?.value === 'true' || !data;
    
    res.json({ 
      success: true,
      votingEnabled 
    });
  } catch (error) {
    console.error('Error fetching voting status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Изменить статус голосования
router.put('/voting-status', async (req, res) => {
  try {
    const { enabled } = req.body;
    console.log('[ADMIN] Updating voting status:', { enabled, type: typeof enabled });

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    // Сначала проверяем, существует ли запись
    const { data: existing, error: checkError } = await supabase
      .from(TABLES.SETTINGS)
      .select('*')
      .eq('key', 'voting_enabled')
      .single();

    console.log('[ADMIN] Existing setting:', existing);

    let data, error;

    if (checkError && checkError.code === 'PGRST116') {
      // Запись не существует, создаем новую
      console.log('[ADMIN] Creating new setting');
      const result = await supabase
        .from(TABLES.SETTINGS)
        .insert({ 
          key: 'voting_enabled', 
          value: enabled.toString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      data = result.data;
      error = result.error;
    } else if (checkError) {
      throw checkError;
    } else {
      // Запись существует, обновляем
      console.log('[ADMIN] Updating existing setting');
      const result = await supabase
        .from(TABLES.SETTINGS)
        .update({ 
          value: enabled.toString(),
          updated_at: new Date().toISOString()
        })
        .eq('key', 'voting_enabled')
        .select()
        .single();
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('[ADMIN] Database error:', error);
      throw error;
    }

    console.log('[ADMIN] Successfully updated voting status:', data);

    res.json({ 
      success: true,
      votingEnabled: enabled 
    });
  } catch (error) {
    console.error('[ADMIN] Error updating voting status:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
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

