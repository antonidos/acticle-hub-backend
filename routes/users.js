const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validate, userSchemas } = require('../middleware/validation');
const { uploadAvatar, handleUploadError } = require('../middleware/upload');

const router = express.Router();

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Получение профиля пользователя по ID
 *     tags: [Users]
 *     security:
 *       - authorization: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID пользователя
 *     responses:
 *       200:
 *         description: Профиль пользователя получен успешно
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       description: ID пользователя
 *                     username:
 *                       type: string
 *                       description: Имя пользователя
 *                     avatar_url:
 *                       type: string
 *                       format: uri
 *                       description: URL аватара
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       description: Дата создания аккаунта
 *                     statistics:
 *                       type: object
 *                       properties:
 *                         articles_count:
 *                           type: integer
 *                           description: Количество статей пользователя
 *                         comments_count:
 *                           type: integer
 *                           description: Количество комментариев пользователя
 *       404:
 *         description: Пользователь не найден
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
router.get('/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    const userQuery = `
      SELECT 
        u.id, 
        u.username, 
        u.avatar_url, 
        u.created_at,
        COUNT(DISTINCT a.id) as articles_count,
        COUNT(DISTINCT c.id) as comments_count
      FROM users u
      LEFT JOIN articles a ON u.id = a.author_id
      LEFT JOIN comments c ON u.id = c.author_id
      WHERE u.id = $1
      GROUP BY u.id, u.username, u.avatar_url, u.created_at
    `;

    const userResult = await db.query(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    const user = userResult.rows[0];

    res.json({
      user: {
        id: user.id,
        username: user.username,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
        statistics: {
          articles_count: parseInt(user.articles_count),
          comments_count: parseInt(user.comments_count)
        }
      }
    });

  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router; 