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
 * /api/users/profile:
 *   get:
 *     summary: Получение профиля текущего пользователя
 *     tags: [Users]
 *     security:
 *       - authorization: []
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
 *                     email:
 *                       type: string
 *                       format: email
 *                       description: Email пользователя
 *                     avatar_url:
 *                       type: string
 *                       format: uri
 *                       description: URL аватара
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       description: Дата создания аккаунта
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                       description: Дата последнего обновления
 *                     statistics:
 *                       type: object
 *                       properties:
 *                         articles_count:
 *                           type: integer
 *                           description: Количество статей пользователя
 *                         comments_count:
 *                           type: integer
 *                           description: Количество комментариев пользователя
 *       401:
 *         description: Неавторизован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Пользователь не найден
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
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userQuery = `
      SELECT 
        u.id, 
        u.username, 
        u.email, 
        u.avatar_url, 
        u.created_at, 
        u.updated_at,
        COUNT(DISTINCT a.id) as articles_count,
        COUNT(DISTINCT c.id) as comments_count
      FROM users u
      LEFT JOIN articles a ON u.id = a.author_id
      LEFT JOIN comments c ON u.id = c.author_id
      WHERE u.id = $1
      GROUP BY u.id, u.username, u.email, u.avatar_url, u.created_at, u.updated_at
    `;
    
    const userResult = await db.query(userQuery, [req.user.id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    const user = userResult.rows[0];

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
        updated_at: user.updated_at,
        statistics: {
          articles_count: parseInt(user.articles_count),
          comments_count: parseInt(user.comments_count)
        }
      }
    });

  } catch (error) {
    console.error('Ошибка получения профиля:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Обновление профиля пользователя
 *     tags: [Users]
 *     security:
 *       - authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *                 description: Новое имя пользователя
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Новый email пользователя
 *     responses:
 *       200:
 *         description: Профиль успешно обновлен
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Профиль успешно обновлен"
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Ошибка валидации данных или пользователь с таким именем/email уже существует
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
router.put('/profile', authenticateToken, validate(userSchemas.updateProfile), async (req, res) => {
  try {
    const { username, email } = req.body;
    const userId = req.user.id;

    // Проверяем, не заняты ли новые username или email другими пользователями
    if (username || email) {
      const checkQuery = `
        SELECT id FROM users 
        WHERE (username = $1 OR email = $2) AND id != $3
      `;
      const existingUser = await db.query(checkQuery, [username, email, userId]);

      if (existingUser.rows.length > 0) {
        return res.status(400).json({ 
          message: 'Пользователь с таким именем или email уже существует' 
        });
      }
    }

    // Строим динамический запрос для обновления
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (username) {
      updateFields.push(`username = $${paramIndex}`);
      updateValues.push(username);
      paramIndex++;
    }

    if (email) {
      updateFields.push(`email = $${paramIndex}`);
      updateValues.push(email);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'Нет данных для обновления' });
    }

    updateValues.push(userId);

    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $${paramIndex}
      RETURNING id, username, email, avatar_url, updated_at
    `;

    const result = await db.query(updateQuery, updateValues);

    res.json({
      message: 'Профиль успешно обновлен',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Ошибка обновления профиля:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

/**
 * @swagger
 * /api/users/avatar:
 *   post:
 *     summary: Загрузка аватара пользователя
 *     tags: [Users]
 *     security:
 *       - authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Файл аватара (JPG, PNG, GIF, максимум 5MB)
 *             required:
 *               - avatar
 *     responses:
 *       200:
 *         description: Аватар успешно загружен
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Аватар успешно загружен"
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       description: ID пользователя
 *                     username:
 *                       type: string
 *                       description: Имя пользователя
 *                     email:
 *                       type: string
 *                       format: email
 *                       description: Email пользователя
 *                     avatar_url:
 *                       type: string
 *                       format: uri
 *                       description: URL аватара
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                       description: Дата последнего обновления
 *       400:
 *         description: Файл не загружен или неверный формат
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
router.post('/avatar', authenticateToken, uploadAvatar, handleUploadError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Файл не загружен' });
    }

    const userId = req.user.id;
    const avatarUrl = `/uploads/${req.file.filename}`;

    // Получаем старый аватар для удаления
    const oldAvatarQuery = 'SELECT avatar_url FROM users WHERE id = $1';
    const oldAvatarResult = await db.query(oldAvatarQuery, [userId]);
    const oldAvatarUrl = oldAvatarResult.rows[0]?.avatar_url;

    // Обновляем аватар в базе данных
    const updateQuery = `
      UPDATE users 
      SET avatar_url = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2
      RETURNING id, username, email, avatar_url, updated_at
    `;

    const result = await db.query(updateQuery, [avatarUrl, userId]);

    // Удаляем старый аватар если он существует
    if (oldAvatarUrl && oldAvatarUrl !== avatarUrl) {
      const oldFilePath = path.join(process.cwd(), oldAvatarUrl);
      fs.unlink(oldFilePath, (err) => {
        if (err) console.error('Ошибка удаления старого аватара:', err);
      });
    }

    res.json({
      message: 'Аватар успешно загружен',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Ошибка загрузки аватара:', error);
    
    // Удаляем загруженный файл в случае ошибки
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Ошибка удаления файла:', err);
      });
    }
    
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

/**
 * @swagger
 * /api/users/avatar:
 *   delete:
 *     summary: Удаление аватара пользователя
 *     tags: [Users]
 *     security:
 *       - authorization: []
 *     responses:
 *       200:
 *         description: Аватар успешно удален
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Аватар успешно удален"
 *       404:
 *         description: Аватар не найден
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
router.delete('/avatar', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Получаем текущий аватар
    const avatarQuery = 'SELECT avatar_url FROM users WHERE id = $1';
    const avatarResult = await db.query(avatarQuery, [userId]);
    const avatarUrl = avatarResult.rows[0]?.avatar_url;

    if (!avatarUrl) {
      return res.status(404).json({ message: 'Аватар не найден' });
    }

    // Удаляем аватар из базы данных
    const updateQuery = `
      UPDATE users 
      SET avatar_url = NULL, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1
      RETURNING id, username, email, avatar_url, updated_at
    `;

    const result = await db.query(updateQuery, [userId]);

    // Удаляем файл аватара
    const filePath = path.join(process.cwd(), avatarUrl);
    fs.unlink(filePath, (err) => {
      if (err) console.error('Ошибка удаления файла аватара:', err);
    });

    res.json({
      message: 'Аватар успешно удален',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Ошибка удаления аватара:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

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