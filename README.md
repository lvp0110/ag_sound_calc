# Калькулятор конструкций (calc-react)

React-приложение для расчета акустических конструкций изоляции.

## Технологии

- **React 19** - UI библиотека
- **Vite** - сборщик и dev-сервер
- **React Router** - маршрутизация
- **ExcelJS** - экспорт в Excel

## Установка

```bash
npm install
```

## Разработка

Запуск dev-сервера:

```bash
npm run dev
```

Приложение будет доступно по адресу `http://localhost:5173`

## Сборка

Создание production сборки:

```bash
npm run build
```

Результат будет в папке `dist/`

## Предпросмотр production сборки

```bash
npm run preview
```

## Структура проекта

```
calc-react/
├── public/          # Статические файлы
├── src/
│   ├── components/  # React компоненты
│   ├── data/        # Данные (категории, элементы)
│   ├── services/    # API сервисы
│   └── constants/   # Константы
├── vite.config.js   # Конфигурация Vite
└── package.json     # Зависимости проекта
```

## API

Приложение использует API для получения данных о конструкциях:
- Dev режим: прокси через `/api` на `https://dev3.constrtodo.ru:3005` (настроен в `vite.config.js`)
- Production: прямой запрос к `https://dev3.constrtodo.ru:3005/api/v1`

## Публикация на GitHub Pages

Проект настроен для автоматического деплоя на GitHub Pages через GitHub Actions.

### Автоматический деплой (рекомендуется)

1. **Включите GitHub Pages в настройках репозитория:**
   - Перейдите в `Settings` → `Pages`
   - В разделе `Source` выберите `GitHub Actions`

2. **Настройка base path:**
   - Если репозиторий называется `username.github.io`, измените в `.github/workflows/deploy.yml` строку:
     ```yaml
     BASE_PATH: /
     ```
   - Для остальных репозиториев путь будет автоматически `/repository-name/`

3. **Публикация:**
   - Просто запушьте изменения в ветку `main`
   - GitHub Actions автоматически соберет и опубликует проект
   - Ссылка будет доступна в `Settings` → `Pages` после первого деплоя

### Ручной деплой

Если хотите опубликовать вручную:

```bash
# Установите зависимости (включая gh-pages)
npm install

# Опубликуйте
BASE_PATH=/ag_sound_calc/ npm run build
npx gh-pages -d dist
```

**Важно:** Проект настроен для репозитория `ag_sound_calc`. Сайт будет доступен по адресу: https://lvp0110.github.io/ag_sound_calc/

**Примечание:** Для работы в production на сервере `dev3.constrtodo.ru:3005` должен быть настроен CORS для домена `https://lvp0110.github.io`.

## Лицензия

Private project

