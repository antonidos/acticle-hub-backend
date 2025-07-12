#!/usr/bin/env node

import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { exit } from 'process';

// Типы коммитов согласно Conventional Commits
const COMMIT_TYPES = [
  {
    name: '✨ feat: Новая функциональность',
    value: '✨ feat',
    description: 'Новая функция или возможность'
  },
  {
    name: '🐛 fix: Исправление бага',
    value: '🐛 fix',
    description: 'Исправление ошибки'
  },
  {
    name: '📝 docs: Документация',
    value: '📝 docs',
    description: 'Изменения в документации'
  },
  {
    name: '💄 style: Стили/форматирование',
    value: '💄 style',
    description: 'Изменения стилей, форматирования кода'
  },
  {
    name: '♻️ refactor: Рефакторинг',
    value: '♻️ refactor',
    description: 'Рефакторинг кода без изменения функциональности'
  },
  {
    name: '✅ test: Тесты',
    value: '✅ test',
    description: 'Добавление или изменение тестов'
  },
  {
    name: '🔧 chore: Рутинные задачи',
    value: '🔧 chore',
    description: 'Обновление зависимостей, настройки сборки и т.д.'
  },
  {
    name: '⚡ perf: Оптимизация производительности',
    value: '⚡ perf',
    description: 'Улучшение производительности'
  },
  {
    name: '🔥 remove: Удаление кода/файлов',
    value: '🔥 remove',
    description: 'Удаление кода или файлов'
  }
];

// Проверка статуса git
function getGitStatus() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    const staged = status.split('\n').filter(line => line.match(/^[MARC]/));
    const unstaged = status.split('\n').filter(line => line.match(/^.[MARC]/));
    const untracked = status.split('\n').filter(line => line.match(/^\?\?/));
    
    return {
      staged: staged.length,
      unstaged: unstaged.length,
      untracked: untracked.length,
      total: staged.length + unstaged.length + untracked.length
    };
  } catch (error) {
    console.error('❌ Ошибка: не git репозиторий или нет git');
    exit(1);
  }
}

// Проверка наличия изменений
function checkForChanges() {
  const status = getGitStatus();
  
  if (status.total === 0) {
    console.log('✅ Нет изменений для коммита');
    exit(0);
  }
  
  console.log('📊 Статус файлов:');
  if (status.staged > 0) console.log(`   📋 Индексированных: ${status.staged}`);
  if (status.unstaged > 0) console.log(`   📝 Неиндексированных: ${status.unstaged}`);
  if (status.untracked > 0) console.log(`   ❓ Неотслеживаемых: ${status.untracked}`);
  console.log('');
  
  return status;
}

// Добавление файлов
async function addFiles(status) {
  if (status.staged === 0 && (status.unstaged > 0 || status.untracked > 0)) {
    const { shouldAdd } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldAdd',
        message: 'Нет индексированных файлов. Добавить все изменения?',
        default: true
      }
    ]);
    
    if (shouldAdd) {
      console.log('📦 Добавляю все файлы...');
      execSync('git add .');
      console.log('✅ Файлы добавлены');
    } else {
      console.log('❌ Отмена коммита');
      exit(0);
    }
  }
}

// Основная функция
async function main() {
  console.log('🚀 Умный коммит\n');
  
  // Проверяем изменения
  const status = checkForChanges();
  
  // Добавляем файлы если нужно
  await addFiles(status);
  
  // Запрашиваем тип коммита
  const { type } = await inquirer.prompt([
    {
      type: 'list',
      name: 'type',
      message: 'Выберите тип изменения:',
      choices: COMMIT_TYPES,
      pageSize: 10
    }
  ]);
  
  // Запрашиваем сообщение коммита
  const { message } = await inquirer.prompt([
    {
      type: 'input',
      name: 'message',
      message: 'Введите сообщение коммита:',
      validate: (input) => {
        if (input.trim().length === 0) {
          return 'Сообщение не может быть пустым';
        }
        if (input.length > 72) {
          return 'Сообщение слишком длинное (максимум 72 символа)';
        }
        return true;
      }
    }
  ]);
  
  // Опциональное расширенное описание
  const { description } = await inquirer.prompt([
    {
      type: 'input',
      name: 'description',
      message: 'Расширенное описание (необязательно):',
    }
  ]);
  
  // Формируем полное сообщение коммита
  let fullMessage = `${type}: ${message}`;
  if (description.trim()) {
    fullMessage += `\n\n${description}`;
  }
  
  // Подтверждение
  console.log('\n📝 Сообщение коммита:');
  console.log(`"${fullMessage}"`);
  
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Подтвердить коммит?',
      default: true
    }
  ]);
  
  if (confirm) {
    try {
      console.log('🔄 Создаю коммит...');
      execSync(`git commit -m "${fullMessage}"`, { stdio: 'inherit' });
      console.log('✅ Коммит создан успешно!');
    } catch (error) {
      console.error('❌ Ошибка при создании коммита:', error.message);
      exit(1);
    }
  } else {
    console.log('❌ Коммит отменен');
    exit(0);
  }
}

// Обработка ошибок
process.on('SIGINT', () => {
  console.log('\n❌ Коммит отменен');
  exit(0);
});

// Запуск
main().catch(error => {
  console.error('❌ Неожиданная ошибка:', error.message);
  exit(1);
}); 