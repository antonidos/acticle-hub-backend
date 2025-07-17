const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { specs, swaggerUi } = require('./config/swagger');
require('dotenv').config();

const app = express();

// Middleware для безопасности
app.use(helmet());

// Ограничение запросов
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100 // максимум 100 запросов на IP за 15 минут
});
app.use(limiter);

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));

// Парсинг JSON и URL-encoded данных
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Статические файлы
app.use('/uploads', express.static('uploads'));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'ArticleHub API Documentation'
}));

// Основные маршруты
/**
 * @swagger
 * /:
 *   get:
 *     summary: Главная страница API
 *     tags: [General]
 *     responses:
 *       200:
 *         description: Информация о API
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "ArticleHub Backend API"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 status:
 *                   type: string
 *                   example: "running"
 *                 documentation:
 *                   type: string
 *                   example: "/api-docs"
 */
app.get('/', (req, res) => {
  res.json({ 
    message: 'ArticleHub Backend API',
    version: '1.0.0',
    status: 'running',
    documentation: '/api-docs'
  });
});

// Подключение маршрутов
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/articles', require('./routes/articles'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/reactions', require('./routes/reactions'));
app.use('/api/profile', require('./routes/profile'));

// Обработка 404
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Маршрут не найден' });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Внутренняя ошибка сервера',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`Режим: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app; 