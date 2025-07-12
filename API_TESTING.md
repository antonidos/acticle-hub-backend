# Тестирование API ArticleHub

## Подготовка

1. Убедитесь, что PostgreSQL запущен и настроен
2. Создайте базу данных: `createdb articlehub`
3. Настройте переменные окружения в `.env`
4. Создайте таблицы: `npm run setup-db`
5. Запустите сервер: `npm run dev`

## Тестирование endpoints

### 1. Проверка работоспособности сервера

```bash
curl http://localhost:3000/
```

### 2. Получение доступных реакций

```bash
curl http://localhost:3000/api/reactions
```

### 3. Регистрация пользователя

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 4. Вход пользователя

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Сохраните токен из ответа для дальнейших запросов!**

### 5. Получение профиля пользователя

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 6. Создание статьи

```bash
curl -X POST http://localhost:3000/api/articles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "title": "Моя первая статья",
    "content": "Это содержание первой статьи. Здесь может быть много текста и интересной информации."
  }'
```

### 7. Получение всех статей

```bash
curl http://localhost:3000/api/articles
```

### 8. Получение конкретной статьи

```bash
curl http://localhost:3000/api/articles/1
```

### 9. Добавление комментария к статье

```bash
curl -X POST http://localhost:3000/api/comments/article/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "content": "Отличная статья! Спасибо за информацию."
  }'
```

### 10. Получение комментариев к статье

```bash
curl http://localhost:3000/api/comments/article/1
```

### 11. Добавление реакции к статье

```bash
curl -X POST http://localhost:3000/api/reactions/article/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "reaction_id": 1
  }'
```

### 12. Получение реакций статьи

```bash
curl http://localhost:3000/api/reactions/article/1
```

### 13. Обновление профиля пользователя

```bash
curl -X PUT http://localhost:3000/api/users/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "username": "newusername"
  }'
```

### 14. Редактирование статьи

```bash
curl -X PUT http://localhost:3000/api/articles/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "title": "Обновленный заголовок",
    "content": "Обновленное содержание статьи."
  }'
```

### 15. Загрузка аватара

```bash
curl -X POST http://localhost:3000/api/users/avatar \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "avatar=@/path/to/your/image.jpg"
```

## Параметры запросов

### Пагинация для статей и комментариев

```bash
# Получение второй страницы статей (по 5 статей на странице)
curl "http://localhost:3000/api/articles?page=2&limit=5"

# Поиск статей
curl "http://localhost:3000/api/articles?search=javascript"

# Фильтрация по автору
curl "http://localhost:3000/api/articles?author_id=1"
```

## Коды ответов

- `200` - Успешный запрос
- `201` - Ресурс создан
- `400` - Ошибка валидации данных
- `401` - Требуется авторизация
- `403` - Нет прав доступа
- `404` - Ресурс не найден
- `500` - Ошибка сервера

## Структура ответов

### Успешный ответ
```json
{
  "message": "Операция выполнена успешно",
  "data": { ... }
}
```

### Ошибка валидации
```json
{
  "message": "Ошибка валидации данных",
  "errors": [
    {
      "field": "email",
      "message": "Некорректный email адрес"
    }
  ]
}
```

### Ошибка сервера
```json
{
  "message": "Ошибка сервера"
}
``` 