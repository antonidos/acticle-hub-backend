const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: process.env.DATABASE_PORT || 5432,
  database: process.env.DATABASE_NAME || 'articlehub',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'password',
  max: 20, // максимум соединений в пуле
  idleTimeoutMillis: 30000, // время ожидания закрытия неактивного соединения
  connectionTimeoutMillis: 2000, // время ожидания подключения
});

// Тестирование подключения
pool.on('connect', () => {
  console.log('Подключение к базе данных установлено');
});

pool.on('error', (err) => {
  console.error('Ошибка подключения к базе данных:', err);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
}; 