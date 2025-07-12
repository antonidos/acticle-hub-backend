const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ArticleHub API',
      version: '1.0.0',
      description: 'API для системы управления статьями с возможностью комментирования и реакций',
      contact: {
        name: 'ArticleHub Support',
        email: 'support@articlehub.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://api.articlehub.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Уникальный идентификатор пользователя'
            },
            username: {
              type: 'string',
              description: 'Имя пользователя'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email пользователя'
            },
            avatar_url: {
              type: 'string',
              format: 'uri',
              description: 'URL аватара пользователя'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Дата создания аккаунта'
            }
          }
        },
        Article: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Уникальный идентификатор статьи'
            },
            title: {
              type: 'string',
              description: 'Заголовок статьи'
            },
            content: {
              type: 'string',
              description: 'Содержание статьи'
            },
            author_id: {
              type: 'integer',
              description: 'Идентификатор автора'
            },
            author_username: {
              type: 'string',
              description: 'Имя автора'
            },
            author_avatar: {
              type: 'string',
              format: 'uri',
              description: 'Аватар автора'
            },
            comments_count: {
              type: 'integer',
              description: 'Количество комментариев'
            },
            reactions_count: {
              type: 'integer',
              description: 'Количество реакций'
            },
            reactions: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Reaction'
              }
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Дата создания статьи'
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'Дата последнего обновления'
            }
          }
        },
        Comment: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Уникальный идентификатор комментария'
            },
            content: {
              type: 'string',
              description: 'Содержание комментария'
            },
            article_id: {
              type: 'integer',
              description: 'Идентификатор статьи'
            },
            author_id: {
              type: 'integer',
              description: 'Идентификатор автора комментария'
            },
            author_username: {
              type: 'string',
              description: 'Имя автора комментария'
            },
            author_avatar: {
              type: 'string',
              format: 'uri',
              description: 'Аватар автора комментария'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Дата создания комментария'
            }
          }
        },
        Reaction: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Идентификатор реакции'
            },
            emoji: {
              type: 'string',
              description: 'Эмодзи реакции'
            },
            name: {
              type: 'string',
              description: 'Название реакции'
            },
            count: {
              type: 'integer',
              description: 'Количество реакций данного типа'
            },
            user_reacted: {
              type: 'boolean',
              description: 'Поставил ли текущий пользователь эту реакцию'
            }
          }
        },
        RegisterRequest: {
          type: 'object',
          required: ['username', 'email', 'password'],
          properties: {
            username: {
              type: 'string',
              minLength: 3,
              maxLength: 50,
              description: 'Имя пользователя'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email пользователя'
            },
            password: {
              type: 'string',
              minLength: 6,
              description: 'Пароль пользователя'
            }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'Email пользователя'
            },
            password: {
              type: 'string',
              description: 'Пароль пользователя'
            }
          }
        },
        ArticleRequest: {
          type: 'object',
          required: ['title', 'content'],
          properties: {
            title: {
              type: 'string',
              minLength: 1,
              maxLength: 255,
              description: 'Заголовок статьи'
            },
            content: {
              type: 'string',
              minLength: 1,
              description: 'Содержание статьи'
            }
          }
        },
        CommentRequest: {
          type: 'object',
          required: ['content'],
          properties: {
            content: {
              type: 'string',
              minLength: 1,
              description: 'Содержание комментария'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Сообщение об ошибке'
            },
            error: {
              type: 'object',
              description: 'Дополнительная информация об ошибке'
            }
          }
        }
      }
    }
  },
  apis: ['./routes/*.js', './server.js']
};

const specs = swaggerJSDoc(options);

module.exports = {
  specs,
  swaggerUi
}; 