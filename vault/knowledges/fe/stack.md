# Frontend-стек (2025-2026)

## Основные технологии

| Технология | Версия | Описание |
|------------|---------|-------------|
| React | 18.3.1 | UI-библиотека с хуками и конкурентными возможностями |
| TypeScript | последняя | Типизированный JavaScript |
| React Router | 6.30.1 | Маршрутизация с вложенными роутами, ленивой загрузкой, загрузчиками данных и мутациями |

## Управление состоянием

| Библиотека | Описание |
|---------|-------------|
| React Query | Управление серверным состоянием: кэширование, фоновая синхронизация, повторные запросы при ошибке, мутации и оптимистичные обновления |
| Axios | HTTP-клиент с перехватчиками, отменой запросов и автоматической сериализацией |

## Сборка и разработка

| Инструмент | Описание |
|------|-------------|
| Rsbuild | Современный сборщик на базе Rspack (альтернатива Webpack с ускоренной сборкой). Поддерживает TypeScript, CSS Modules, Module Federation, HMR «из коробки». |
| Webpack | Легаси-сборщик (все ещё используется в некоторых контекстах) |

## Качество кода

| Инструмент | Описание |
|------|-------------|
| ESLint | Линтинг и статический анализ кода |
| Prettier | Автоматическое форматирование кода и единый стиль |

## Стилизация

| Подход | Описание |
|----------|-------------|
| CSS Modules | Классы ограничены областью видимости компонента, исключая конфликты имён |
| @sds-eng/base | Корпоративный UI-кит от SDS с компонентами, токенами, темами и утилитами |

## Стайлгайд (ESLint + Prettier)

**Конфигурационные файлы:** `eslint.config.js` и `prettier.config.cjs` в корне проекта (`/workspace/gitea/`)

### Prettier
- `printWidth`: 120
- `tabWidth`: 2
- `semi`: true (точки с запятой)
- `singleQuote`: true (одинарные кавычки)
- `trailingComma`: 'all'
- `arrowParens`: 'always'
- `bracketSpacing`: true
- `endOfLine`: 'lf'

### ESLint
- **Плагины:**
  - `@eslint/js` — базовые правила
  - `@typescript-eslint` — TypeScript
  - `eslint-plugin-react` — React
  - `eslint-plugin-react-hooks` — хуки
  - `eslint-plugin-import` — импорты
  - `eslint-plugin-prettier` — форматирование
  - `eslint-plugin-simple-import-sort` — сортировка импортов
  - `@tanstack/eslint-plugin-query` — React Query

- **Правила:**
  - `react/react-in-jsx-scope`: off (React 18 не нужен в scope)
  - `react/jsx-filename-extension`: [1, { extensions: ['.tsx'] }]
  - `@typescript-eslint/no-unused-vars`: 1 (warning)
  - Автоматическая сортировка импортов по группам
  - `react-hooks/set-state-in-effect`: warn
  - `react-hooks/preserve-manual-memoization`: warn

### Сортировка импортов (simple-import-sort)
1. Side effects (`import './styles.css'`)
2. React и пакеты (`react`, `@react/...`)
3. Абсолютные импорты (`@/...`)
4. Относительные из той же папки (`./`)
5. CSS Modules (`*.module.css`)
6. Обычные CSS (`*.css`)
7. Медиа (`*.png`, `*.svg`, `*.jpg`)

### Игнорируемые пути
- `web_src/fomantic/**`, `web_src/sidemenu/**/*`
- `node_modules/**`, `dist/**`, `coverage/**`
- `orval.config.cjs`, `**/*.d.ts`

## Интеграция API

| Инструмент | Описание |
|------|-------------|
| Orval | Генерирует типы, хуки и клиенты на основе спецификации OpenAPI 3.0.3. Поддерживает React Query, axios, fetch |
| OpenAPI | 3.0.3 — стандарт описания REST API |

## Тестирование и мокирование

| Инструмент | Описание |
|------|-------------|
| WireMock | Мокирование HTTP-сервисов на основе JSON-маппингов |

## Расширенные возможности

| Технология | Описание |
|------------|-------------|
| Module Federation 2.0 | Динамическая подгрузка удалённых модулей (микрофронтендов) без пересборки хоста. Используется для интеграции с OneWork. |

## Примечания

- Все конфигурации согласованы в команде и хранятся в репозитории
- Новые фичи следует реализовывать на текущем стеке (React 18 + Rsbuild + TypeScript)
- Легаси-экраны используют Go Templates + Vue + jQuery — см. [legacy.md](./legacy.md)
