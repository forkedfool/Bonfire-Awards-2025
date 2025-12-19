import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import votesRouter from './routes/votes.js';
import adminRouter from './routes/admin.js';
import authRouter from './routes/auth.js';

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
  console.log(`Server running on port ${PORT}`);
});

