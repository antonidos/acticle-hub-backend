const express = require('express');
const db = require('../config/database');
const { authenticateToken, optionalAuth, checkAuthor } = require('../middleware/auth');
const { validate, articleSchemas } = require('../middleware/validation');

const router = express.Router();

/**
 * @swagger
 * /api/articles:
 *   get:
 *     summary: Получение всех статей с пагинацией и поиском
 *     tags: [Articles]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Номер страницы
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Количество статей на странице
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Поисковый запрос по заголовку и содержанию
 *       - in: query
 *         name: author_id
 *         schema:
 *           type: integer
 *         description: ID автора для фильтрации
 *     responses:
 *       200:
 *         description: Список статей получен успешно
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 articles:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Article'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     hasNext:
 *                       type: boolean
 *                     hasPrev:
 *                       type: boolean
 *                 filters:
 *                   type: object
 *                   properties:
 *                     search:
 *                       type: string
 *                     author_id:
 *                       type: integer
 *       500:
 *         description: Внутренняя ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const authorId = req.query.author_id;
    
    // Валидация лимита
    const validLimit = Math.min(Math.max(limit, 1), 50); // от 1 до 50
    
    let whereClause = '';
    let queryParams = [];
    let paramIndex = 1;
    
    // Добавляем условие поиска
    if (search) {
      whereClause = `WHERE (a.title ILIKE $${paramIndex} OR a.content ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }
    
    // Добавляем фильтр по автору
    if (authorId) {
      if (whereClause) {
        whereClause += ` AND a.author_id = $${paramIndex}`;
      } else {
        whereClause = `WHERE a.author_id = $${paramIndex}`;
      }
      queryParams.push(authorId);
      paramIndex++;
    }
    
    // Основной запрос для получения статей
    const articlesQuery = `
      SELECT 
        a.id,
        a.title,
        a.content,
        a.author_id,
        a.created_at,
        a.updated_at,
        u.username as author_username,
        u.avatar_url as author_avatar,
        COUNT(DISTINCT c.id) as comments_count,
        COUNT(DISTINCT ar.id) as reactions_count
      FROM articles a
      JOIN users u ON a.author_id = u.id
      LEFT JOIN comments c ON a.id = c.article_id
      LEFT JOIN article_reactions ar ON a.id = ar.article_id
      ${whereClause}
      GROUP BY a.id, a.title, a.content, a.author_id, a.created_at, a.updated_at, u.username, u.avatar_url
      ORDER BY a.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(validLimit, offset);
    
    // Запрос для подсчета общего количества статей
    const countQuery = `
      SELECT COUNT(*) as total
      FROM articles a
      ${whereClause}
    `;
    
    const [articlesResult, countResult] = await Promise.all([
      db.query(articlesQuery, queryParams),
      db.query(countQuery, queryParams.slice(0, -2)) // убираем limit и offset
    ]);
    
    const totalCount = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalCount / validLimit);
    
    // Получаем реакции для каждой статьи если пользователь авторизован
    const articlesWithReactions = await Promise.all(
      articlesResult.rows.map(async (article) => {
        // Получаем все реакции для статьи
        const reactionsQuery = `
          SELECT 
            r.id,
            r.emoji,
            r.name,
            COUNT(ar.id) as count,
            ${req.user ? 'MAX(CASE WHEN ar.user_id = $1 THEN 1 ELSE 0 END) as user_reacted' : '0 as user_reacted'}
          FROM reactions r
          LEFT JOIN article_reactions ar ON r.id = ar.reaction_id AND ar.article_id = $${req.user ? 2 : 1}
          GROUP BY r.id, r.emoji, r.name
          ORDER BY r.id
        `;
        
        const reactionsParams = req.user ? [req.user.id, article.id] : [article.id];
        const reactionsResult = await db.query(reactionsQuery, reactionsParams);
        
        return {
          ...article,
          comments_count: parseInt(article.comments_count),
          reactions_count: parseInt(article.reactions_count),
          reactions: reactionsResult.rows.map(r => ({
            id: r.id,
            emoji: r.emoji,
            name: r.name,
            count: parseInt(r.count),
            user_reacted: Boolean(parseInt(r.user_reacted))
          }))
        };
      })
    );
    
    res.json({
      articles: articlesWithReactions,
      pagination: {
        page,
        limit: validLimit,
        total: totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      filters: {
        search,
        author_id: authorId
      }
    });
    
  } catch (error) {
    console.error('Ошибка получения статей:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

/**
 * @swagger
 * /api/articles/{id}:
 *   get:
 *     summary: Получение конкретной статьи по ID
 *     tags: [Articles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID статьи
 *     responses:
 *       200:
 *         description: Статья получена успешно
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 article:
 *                   $ref: '#/components/schemas/Article'
 *       404:
 *         description: Статья не найдена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Внутренняя ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const articleId = req.params.id;
    
    const articleQuery = `
      SELECT 
        a.id,
        a.title,
        a.content,
        a.author_id,
        a.created_at,
        a.updated_at,
        u.username as author_username,
        u.avatar_url as author_avatar,
        COUNT(DISTINCT c.id) as comments_count,
        COUNT(DISTINCT ar.id) as reactions_count
      FROM articles a
      JOIN users u ON a.author_id = u.id
      LEFT JOIN comments c ON a.id = c.article_id
      LEFT JOIN article_reactions ar ON a.id = ar.article_id
      WHERE a.id = $1
      GROUP BY a.id, a.title, a.content, a.author_id, a.created_at, a.updated_at, u.username, u.avatar_url
    `;
    
    const articleResult = await db.query(articleQuery, [articleId]);
    
    if (articleResult.rows.length === 0) {
      return res.status(404).json({ message: 'Статья не найдена' });
    }
    
    const article = articleResult.rows[0];
    
    // Получаем реакции для статьи
    const reactionsQuery = `
      SELECT 
        r.id,
        r.emoji,
        r.name,
        COUNT(ar.id) as count,
        ${req.user ? 'MAX(CASE WHEN ar.user_id = $1 THEN 1 ELSE 0 END) as user_reacted' : '0 as user_reacted'}
      FROM reactions r
      LEFT JOIN article_reactions ar ON r.id = ar.reaction_id AND ar.article_id = $${req.user ? 2 : 1}
      GROUP BY r.id, r.emoji, r.name
      ORDER BY r.id
    `;
    
    const reactionsParams = req.user ? [req.user.id, articleId] : [articleId];
    const reactionsResult = await db.query(reactionsQuery, reactionsParams);
    
    res.json({
      article: {
        ...article,
        comments_count: parseInt(article.comments_count),
        reactions_count: parseInt(article.reactions_count),
        reactions: reactionsResult.rows.map(r => ({
          id: r.id,
          emoji: r.emoji,
          name: r.name,
          count: parseInt(r.count),
          user_reacted: Boolean(parseInt(r.user_reacted))
        }))
      }
    });
    
  } catch (error) {
    console.error('Ошибка получения статьи:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

/**
 * @swagger
 * /api/articles:
 *   post:
 *     summary: Создание новой статьи
 *     tags: [Articles]
 *     security:
 *       - authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ArticleRequest'
 *     responses:
 *       201:
 *         description: Статья успешно создана
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Статья успешно создана"
 *                 article:
 *                   $ref: '#/components/schemas/Article'
 *       400:
 *         description: Ошибка валидации данных
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Неавторизован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Внутренняя ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', authenticateToken, validate(articleSchemas.create), async (req, res) => {
  try {
    const { title, content } = req.body;
    const authorId = req.user.id;
    
    const createQuery = `
      INSERT INTO articles (title, content, author_id)
      VALUES ($1, $2, $3)
      RETURNING id, title, content, author_id, created_at, updated_at
    `;
    
    const result = await db.query(createQuery, [title, content, authorId]);
    const article = result.rows[0];
    
    // Получаем данные автора
    const authorQuery = 'SELECT username, avatar_url FROM users WHERE id = $1';
    const authorResult = await db.query(authorQuery, [authorId]);
    const author = authorResult.rows[0];
    
    res.status(201).json({
      message: 'Статья успешно создана',
      article: {
        ...article,
        author_username: author.username,
        author_avatar: author.avatar_url,
        comments_count: 0,
        reactions_count: 0,
        reactions: []
      }
    });
    
  } catch (error) {
    console.error('Ошибка создания статьи:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

/**
 * @swagger
 * /api/articles/{id}:
 *   put:
 *     summary: Обновление статьи по ID
 *     tags: [Articles]
 *     security:
 *       - authorization: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID статьи
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Заголовок статьи
 *               content:
 *                 type: string
 *                 description: Содержание статьи
 *     responses:
 *       201:
 *         description: Статья успешно создана
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Статья успешно создана"
 *                 article:
 *                   $ref: '#/components/schemas/Article'
 *       400:
 *         description: Ошибка валидации данных
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Неавторизован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Внутренняя ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id', authenticateToken, checkAuthor('article'), validate(articleSchemas.update), async (req, res) => {
  try {
    const articleId = req.params.id;
    const { title, content } = req.body;
    
    // Строим динамический запрос для обновления
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;
    
    if (title !== undefined) {
      updateFields.push(`title = $${paramIndex}`);
      updateValues.push(title);
      paramIndex++;
    }
    
    if (content !== undefined) {
      updateFields.push(`content = $${paramIndex}`);
      updateValues.push(content);
      paramIndex++;
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'Нет данных для обновления' });
    }
    
    updateValues.push(articleId);
    
    const updateQuery = `
      UPDATE articles 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
      RETURNING id, title, content, author_id, created_at, updated_at
    `;
    
    const result = await db.query(updateQuery, updateValues);
    
    // Получаем данные автора
    const authorQuery = 'SELECT username, avatar_url FROM users WHERE id = $1';
    const authorResult = await db.query(authorQuery, [req.user.id]);
    const author = authorResult.rows[0];
    
    res.json({
      message: 'Статья успешно обновлена',
      article: {
        ...result.rows[0],
        author_username: author.username,
        author_avatar: author.avatar_url
      }
    });
    
  } catch (error) {
    console.error('Ошибка обновления статьи:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

/**
 * @swagger
 * /api/articles/{id}:
 *   delete:
 *     summary: Удаление статьи по ID
 *     tags: [Articles]
 *     security:
 *       - authorization: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID статьи
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Заголовок статьи
 *               content:
 *                 type: string
 *                 description: Содержание статьи
 *     responses:
 *       201:
 *         description: Статья успешно создана
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Статья успешно создана"
 *                 article:
 *                   $ref: '#/components/schemas/Article'
 *       400:
 *         description: Ошибка валидации данных
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Неавторизован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Внутренняя ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', authenticateToken, checkAuthor('article'), async (req, res) => {
  try {
    const articleId = req.params.id;
    
    const deleteQuery = 'DELETE FROM articles WHERE id = $1 RETURNING title';
    const result = await db.query(deleteQuery, [articleId]);
    
    res.json({
      message: 'Статья успешно удалена',
      deletedArticle: {
        title: result.rows[0].title
      }
    });
    
  } catch (error) {
    console.error('Ошибка удаления статьи:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router; 