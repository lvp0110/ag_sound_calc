# Калькулятор конструкций (calc-react)

React-приложение для расчета акустических конструкций изоляции.

## Технологии

- **React 19** - UI библиотека
- **Vite** - сборщик и dev-сервер
- **React Router** - маршрутизация
- **ExcelJS** - экспорт в Excel
- **SweetAlert2** - модальные окна

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
- Dev режим: прокси через `/api` на `https://db.acoustic.ru:3005`
- Production: прямой запрос к `https://db.acoustic.ru:3005/api/v1`

## Лицензия

Private project

