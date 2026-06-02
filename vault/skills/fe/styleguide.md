# FE · React Style Guide

Скилл-выжимка. Полная заметка — `../../knowledges/fe/styleguide.md` (источник VCS-8306). Соблюдение проверяется ESLint/Prettier.

## Правила

1. **Неиспользуемый параметр колбэка** → `_` (`items.map((_, index) => …)`).
2. **Не `FC<>`** — типизировать пропсы напрямую: `const Button = ({ label }: Props) => …`.
3. **`type` вместо `interface`** (`type User = {…}`, union, `Partial<User>`, `A & B`).
4. **Явное приведение типов**: `Boolean(x)` / `String(x)` / `Number(x)`, не `!!` / `+ ''` / `+x`.
5. **`data-testid`** (не `data-test-id`) — на ключевые интерактивные элементы.
6. **Тип пропсов внутри файла — просто `Props`** (при импорте: `import { Props as ButtonProps }`).
7. **Именованные импорты React**: `import { useState, useEffect } from 'react'` (не `import React`).

## Prettier (из `stack.md`)

`printWidth 120`, `tabWidth 2`, `semi true`, `singleQuote true`, `trailingComma 'all'`, `arrowParens 'always'`, `endOfLine 'lf'`.

## Сортировка импортов (simple-import-sort)

side-effects → react/пакеты → абсолютные `@/` → относительные `./` → `*.module.css` → `*.css` → медиа.

## ESLint-акценты

`react/react-in-jsx-scope: off`, `jsx` только в `.tsx`, `no-unused-vars: warn`, `react-hooks/*: warn`.

## Соответствие макету

- Размеры/отступы из `fe/design.md` (container width, paddings, min-height, breakpoints) — это контракт, а не рекомендация.
- Проверять экран в `desktop` и `mobile`: тулбар, карточки, отступы, пагинация и состояния (`loading/empty/error/content`).
- Не добавлять новые кнопки/фильтры, если их нет в макете/SA; API-параметры без визуального поля поддерживать через URL/API-слой.

Связано: [[review]], [[architecture]], [[role]].
