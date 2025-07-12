const multer = require('multer');
const path = require('path');

// Конфигурация хранения файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_PATH || 'uploads/');
  },
  filename: (req, file, cb) => {
    // Генерируем уникальное имя файла
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    cb(null, `avatar-${req.user.id}-${uniqueSuffix}${fileExtension}`);
  }
});

// Фильтр для проверки типа файла
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Неподдерживаемый тип файла. Разрешены только JPEG, PNG и GIF'), false);
  }
};

// Конфигурация multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.UPLOAD_MAX_SIZE) || 5 * 1024 * 1024 // 5MB по умолчанию
  }
});

// Middleware для обработки ошибок загрузки
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Файл слишком большой (максимум 5MB)' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ message: 'Слишком много файлов' });
    }
    return res.status(400).json({ message: 'Ошибка загрузки файла' });
  }
  
  if (err.message === 'Неподдерживаемый тип файла. Разрешены только JPEG, PNG и GIF') {
    return res.status(400).json({ message: err.message });
  }
  
  next(err);
};

module.exports = {
  uploadAvatar: upload.single('avatar'),
  handleUploadError
}; 