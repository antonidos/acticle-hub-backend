const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Загружаем переменные окружения
require('dotenv').config();

async function setupDatabase() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: process.env.DATABASE_PORT || 5432,
    database: process.env.DATABASE_NAME || 'articlehub',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'password',
  });

  try {
    console.log('Подключение к базе данных...');
    
    // Проверяем подключение
    const client = await pool.connect();
    console.log('✅ Подключение к базе данных установлено');
    
    // Читаем SQL-скрипт
    const sqlScript = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');
    
    console.log('Создание таблиц...');
    
    // Выполняем SQL-скрипт
    await client.query(sqlScript);
    
    console.log('✅ Таблицы успешно созданы');
    
    // Проверяем, что таблицы созданы
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    const result = await client.query(tablesQuery);
    console.log('📋 Созданные таблицы:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Проверяем, что базовые реакции добавлены
    const reactionsQuery = 'SELECT COUNT(*) as count FROM reactions';
    const reactionsResult = await client.query(reactionsQuery);
    console.log(`🎭 Добавлено реакций: ${reactionsResult.rows[0].count}`);
    
    client.release();
    
  } catch (error) {
    console.error('❌ Ошибка при настройке базы данных:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('✅ Настройка базы данных завершена');
  }
}

setupDatabase(); 