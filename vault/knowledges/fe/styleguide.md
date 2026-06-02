# React Style Guide

Источник: [VCS-8306](https://portal.works.prod.sbt/pages/viewpage.action?pageId=...) — Гайды

---

## Общие принципы

- Следование стандартам делает код предсказуемым и упрощает ревью
- Правила должны быть согласованы коллективом команды
- Линтер должен автоматизировать соблюдение стандартов

---

## 1. Неиспользуемые переменные в колбэках

**Правило:** Если параметр в callback-функции не используется, называйте его `_`.

```
❌ Плохо:
items.map((item, index) => {
  return <div key={index}>{index}</div>;
});

✅ Хорошо:
items.map((_, index) => {
  return <div key={index}>{index}</div>;
});
```

---

## 2. Типизация компонентов

**Правило:** Не используйте `FC<>` (FunctionComponent) — это устаревший паттерн.

```
❌ Плохо:
const Button: FC<Props> = ({ label }) => {
  return <button>{label}</button>;
};

✅ Хорошо:
const Button = ({ label }: Props) => {
  return <button>{label}</button>;
};
```

---

## 3. `type` вместо `interface`

**Правило:** Используйте `type` для описания типов — это более мощный инструмент.

```
❌ Плохо:
interface Status { value: string; }
interface UserPartial { id?: number; name?: string; }

✅ Хорошо:
type Status = 'active' | 'inactive' | 'pending';
type User = { id: number; name: string };
type UserPartial = Partial<User>;
type Combined = A & B;
```

---

## 4. Явное приведение типов

**Правило:** Используйте `Boolean()`, `String()`, `Number()` вместо "магических" операторов.

```
❌ Плохо:
const isActive = !!user?.active;
const label = value + '';
const count = +input;

✅ Хорошо:
const isActive = Boolean(user?.active);
const label = String(value);
const count = Number(input);
```

---

## 5. Атрибуты для тестирования

**Правило:** Используйте `data-testid` — это стандарт (React Testing Library).

```
❌ Плохо:
<button data-test-id="submit-btn">Отправить</button>

✅ Хорошо:
<button data-testid="submit-btn">Отправить</button>
```

---

## 6. Именование типов пропсов

**Правило:** Внутри файла компонента называйте тип просто `Props`.

```
❌ Плохо:
type ButtonProps = { label: string };

✅ Хорошо:
type Props = { label: string };
// при импорте: import { Props as ButtonProps } from './Button';
```

---

## 7. Импорт хуков и утилит React

**Правило:** Не импортируйте весь объект `React`. Используйте именованные импорты.

```
❌ Плохо:
import React from 'react';
const [count] = React.useState(0);
React.useEffect(() => {}, []);

✅ Хорошо:
import { useState, useEffect } from 'react';
const [count] = useState(0);
useEffect(() => {}, []);
```
