const express = require('express');
const db = require('../config/database');
const { authenticateToken, optionalAuth, checkAuthor } = require('../middleware/auth');
const { validate, commentSchemas } = require('../middleware/validation');

const router = express.Router();

/**
 * @swagger
 * /api/comments/article/{articleId}:
 *   get:
 *     summary: Получение комментариев к статье
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: articleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID статьи
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
 *           maximum: 100
 *           default: 20
 *         description: Количество комментариев на странице
 *     responses:
 *       200:
 *         description: Список комментариев получен успешно
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 comments:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Comment'
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
router.get('/article/:articleId', optionalAuth, async (req, res) => {
  try {
    const articleId = req.params.articleId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    // Валидация лимита
    const validLimit = Math.min(Math.max(limit, 1), 100);
    
    // Проверяем, существует ли статья
    const articleExists = await db.query('SELECT id FROM articles WHERE id = $1', [articleId]);
    if (articleExists.rows.length === 0) {
      return res.status(404).json({ message: 'Статья не найдена' });
    }
    
    // Получаем комментарии
    const commentsQuery = `
      SELECT 
        c.id,
        c.content,
        c.article_id,
        c.author_id,
        c.created_at,
        c.updated_at,
        u.username as author_username,
        u.avatar_url as author_avatar,
        COUNT(DISTINCT cr.id) as reactions_count
      FROM comments c
      JOIN users u ON c.author_id = u.id
      LEFT JOIN comment_reactions cr ON c.id = cr.comment_id
      WHERE c.article_id = $1
      GROUP BY c.id, c.content, c.article_id, c.author_id, c.created_at, c.updated_at, u.username, u.avatar_url
      ORDER BY c.created_at ASC
      LIMIT $2 OFFSET $3
    `;
    
    // Подсчет общего количества комментариев
    const countQuery = 'SELECT COUNT(*) as total FROM comments WHERE article_id = $1';
    
    const [commentsResult, countResult] = await Promise.all([
      db.query(commentsQuery, [articleId, validLimit, offset]),
      db.query(countQuery, [articleId])
    ]);
    
    const totalCount = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalCount / validLimit);
    
    // Получаем реакции для каждого комментария если пользователь авторизован
    const commentsWithReactions = await Promise.all(
      commentsResult.rows.map(async (comment) => {
        const reactionsQuery = `
          SELECT 
            r.id,
            r.emoji,
            r.name,
            COUNT(cr.id) as count,
            ${req.user ? 'MAX(CASE WHEN cr.user_id = $1 THEN 1 ELSE 0 END) as user_reacted' : '0 as user_reacted'}
          FROM reactions r
          LEFT JOIN comment_reactions cr ON r.id = cr.reaction_id AND cr.comment_id = $${req.user ? 2 : 1}
          GROUP BY r.id, r.emoji, r.name
          ORDER BY r.id
        `;
        
        const reactionsParams = req.user ? [req.user.id, comment.id] : [comment.id];
        const reactionsResult = await db.query(reactionsQuery, reactionsParams);
        
        return {
          ...comment,
          reactions_count: parseInt(comment.reactions_count),
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
      comments: commentsWithReactions,
      pagination: {
        page,
        limit: validLimit,
        total: totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
    
  } catch (error) {
    console.error('Ошибка получения комментариев:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

/**
 * @swagger
 * /api/comments/article/{articleId}:
 *   post:
 *     summary: Добавление комментария к статье
 *     tags: [Comments]
 *     security:
 *       - authorization: []
 *     parameters:
 *       - in: path
 *         name: articleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID статьи
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommentRequest'
 *     responses:
 *       201:
 *         description: Комментарий успешно добавлен
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Комментарий успешно добавлен"
 *                 comment:
 *                   $ref: '#/components/schemas/Comment'
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
router.post('/article/:articleId', authenticateToken, validate(commentSchemas.create), async (req, res) => {
  try {
    const articleId = req.params.articleId;
    const { content } = req.body;
    const authorId = req.user.id;
    
    // Проверяем, существует ли статья
    const articleExists = await db.query('SELECT id FROM articles WHERE id = $1', [articleId]);
    if (articleExists.rows.length === 0) {
      return res.status(404).json({ message: 'Статья не найдена' });
    }
    
    // Создаем комментарий
    const createQuery = `
      INSERT INTO comments (content, article_id, author_id)
      VALUES ($1, $2, $3)
      RETURNING id, content, article_id, author_id, created_at, updated_at
    `;
    
    const result = await db.query(createQuery, [content, articleId, authorId]);
    const comment = result.rows[0];
    
    // Получаем данные автора
    const authorQuery = 'SELECT username, avatar_url FROM users WHERE id = $1';
    const authorResult = await db.query(authorQuery, [authorId]);
    const author = authorResult.rows[0];
    
    res.status(201).json({
      message: 'Комментарий успешно добавлен',
      comment: {
        ...comment,
        author_username: author.username,
        author_avatar: author.avatar_url,
        reactions_count: 0,
        reactions: []
      }
    });
    
  } catch (error) {
    console.error('Ошибка создания комментария:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

/**
 * @swagger
 * /api/comments/{id}:
 *   put:
 *     summary: Редактирование комментария
 *     tags: [Comments]
 *     security:
 *       - authorization: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID комментария
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommentRequest'
 *     responses:
 *       200:
 *         description: Комментарий успешно обновлен
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Комментарий успешно обновлен"
 *                 comment:
 *                   $ref: '#/components/schemas/Comment'
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
 *       403:
 *         description: Нет прав для редактирования комментария
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Комментарий не найден
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
router.put('/:id', authenticateToken, checkAuthor('comment'), validate(commentSchemas.update), async (req, res) => {
  try {
    const commentId = req.params.id;
    const { content } = req.body;
    
    const updateQuery = `
      UPDATE comments 
      SET content = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, content, article_id, author_id, created_at, updated_at
    `;
    
    const result = await db.query(updateQuery, [content, commentId]);
    
    // Получаем данные автора
    const authorQuery = 'SELECT username, avatar_url FROM users WHERE id = $1';
    const authorResult = await db.query(authorQuery, [req.user.id]);
    const author = authorResult.rows[0];
    
    res.json({
      message: 'Комментарий успешно обновлен',
      comment: {
        ...result.rows[0],
        author_username: author.username,
        author_avatar: author.avatar_url
      }
    });
    
  } catch (error) {
    console.error('Ошибка обновления комментария:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

/**
 * @swagger
 * /api/comments/{id}:
 *   delete:
 *     summary: Удаление комментария
 *     tags: [Comments]
 *     security:
 *       - authorization: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID комментария
 *     responses:
 *       200:
 *         description: Комментарий успешно удален
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Комментарий успешно удален"
 *                 deletedComment:
 *                   type: object
 *                   properties:
 *                     content:
 *                       type: string
 *                       description: Содержимое удаленного комментария
 *       401:
 *         description: Неавторизован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Нет прав для удаления комментария
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Комментарий не найден
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
router.delete('/:id', authenticateToken, checkAuthor('comment'), async (req, res) => {
  try {
    const commentId = req.params.id;
    
    const deleteQuery = 'DELETE FROM comments WHERE id = $1 RETURNING content';
    const result = await db.query(deleteQuery, [commentId]);
    
    res.json({
      message: 'Комментарий успешно удален',
      deletedComment: {
        content: result.rows[0].content
      }
    });
    
  } catch (error) {
    console.error('Ошибка удаления комментария:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router; 