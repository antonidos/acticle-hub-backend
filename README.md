# ArticleHub Backend

Backend API для сайта по написанию и редактированию статей.

## Возможности

- Регистрация и авторизация пользователей
- Создание, редактирование и удаление статей
- Система комментариев
- Система реакций (эмодзи)
- Загрузка аватаров пользователей
- JWT аутентификация
- Валидация данных

## Технологии

- Node.js + Express.js
- PostgreSQL
- JWT для авторизации
- Bcrypt для хеширования паролей
- Joi для валидации данных
- Multer для загрузки файлов

## Установка

1. Клонируйте репозиторий
2. Установите зависимости:
```bash
npm install
```

3. Настройте базу данных PostgreSQL
4. Создайте файл `.env` на основе `.env.example`:
```bash
cp .env.example .env
```

5. Заполните переменные окружения в файле `.env`:
```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=articlehub
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password

JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

PORT=3000
NODE_ENV=development

FRONTEND_URL=http://localhost:3001
```

6. Создайте базу данных и таблицы:
```bash
psql -U postgres -d articlehub -f database/schema.sql
```

7. Создайте папку для загрузки файлов:
```bash
mkdir uploads
```

## Запуск

### Режим разработки:
```bash
npm run dev
```

### Режим продакшена:
```bash
npm start
```

Сервер будет доступен по адресу: `http://localhost:3000`

## API Endpoints

### Аутентификация
- `POST /api/auth/register` - Регистрация
- `POST /api/auth/login` - Вход
- `GET /api/auth/me` - Получение данных текущего пользователя

### Пользователи
- `GET /api/users/profile` - Профиль пользователя
- `PUT /api/users/profile` - Обновление профиля
- `POST /api/users/avatar` - Загрузка аватара

### Статьи
- `GET /api/articles` - Получение всех статей
- `GET /api/articles/:id` - Получение конкретной статьи
- `POST /api/articles` - Создание статьи
- `PUT /api/articles/:id` - Редактирование статьи
- `DELETE /api/articles/:id` - Удаление статьи

### Комментарии
- `GET /api/articles/:id/comments` - Получение комментариев к статье
- `POST /api/articles/:id/comments` - Добавление комментария
- `PUT /api/comments/:id` - Редактирование комментария
- `DELETE /api/comments/:id` - Удаление комментария

### Реакции
- `GET /api/reactions` - Получение всех доступных эмодзи
- `POST /api/articles/:id/reactions` - Добавление реакции к статье
- `DELETE /api/articles/:id/reactions` - Удаление реакции со статьи
- `POST /api/comments/:id/reactions` - Добавление реакции к комментарию
- `DELETE /api/comments/:id/reactions` - Удаление реакции с комментария

## Структура проекта

```
├── config/
│   └── database.js         # Конфигурация базы данных
├── database/
│   └── schema.sql          # SQL схема
├── middleware/
│   ├── auth.js             # Middleware авторизации
│   └── validation.js       # Middleware валидации
├── routes/
│   ├── auth.js             # Маршруты аутентификации
│   ├── users.js            # Маршруты пользователей
│   ├── articles.js         # Маршруты статей
│   ├── comments.js         # Маршруты комментариев
│   └── reactions.js        # Маршруты реакций
├── utils/
│   └── password.js         # Утилиты для работы с паролями
├── uploads/                # Загруженные файлы
└── server.js               # Основной файл сервера
```

## Лицензия

MIT 