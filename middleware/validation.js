const Joi = require('joi');

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        message: 'Ошибка валидации данных',
        errors: errorDetails
      });
    }
    
    next();
  };
};

// Схемы валидации для пользователей
const userSchemas = {
  register: Joi.object({
    username: Joi.string()
      .alphanum()
      .min(3)
      .max(30)
      .required()
      .messages({
        'string.alphanum': 'Имя пользователя должно содержать только буквы и цифры',
        'string.min': 'Имя пользователя должно содержать минимум 3 символа',
        'string.max': 'Имя пользователя не должно превышать 30 символов',
        'any.required': 'Имя пользователя обязательно'
      }),
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Некорректный email адрес',
        'any.required': 'Email обязателен'
      }),
    password: Joi.string()
      .min(6)
      .required()
      .messages({
        'string.min': 'Пароль должен содержать минимум 6 символов',
        'any.required': 'Пароль обязателен'
      })
  }),
  
  login: Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Некорректный email адрес',
        'any.required': 'Email обязателен'
      }),
    password: Joi.string()
      .required()
      .messages({
        'any.required': 'Пароль обязателен'
      })
  }),
  
  updateProfile: Joi.object({
    username: Joi.string()
      .alphanum()
      .min(3)
      .max(30)
      .optional()
      .messages({
        'string.alphanum': 'Имя пользователя должно содержать только буквы и цифры',
        'string.min': 'Имя пользователя должно содержать минимум 3 символа',
        'string.max': 'Имя пользователя не должно превышать 30 символов'
      }),
    email: Joi.string()
      .email()
      .optional()
      .messages({
        'string.email': 'Некорректный email адрес'
      })
  })
};

// Схемы валидации для статей
const articleSchemas = {
  create: Joi.object({
    title: Joi.string()
      .min(3)
      .max(255)
      .required()
      .messages({
        'string.min': 'Заголовок должен содержать минимум 3 символа',
        'string.max': 'Заголовок не должен превышать 255 символов',
        'any.required': 'Заголовок обязателен'
      }),
    content: Joi.string()
      .min(10)
      .required()
      .messages({
        'string.min': 'Содержание должно содержать минимум 10 символов',
        'any.required': 'Содержание обязательно'
      })
  }),
  
  update: Joi.object({
    title: Joi.string()
      .min(3)
      .max(255)
      .optional()
      .messages({
        'string.min': 'Заголовок должен содержать минимум 3 символа',
        'string.max': 'Заголовок не должен превышать 255 символов'
      }),
    content: Joi.string()
      .min(10)
      .optional()
      .messages({
        'string.min': 'Содержание должно содержать минимум 10 символов'
      })
  })
};

// Схемы валидации для комментариев
const commentSchemas = {
  create: Joi.object({
    content: Joi.string()
      .min(1)
      .max(1000)
      .required()
      .messages({
        'string.min': 'Комментарий не может быть пустым',
        'string.max': 'Комментарий не должен превышать 1000 символов',
        'any.required': 'Содержание комментария обязательно'
      })
  }),
  
  update: Joi.object({
    content: Joi.string()
      .min(1)
      .max(1000)
      .required()
      .messages({
        'string.min': 'Комментарий не может быть пустым',
        'string.max': 'Комментарий не должен превышать 1000 символов',
        'any.required': 'Содержание комментария обязательно'
      })
  })
};

// Схемы валидации для реакций
const reactionSchemas = {
  create: Joi.object({
    reaction_id: Joi.number()
      .integer()
      .positive()
      .required()
      .messages({
        'number.base': 'ID реакции должно быть числом',
        'number.integer': 'ID реакции должно быть целым числом',
        'number.positive': 'ID реакции должно быть положительным числом',
        'any.required': 'ID реакции обязательно'
      })
  })
};

module.exports = {
  validate,
  userSchemas,
  articleSchemas,
  commentSchemas,
  reactionSchemas
}; 