import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import votesRouter from './routes/votes.js';
import adminRouter from './routes/admin.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import { config } from './config.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
// Поддержка form-urlencoded для oidc-client
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/votes', votesRouter);
app.use('/api/admin', adminRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);

// Публичный эндпоинт для категорий (проксируем к votes router)
// Это позволяет клиенту использовать /api/categories вместо /api/votes/categories
app.get('/api/categories', (req, res, next) => {
  // Создаем новый запрос с измененным путем для роутера
  const originalUrl = req.url;
  req.url = '/categories';
  votesRouter(req, res, (err) => {
    req.url = originalUrl; // Восстанавливаем оригинальный URL
    if (err) next(err);
  });
});

// Админские операции с категориями (требуют админских прав)
// Проксируем к админ-роутеру
app.post('/api/categories', (req, res, next) => {
  const originalUrl = req.url;
  const originalBaseUrl = req.baseUrl;
  req.url = '/categories';
  req.baseUrl = '/api/admin';
  adminRouter(req, res, (err) => {
    req.url = originalUrl;
    req.baseUrl = originalBaseUrl;
    if (err) next(err);
  });
});

app.put('/api/categories/:id', (req, res, next) => {
  const originalUrl = req.url;
  const originalBaseUrl = req.baseUrl;
  const originalParams = { ...req.params };
  req.url = `/categories/${req.params.id}`;
  req.baseUrl = '/api/admin';
  req.params = { id: req.params.id };
  adminRouter(req, res, (err) => {
    req.url = originalUrl;
    req.baseUrl = originalBaseUrl;
    req.params = originalParams;
    if (err) next(err);
  });
});

app.delete('/api/categories/:id', (req, res, next) => {
  const originalUrl = req.url;
  const originalBaseUrl = req.baseUrl;
  const originalParams = { ...req.params };
  req.url = `/categories/${req.params.id}`;
  req.baseUrl = '/api/admin';
  req.params = { id: req.params.id };
  adminRouter(req, res, (err) => {
    req.url = originalUrl;
    req.baseUrl = originalBaseUrl;
    req.params = originalParams;
    if (err) next(err);
  });
});

// Прокси для управления номинантами в категориях (требует админских прав)
// Маршрутизируем /api/categories/:categoryId/nominees к /api/admin/categories/:categoryId/nominees
app.post('/api/categories/:categoryId/nominees', (req, res, next) => {
  const originalUrl = req.url;
  const originalBaseUrl = req.baseUrl;
  const originalParams = { ...req.params };
  req.url = `/categories/${req.params.categoryId}/nominees`;
  req.baseUrl = '/api/admin';
  req.params = { categoryId: req.params.categoryId };
  adminRouter(req, res, (err) => {
    req.url = originalUrl;
    req.baseUrl = originalBaseUrl;
    req.params = originalParams;
    if (err) next(err);
  });
});

app.put('/api/categories/:categoryId/nominees/:nomineeId', (req, res, next) => {
  const originalUrl = req.url;
  const originalBaseUrl = req.baseUrl;
  const originalParams = { ...req.params };
  req.url = `/categories/${req.params.categoryId}/nominees/${req.params.nomineeId}`;
  req.baseUrl = '/api/admin';
  req.params = { 
    categoryId: req.params.categoryId,
    nomineeId: req.params.nomineeId 
  };
  adminRouter(req, res, (err) => {
    req.url = originalUrl;
    req.baseUrl = originalBaseUrl;
    req.params = originalParams;
    if (err) next(err);
  });
});

app.delete('/api/categories/:categoryId/nominees/:nomineeId', (req, res, next) => {
  const originalUrl = req.url;
  const originalBaseUrl = req.baseUrl;
  const originalParams = { ...req.params };
  req.url = `/categories/${req.params.categoryId}/nominees/${req.params.nomineeId}`;
  req.baseUrl = '/api/admin';
  req.params = { 
    categoryId: req.params.categoryId,
    nomineeId: req.params.nomineeId 
  };
  adminRouter(req, res, (err) => {
    req.url = originalUrl;
    req.baseUrl = originalBaseUrl;
    req.params = originalParams;
    if (err) next(err);
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('=== ADMIN CONFIGURATION ===');
  console.log('Admin User IDs:', config.admin.userIds);
  console.log('Admin User IDs count:', config.admin.userIds?.length || 0);
  if (config.admin.userIds && config.admin.userIds.length > 0) {
    config.admin.userIds.forEach((id, index) => {
      console.log(`  [${index}]: "${id}" (length: ${id.length}, type: ${typeof id})`);
    });
  } else {
    console.log('⚠️  WARNING: No admin user IDs configured!');
    console.log('   Set ADMIN_USER_IDS in .env file');
  }
  console.log('===========================');
});

