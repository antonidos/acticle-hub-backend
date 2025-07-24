const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validate, reactionSchemas } = require('../middleware/validation');

const router = express.Router();

/**
 * @swagger
 * /api/reactions:
 *   get:
 *     summary: Получение всех доступных реакций
 *     tags: [Reactions]
 *     responses:
 *       200:
 *         description: Список доступных реакций
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reactions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         description: ID реакции
 *                       emoji:
 *                         type: string
 *                         description: Эмодзи реакции
 *                       name:
 *                         type: string
 *                         description: Название реакции
 *       500:
 *         description: Внутренняя ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', async (req, res) => {
  try {
    const reactionsQuery = 'SELECT id, emoji, name FROM reactions ORDER BY id';
    const result = await db.query(reactionsQuery);
    
    res.json({
      reactions: result.rows
    });
    
  } catch (error) {
    console.error('Ошибка получения реакций:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

/**
 * @swagger
 * /api/reactions/article/{articleId}:
 *   post:
 *     summary: Добавление или изменение реакции к статье
 *     description: Пользователь может иметь только одну реакцию на статью. При установке новой реакции предыдущая автоматически удаляется.
 *     tags: [Reactions]
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
 *             type: object
 *             required:
 *               - reaction_id
 *             properties:
 *               reaction_id:
 *                 type: integer
 *                 description: ID реакции
 *     responses:
 *       201:
 *         description: Реакция успешно добавлена или изменена
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Реакция успешно добавлена"
 *                 reaction:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     article_id:
 *                       type: integer
 *                     user_id:
 *                       type: integer
 *                     reaction_id:
 *                       type: integer
 *                     emoji:
 *                       type: string
 *                     name:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Вы уже поставили эту реакцию
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
 *         description: Статья или реакция не найдена
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
router.post('/article/:articleId', authenticateToken, validate(reactionSchemas.create), async (req, res) => {
  try {
    const articleId = req.params.articleId;
    const { reaction_id } = req.body;
    const userId = req.user.id;
    
    // Проверяем, существует ли статья
    const articleExists = await db.query('SELECT id FROM articles WHERE id = $1', [articleId]);
    if (articleExists.rows.length === 0) {
      return res.status(404).json({ message: 'Статья не найдена' });
    }
    
    // Проверяем, существует ли реакция
    const reactionExists = await db.query('SELECT id, emoji, name FROM reactions WHERE id = $1', [reaction_id]);
    if (reactionExists.rows.length === 0) {
      return res.status(404).json({ message: 'Реакция не найдена' });
    }
    
    // Проверяем, есть ли уже реакция от этого пользователя на эту статью
    const existingReaction = await db.query(
      'SELECT id, reaction_id FROM article_reactions WHERE article_id = $1 AND user_id = $2',
      [articleId, userId]
    );
    
    // Если пользователь уже поставил эту же реакцию, возвращаем ошибку
    if (existingReaction.rows.length > 0 && existingReaction.rows[0].reaction_id == reaction_id) {
      return res.status(400).json({ message: 'Вы уже поставили эту реакцию' });
    }
    
    // Если есть другая реакция от этого пользователя, удаляем её
    if (existingReaction.rows.length > 0) {
      await db.query(
        'DELETE FROM article_reactions WHERE article_id = $1 AND user_id = $2',
        [articleId, userId]
      );
    }
    
    // Добавляем новую реакцию
    const insertQuery = `
      INSERT INTO article_reactions (article_id, user_id, reaction_id)
      VALUES ($1, $2, $3)
      RETURNING id, created_at
    `;
    
    const result = await db.query(insertQuery, [articleId, userId, reaction_id]);
    const reaction = reactionExists.rows[0];
    
    res.status(201).json({
      message: existingReaction.rows.length > 0 ? 'Реакция успешно изменена' : 'Реакция успешно добавлена',
      reaction: {
        id: result.rows[0].id,
        article_id: parseInt(articleId),
        user_id: userId,
        reaction_id: reaction_id,
        emoji: reaction.emoji,
        name: reaction.name,
        created_at: result.rows[0].created_at
      }
    });
    
  } catch (error) {
    console.error('Ошибка добавления реакции к статье:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

/**
 * @swagger
 * /api/reactions/article/{articleId}:
 *   delete:
 *     summary: Удаление реакции к статье
 *     tags: [Reactions]
 *     security:
 *       - authorization: []
 *     parameters:
 *       - in: path
 *         name: articleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID статьи
 *     responses:
 *       201:
 *         description: Реакция успешно удалена
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Реакция успешно удалена"
 *       400:
 *         description: Вы не поставили реакцию на эту статью
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
 *         description: Статья или реакция не найдена
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
router.delete('/article/:articleId', authenticateToken, validate(reactionSchemas.create), async (req, res) => {
  try {
    const articleId = req.params.articleId;
    const userId = req.user.id;
    
    // Проверяем, существует ли статья
    const articleExists = await db.query('SELECT id FROM articles WHERE id = $1', [articleId]);
    if (articleExists.rows.length === 0) {
      return res.status(404).json({ message: 'Статья не найдена' });
    }
    
    // Удаляем реакцию
    const deleteQuery = `
      DELETE FROM article_reactions 
      WHERE article_id = $1 AND user_id = $2
      RETURNING id
    `;
    
    const result = await db.query(deleteQuery, [articleId, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Реакция не найдена' });
    }
    
    res.json({
      message: 'Реакция успешно удалена'
    });
    
  } catch (error) {
    console.error('Ошибка удаления реакции со статьи:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

/**
 * @swagger
 * /api/reactions/article/{articleId}:
 *   get:
 *     summary: Получение реакций статьи
 *     tags: [Reactions]
 *     parameters:
 *       - in: path
 *         name: articleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID статьи
 *     responses:
 *       200:
 *         description: Список реакций статьи
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reactions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         description: ID реакции
 *                       emoji:
 *                         type: string
 *                         description: Эмодзи реакции
 *                       name:
 *                         type: string
 *                         description: Название реакции
 *                       count:
 *                         type: integer
 *                         description: Количество этих реакций
 *                       users:
 *                         type: array
 *                         items:
 *                           type: string
 *                         description: Пользователи, поставившие эту реакцию
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
router.get('/article/:articleId', async (req, res) => {
  try {
    const articleId = req.params.articleId;
    
    // Проверяем, существует ли статья
    const articleExists = await db.query('SELECT id FROM articles WHERE id = $1', [articleId]);
    if (articleExists.rows.length === 0) {
      return res.status(404).json({ message: 'Статья не найдена' });
    }
    
    const reactionsQuery = `
      SELECT 
        r.id,
        r.emoji,
        r.name,
        COUNT(ar.id) as count,
        ARRAY_AGG(DISTINCT u.username) FILTER (WHERE u.username IS NOT NULL) as users
      FROM reactions r
      LEFT JOIN article_reactions ar ON r.id = ar.reaction_id AND ar.article_id = $1
      LEFT JOIN users u ON ar.user_id = u.id
      GROUP BY r.id, r.emoji, r.name
      ORDER BY r.id
    `;
    
    const result = await db.query(reactionsQuery, [articleId]);
    
    res.json({
      reactions: result.rows.map(r => ({
        id: r.id,
        emoji: r.emoji,
        name: r.name,
        count: parseInt(r.count),
        users: r.users || []
      }))
    });
    
  } catch (error) {
    console.error('Ошибка получения реакций статьи:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

/**
 * @swagger
 * /api/reactions/comment/{commentId}:
 *   post:
 *     summary: Добавление или изменение реакции к комментарию
 *     description: Пользователь может иметь только одну реакцию на комментарий. При установке новой реакции предыдущая автоматически удаляется.
 *     tags: [Reactions]
 *     security:
 *       - authorization: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID комментария
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reaction_id
 *             properties:
 *               reaction_id:
 *                 type: integer
 *                 description: ID реакции
 *     responses:
 *       201:
 *         description: Реакция успешно добавлена или изменена
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Реакция успешно добавлена"
 *                 reaction:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     comment_id:
 *                       type: integer
 *                     user_id:
 *                       type: integer
 *                     reaction_id:
 *                       type: integer
 *                     emoji:
 *                       type: string
 *                     name:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Вы уже поставили эту реакцию
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
 *         description: Комментарий или реакция не найдена
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
router.post('/comment/:commentId', authenticateToken, validate(reactionSchemas.create), async (req, res) => {
  try {
    const commentId = req.params.commentId;
    const { reaction_id } = req.body;
    const userId = req.user.id;
    
    // Проверяем, существует ли комментарий
    const commentExists = await db.query('SELECT id FROM comments WHERE id = $1', [commentId]);
    if (commentExists.rows.length === 0) {
      return res.status(404).json({ message: 'Комментарий не найден' });
    }
    
    // Проверяем, существует ли реакция
    const reactionExists = await db.query('SELECT id, emoji, name FROM reactions WHERE id = $1', [reaction_id]);
    if (reactionExists.rows.length === 0) {
      return res.status(404).json({ message: 'Реакция не найдена' });
    }
    
    // Проверяем, есть ли уже реакция от этого пользователя на этот комментарий
    const existingReaction = await db.query(
      'SELECT id, reaction_id FROM comment_reactions WHERE comment_id = $1 AND user_id = $2',
      [commentId, userId]
    );
    
    // Если пользователь уже поставил эту же реакцию, возвращаем ошибку
    if (existingReaction.rows.length > 0 && existingReaction.rows[0].reaction_id == reaction_id) {
      return res.status(400).json({ message: 'Вы уже поставили эту реакцию' });
    }
    
    // Если есть другая реакция от этого пользователя, удаляем её
    if (existingReaction.rows.length > 0) {
      await db.query(
        'DELETE FROM comment_reactions WHERE comment_id = $1 AND user_id = $2',
        [commentId, userId]
      );
    }
    
    // Добавляем новую реакцию
    const insertQuery = `
      INSERT INTO comment_reactions (comment_id, user_id, reaction_id)
      VALUES ($1, $2, $3)
      RETURNING id, created_at
    `;
    
    const result = await db.query(insertQuery, [commentId, userId, reaction_id]);
    const reaction = reactionExists.rows[0];
    
    res.status(201).json({
      message: existingReaction.rows.length > 0 ? 'Реакция успешно изменена' : 'Реакция успешно добавлена',
      reaction: {
        id: result.rows[0].id,
        comment_id: parseInt(commentId),
        user_id: userId,
        reaction_id: reaction_id,
        emoji: reaction.emoji,
        name: reaction.name,
        created_at: result.rows[0].created_at
      }
    });
    
  } catch (error) {
    console.error('Ошибка добавления реакции к комментарию:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

/**
 * @swagger
 * /api/reactions/comment/{commentId}:
 *   delete:
 *     summary: Удаление реакции к комментарию
 *     description: Пользователь может иметь только одну реакцию на комментарий. При установке новой реакции предыдущая автоматически удаляется.
 *     tags: [Reactions]
 *     security:
 *       - authorization: []
 *     parameters:
 *       - in: path
 *         name: articleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID статьи
 *     responses:
 *       201:
 *         description: Реакция успешно добавлена или изменена
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Реакция успешно добавлена"
 *       400:
 *         description: Вы уже поставили эту реакцию
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
 *         description: Статья или реакция не найдена
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
router.delete('/comment/:commentId', authenticateToken, validate(reactionSchemas.create), async (req, res) => {
  try {
    const commentId = req.params.commentId;
    const userId = req.user.id;
    
    // Проверяем, существует ли комментарий
    const commentExists = await db.query('SELECT id FROM comments WHERE id = $1', [commentId]);
    if (commentExists.rows.length === 0) {
      return res.status(404).json({ message: 'Комментарий не найден' });
    }
    
    // Удаляем реакцию
    const deleteQuery = `
      DELETE FROM comment_reactions 
      WHERE comment_id = $1 AND user_id = $2
      RETURNING id
    `;
    
    const result = await db.query(deleteQuery, [commentId, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Реакция не найдена' });
    }
    
    res.json({
      message: 'Реакция успешно удалена'
    });
    
  } catch (error) {
    console.error('Ошибка удаления реакции с комментария:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Получение реакций комментария
router.get('/comment/:commentId', async (req, res) => {
  try {
    const commentId = req.params.commentId;
    
    // Проверяем, существует ли комментарий
    const commentExists = await db.query('SELECT id FROM comments WHERE id = $1', [commentId]);
    if (commentExists.rows.length === 0) {
      return res.status(404).json({ message: 'Комментарий не найден' });
    }
    
    const reactionsQuery = `
      SELECT 
        r.id,
        r.emoji,
        r.name,
        COUNT(cr.id) as count,
        ARRAY_AGG(DISTINCT u.username) FILTER (WHERE u.username IS NOT NULL) as users
      FROM reactions r
      LEFT JOIN comment_reactions cr ON r.id = cr.reaction_id AND cr.comment_id = $1
      LEFT JOIN users u ON cr.user_id = u.id
      GROUP BY r.id, r.emoji, r.name
      ORDER BY r.id
    `;
    
    const result = await db.query(reactionsQuery, [commentId]);
    
    res.json({
      reactions: result.rows.map(r => ({
        id: r.id,
        emoji: r.emoji,
        name: r.name,
        count: parseInt(r.count),
        users: r.users || []
      }))
    });
    
  } catch (error) {
    console.error('Ошибка получения реакций комментария:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router; 
