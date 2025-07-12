const jwt = require('jsonwebtoken');
const db = require('../config/database');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Токен доступа не предоставлен' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Проверяем, существует ли пользователь в базе данных
    const userQuery = 'SELECT id, username, email, avatar_url FROM users WHERE id = $1';
    const userResult = await db.query(userQuery, [decoded.userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Пользователь не найден' });
    }
    
    req.user = userResult.rows[0];
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Токен истек' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Неверный токен' });
    }
    return res.status(500).json({ message: 'Ошибка сервера при проверке токена' });
  }
};

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const userQuery = 'SELECT id, username, email, avatar_url FROM users WHERE id = $1';
    const userResult = await db.query(userQuery, [decoded.userId]);
    
    if (userResult.rows.length === 0) {
      req.user = null;
    } else {
      req.user = userResult.rows[0];
    }
    
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

// Middleware для проверки, является ли пользователь автором ресурса
const checkAuthor = (resourceType) => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params.id;
      let query;
      
      switch (resourceType) {
        case 'article':
          query = 'SELECT author_id FROM articles WHERE id = $1';
          break;
        case 'comment':
          query = 'SELECT author_id FROM comments WHERE id = $1';
          break;
        default:
          return res.status(400).json({ message: 'Неверный тип ресурса' });
      }
      
      const result = await db.query(query, [resourceId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Ресурс не найден' });
      }
      
      if (result.rows[0].author_id !== req.user.id) {
        return res.status(403).json({ message: 'Нет прав доступа' });
      }
      
      next();
    } catch (error) {
      return res.status(500).json({ message: 'Ошибка сервера' });
    }
  };
};

module.exports = {
  authenticateToken,
  optionalAuth,
  checkAuthor
}; 