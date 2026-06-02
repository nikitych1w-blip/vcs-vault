# Примеры использования компонентов Sber Design System

## 📝 Оглавление

- [Отображение данных](#1-отображение-данных-display-data)
- [Элементы управления](#2-элементы-управления-controls)
- [Поля ввода](#3-поля-ввода-input-fields)
- [Дата и время](#4-дата-и-время-date--time)
- [Навигация](#5-навигация-navigation)
- [Обратная связь](#6-обратная-связь-feedback)
- [Вспомогательные компоненты](#7-вспомогательные-компоненты-helper-components)

---

## 1. Отображение данных (Display Data)

### Badge

```tsx
import { Badge, Text } from '@sds-eng/base';

<Badge content={5}>
  <Text kind="bodyM">Уведомления</Text>
</Badge>

<Badge content="новое">
  <Text kind="bodyM">Статус</Text>
</Badge>

<Badge variant="dot">
  <Text kind="bodyM">Активный</Text>
</Badge>
```

**Пропсы:**
- `content`: `ReactNode` — содержимое бейджа (число или текст)
- `variant`: `'default' | 'dot'` — форма бейджа (точка или прямоугольник)
- `maxValue`: `number` — максимальное значение для отображения (показывает `maxValue+` если больше)
- `size`: `'xs' | 'sm' | 'md' | 'lg'` — размер бейджа

---

### Progress

```tsx
import { Progress } from '@sds-eng/base';

<Progress value={30} />

<Progress value={75} status="success" />

<Progress value={50} status="warning" />

<Progress value={100} status="error" />

<Progress
  type="circle"
  value={45}
  strokeWidth={8}
  width={100}
/>
```

**Пропсы:**
- `value`: `number` — текущее значение (0-100)
- `status`: `'default' | 'success' | 'warning' | 'error'` — статус
- `type`: `'line' | 'circle'` — тип прогресс-бара
- `strokeWidth`: `number` — толщина линии (для line)
- `width`: `number` — ширина (для circle)
- `size`: `'xs' | 'sm' | 'md' | 'lg'`

---

### Skeleton

```tsx
import { Skeleton, Box } from '@sds-eng/base';

<Skeleton variant="text" width={200} height={20} />

<Skeleton variant="circular" width={40} height={40} />

<Skeleton variant="rectangular" width={100} height={60} />

<Box display="flex" gap="m">
  <Skeleton variant="circular" width={50} height={50} />
  <Box flex={1}>
    <Skeleton variant="text" width={150} height={16} />
    <Skeleton variant="text" width={100} height={14} />
  </Box>
</Box>
```

**Пропсы:**
- `variant`: `'text' | 'circular' | 'rectangular' | 'rounded'` — тип скелетона
- `width`: `number | string` — ширина
- `height`: `number | string` — высота
- `animation`: `'pulse' | 'wave' | false` — анимация загрузки
- `animationDelay`: `number` — задержка анимации

---

### Tag

```tsx
import { Tag } from '@sds-eng/base';

<Tag onClose={() => console.log('Удалено')}>Тег с закрытием</Tag>

<Tag variant="filled" color="primary">
  Заполненный
</Tag>

<Tag variant="outline" color="success">
  Успешный
</Tag>

<Tag variant="ghost" color="warning">
  Предупреждение
</Tag>

<Tag disabled>Неактивный</Tag>
```

**Пропсы:**
- `variant`: `'filled' | 'outline' | 'ghost'` — стиль отображения
- `color`: `'primary' | 'success' | 'warning' | 'error' | 'neutral'` — цвет
- `onClose`: `() => void` — обработчик закрытия
- `disabled`: `boolean` — отключить тег
- `size`: `'xs' | 'sm' | 'md'` — размер

---

### Cell

```tsx
import { Cell } from '@sds-eng/base';

<Cell
  primaryText="Иванов Иван"
  secondaryText="Frontend Developer"
  avatar={{ text: 'ИИ' }}
  onClick={() => console.log('Нажато')}
  indicator={<Badge variant="dot" />}
/>

<Cell
  primaryText="Сохранить"
  secondaryText="Сохраняет изменения"
  iconRight=" ChevronRight"
  action={{ icon: 'settings' }}
/>
```

**Пропсы:**
- `primaryText`: `string` — основной текст
- `secondaryText`: `string` — дополнительный текст
- `avatar`: `{ text: string; src?: string }` — аватар
- `onClick`: `() => void` — клик
- `indicator`: `ReactNode` — индикатор (бейдж, точка)
- `iconRight`: `ReactNode` — иконка справа
- `action`: `{ icon: string; onClick?: () => void }` — действие

---

### List / ListItem

```tsx
import { List, ListItem } from '@sds-eng/base';

<List>
  <ListItem
    primaryText="Пункт 1"
    secondaryText="Описание пункта 1"
    onClick={() => console.log('Пункт 1')}
  />
  <ListItem
    primaryText="Пункт 2"
    secondaryText="Описание пункта 2"
    disabled
  />
  <ListItem
    primaryText="Пункт 3"
    avatar={{ text: '3' }}
    indicator={<Badge content={2} />}
  />
</List>

// List с группировкой
<List>
  <ListItemGroup header="Группа 1">
    <ListItem primaryText="Элемент 1" />
    <ListItem primaryText="Элемент 2" />
  </ListItemGroup>
  <ListItemGroup header="Группа 2">
    <ListItem primaryText="Элемент 3" />
  </ListItemGroup>
</List>
```

**Пропсы ListItem:**
- `primaryText`: `string` — основной текст
- `secondaryText`: `string` — дополнительный текст
- `avatar`: `{ text: string; src?: string }` — аватар
- `indicator`: `ReactNode` — индикатор
- `onClick`: `() => void` — клик
- `disabled`: `boolean` — отключить
- `action`: `ReactNode` — действие справа

---

### Tree

```tsx
import { Tree } from '@sds-eng/base';

const treeData = [
  {
    title: 'Корневой элемент',
    key: '0-0',
    children: [
      {
        title: 'Дочерний элемент 1',
        key: '0-0-1',
        children: [
          { title: 'Вложенный элемент 1', key: '0-0-1-1' },
          { title: 'Вложенный элемент 2', key: '0-0-1-2' },
        ],
      },
      { title: 'Дочерний элемент 2', key: '0-0-2' },
    ],
  },
];

<Tree
  treeData={treeData}
  onSelect={(keys) => console.log('Выбрано:', keys)}
  selectedKeys={['0-0-1']}
/>

// С кастомными иконками
<Tree
  treeData={treeData}
  expandedKeys={['0-0']}
  onExpand={(keys) => console.log('Раскрыто:', keys)}
  titleRender={(node) => (
    <span>
      <span style={{ marginRight: 8 }}>📁</span>
      {node.title}
    </span>
  )}
/>
```

**Пропсы:**
- `treeData`: `Array<TreeDataNode>` — данные дерева
- `selectedKeys`: `Array<string>` — выбранные ключи
- `expandedKeys`: `Array<string>` — раскрытые ключи
- `onSelect`: `(keys: string[]) => void` — выбор узла
- `onExpand`: `(keys: string[]) => void` — раскрытие/сворачивание
- `titleRender`: `(node: TreeDataNode) => ReactNode` — кастомный рендер заголовка

---

### EmptyState

```tsx
import { EmptyState, Button, Text } from '@sds-eng/base';

<EmptyState
  title="Данные не найдены"
  description="Попробуйте изменить параметры поиска"
  illustration="DataNotFound"
  action={<Button variant="primary">Попробовать снова</Button>}
/>

// Минимальная версия
<EmptyState
  title="Нет данных"
  description="Здесь пока ничего нет"
/>
```

**Пропсы:**
- `title`: `string` — заголовок
- `description`: `string` — описание
- `illustration`: `'DataNotFound' | 'ConnectionLost' | 'NoAccess' | 'Empty' | 'EmptyState'` — иллюстрация
- `action`: `ReactNode` — кнопка или действие
- `image`: `string` — кастомное изображение (URL)

---

### StatusCard

```tsx
import { StatusCard } from '@sds-eng/base';

<StatusCard
  title="Статус задачи"
  description="В работе"
  status="warning"
  size="m"
  onClick={() => console.log('Нажато')}
  action={<Button size="xs">Действие</Button>}
/>
```

**Пропсы:**
- `title`: `string` — заголовок
- `description`: `string` — описание
- `status`: `'success' | 'warning' | 'error' | 'info' | 'neutral'` — статус
- `size`: `'xs' | 'sm' | 'md' | 'lg'` — размер
- `onClick`: `() => void` — клик
- `action`: `ReactNode` — действие

---

### Marker

```tsx
import { Marker, Text } from '@sds-eng/base';

<Marker status="success">Выполнено</Marker>

<Marker status="warning" size="m">
  В работе
</Marker>

<Marker status="error" size="l">
  Ошибка
</Marker>

<Marker status="neutral">Нейтральный</Marker>

// В таблице
<Text kind="bodyM">
  Статус: <Marker status="success">Активен</Marker>
</Text>
```

**Пропсы:**
- `status`: `'success' | 'warning' | 'error' | 'neutral'` — статус
- `size`: `'xs' | 'sm' | 'm' | 'l'` — размер
- `children`: `ReactNode` — текст

---

### BrowserTabs

```tsx
import { BrowserTabs } from '@sds-eng/base';

const tabs = [
  { id: 'tab1', title: 'Вкладка 1', active: true },
  { id: 'tab2', title: 'Вкладка 2' },
  { id: 'tab3', title: 'Вкладка 3' },
];

<BrowserTabs
  tabs={tabs}
  onTabChange={(tab) => console.log('Выбрана вкладка:', tab.id)}
/>
```

**Пропсы:**
- `tabs`: `Array<{id: string; title: string; active?: boolean}>` — массив вкладок
- `onTabChange`: `(tab: Tab) => void` — изменение вкладки

---

## 2. Элементы управления (Controls)

### CheckboxGroup

```tsx
import { CheckboxGroup } from '@sds-eng/base';

const options = [
  { label: 'Опция 1', value: 'option1' },
  { label: 'Опция 2', value: 'option2' },
  { label: 'Опция 3', value: 'option3' },
];

const [values, setValues] = useState<string[]>(['option1']);

<CheckboxGroup
  options={options}
  value={values}
  onChange={setValues}
  size="m"
  direction="vertical"
/>
```

**Пропсы:**
- `options`: `Array<{label: string; value: string; disabled?: boolean}>` — опции
- `value`: `string[]` — выбранные значения
- `onChange`: `(values: string[]) => void` — изменение
- `size`: `'xs' | 'sm' | 'md'` — размер
- `direction`: `'vertical' | 'horizontal'` — направление

---

### RadioGroup

```tsx
import { RadioGroup } from '@sds-eng/base';

const options = [
  { label: 'Вариант 1', value: 'variant1' },
  { label: 'Вариант 2', value: 'variant2' },
  { label: 'Вариант 3', value: 'variant3' },
];

const [value, setValue] = useState('variant1');

<RadioGroup
  options={options}
  value={value}
  onChange={setValue}
  size="m"
  direction="vertical"
/>
```

**Пропсы:**
- `options`: `Array<{label: string; value: string; disabled?: boolean}>` — опции
- `value`: `string` — выбранное значение
- `onChange`: `(value: string) => void` — изменение
- `size`: `'xs' | 'sm' | 'md'` — размер
- `direction`: `'vertical' | 'horizontal'` — направление

---

### Slider

```tsx
import { Slider } from '@sds-eng/base';

const [value, setValue] = useState(50);

<Slider
  value={value}
  onChange={setValue}
  min={0}
  max={100}
  step={5}
  showTickMarks
  disabled={false}
/>

// Диапазонный слайдер
const [rangeValue, setRangeValue] = useState([20, 80]);

<Slider
  range
  value={rangeValue}
  onChange={setRangeValue}
  min={0}
  max={100}
/>
```

**Пропсы:**
- `value`: `number | [number, number]` — значение или диапазон
- `onChange`: `(value: number | [number, number]) => void` — изменение
- `min`: `number` — минимум
- `max`: `number` — максимум
- `step`: `number` — шаг
- `range`: `boolean` — режим диапазона
- `showTickMarks`: `boolean` — показывать метки
- `disabled`: `boolean` — отключить

---

### Rating

```tsx
import { Rating } from '@sds-eng/base';

const [value, setValue] = useState(3);

<Rating
  value={value}
  onChange={setValue}
  count={5}
  allowHalf
  size="m"
/>

// Только чтение
<Rating value={4} count={5} readOnly />
```

**Пропсы:**
- `value`: `number` — значение
- `onChange`: `(value: number) => void` — изменение
- `count`: `number` — количество звезд
- `allowHalf`: `boolean` — разрешить половинные звезды
- `size`: `'xs' | 'sm' | 'md' | 'lg'` — размер
- `readOnly`: `boolean` — только чтение

---

### Stepper / Step

```tsx
import { Stepper, Step, Button } from '@sds-eng/base';

const [activeStep, setActiveStep] = useState(0);

<Stepper
  activeStep={activeStep}
  onChange={setActiveStep}
  orientation="horizontal"
  size="m"
>
  <Step title="Шаг 1" description="Описание шага 1" />
  <Step title="Шаг 2" description="Описание шага 2" />
  <Step title="Шаг 3" description="Описание шага 3" />
</Stepper>

// С кнопками навигации
<Box display="flex" gap="s" marginTop="l">
  <Button
    variant="secondary"
    onClick={() => setActiveStep((prev) => Math.max(0, prev - 1))}
    disabled={activeStep === 0}
  >
    Назад
  </Button>
  <Button
    variant="primary"
    onClick={() =>
      setActiveStep((prev) =>
        prev < 2 ? prev + 1 : prev
      )
    }
    disabled={activeStep === 2}
  >
    {activeStep === 2 ? 'Готово' : 'Далее'}
  </Button>
</Box>
```

**Пропсы Stepper:**
- `activeStep`: `number` — активный шаг
- `onChange`: `(step: number) => void` — изменение шага
- `orientation`: `'horizontal' | 'vertical'` — ориентация
- `size`: `'sm' | 'md' | 'lg'` — размер

**Пропсы Step:**
- `title`: `string` — заголовок шага
- `description`: `string` — описание
- `disabled`: `boolean` — отключить шаг
- `status`: `'wait' | 'process' | 'finish' | 'error'` — статус шага

---

### Segment

```tsx
import { Segment, SegmentGroup } from '@sds-eng/base';

const [value, setValue] = useState('option1');

<SegmentGroup value={value} onChange={setValue}>
  <Segment value="option1">Опция 1</Segment>
  <Segment value="option2">Опция 2</Segment>
  <Segment value="option3">Опция 3</Segment>
</SegmentGroup>

// С иконками
<SegmentGroup value={value} onChange={setValue}>
  <Segment value="option1" iconLeft="search">
    Поиск
  </Segment>
  <Segment value="option2" iconLeft="filter">
    Фильтр
  </Segment>
</SegmentGroup>
```

**Пропсы SegmentGroup:**
- `value`: `string` — выбранное значение
- `onChange`: `(value: string) => void` — изменение
- `size`: `'xs' | 'sm' | 'md'` — размер
- `variant`: `'line' | 'fill'` — вариант отображения

**Пропсы Segment:**
- `value`: `string` — значение
- `disabled`: `boolean` — отключить
- `iconLeft`, `iconRight`: `ReactNode` — иконки

---

### DropdownMenu / DropdownMenuItem

```tsx
import { DropdownMenu, DropdownMenuItem, Button } from '@sds-eng/base';

const [isOpen, setIsOpen] = useState(false);

<DropdownMenu
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  placement="bottom-start"
>
  <DropdownMenuItem
    iconLeft="edit"
    onClick={() => {
      console.log('Редактировать');
      setIsOpen(false);
    }}
  >
    Редактировать
  </DropdownMenuItem>
  <DropdownMenuItem
    iconLeft="copy"
    onClick={() => {
      console.log('Копировать');
      setIsOpen(false);
    }}
  >
    Копировать
  </DropdownMenuItem>
  <DropdownMenuItem
    iconLeft="delete"
    color="danger"
    onClick={() => {
      console.log('Удалить');
      setIsOpen(false);
    }}
  >
    Удалить
  </DropdownMenuItem>
</DropdownMenu>

<Button variant="secondary" onClick={() => setIsOpen(true)}>
  Открыть меню
</Button>
```

**Пропсы DropdownMenu:**
- `isOpen`: `boolean` — открыто ли
- `onClose`: `() => void` — закрыть
- `placement`: `'top' | 'bottom' | 'left' | 'right' | ...` — размещение
- `offset`: `[number, number]` — смещение

**Пропсы DropdownMenuItem:**
- `iconLeft`, `iconRight`: `ReactNode` — иконки
- `onClick`: `() => void` — клик
- `color`: `'default' | 'danger'` — цвет текста
- `disabled`: `boolean` — отключить

---

### Tooltip

```tsx
import { Tooltip, Button } from '@sds-eng/base';

// Кнопка с tooltip
<Tooltip content="Сохранить изменения" placement="top">
  <Button variant="primary" iconLeft="save">
    Сохранить
  </Button>
</Tooltip>

// С кастомным контентом
<Tooltip
  content={
    <Box padding="s">
      <Text kind="bodyM">Сложный контент</Text>
      <Text kind="caption">Описание функции</Text>
    </Box>
  }
  placement="right"
>
  <Button variant="secondary">?</Button>
</Tooltip>

// С задержкой
<Tooltip content="Копировать" delay={500}>
  <Button variant="ghost" iconLeft="copy">
    Копировать
  </Button>
</Tooltip>
```

**Пропсы Tooltip:**
- `content`: `ReactNode` — содержимое tooltip
- `placement`: `'top' | 'bottom' | 'left' | 'right' | ...` — размещение
- `delay`: `number` — задержка показа (мс)
- `disabled`: `boolean` — отключить

---

### Popover

```tsx
import { Popover, Button } from '@sds-eng/base';

const [isOpen, setIsOpen] = useState(false);

<Popover
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Действия"
  description="Выберите действие с элементом"
  primaryButtonProps={{
    children: 'Подтвердить',
    onClick: () => {
      console.log('Подтверждено');
      setIsOpen(false);
    },
  }}
  secondaryButtonProps={{
    children: 'Отмена',
    variant: 'secondary',
    onClick: () => setIsOpen(false),
  }}
  placement="bottom-start"
>
  <Button variant="secondary" onClick={() => setIsOpen(true)}>
    Показать Popover
  </Button>
</Popover>
```

**Пропсы Popover:**
- `isOpen`: `boolean` — открыто ли
- `onClose`: `() => void` — закрыть
- `title`: `ReactNode` — заголовок
- `description`: `ReactNode` — описание
- `primaryButtonProps`: `ButtonProps` — свойства главной кнопки
- `secondaryButtonProps`: `ButtonProps` — свойства второй кнопки
- `placement`: `'top' | 'bottom' | 'left' | 'right' | ...` — размещение

---

## 3. Поля ввода (Input Fields)

### InputNumber

```tsx
import { InputNumber } from '@sds-eng/base';

const [value, setValue] = useState<number | null>(null);

<InputNumber
  value={value}
  onChange={setValue}
  placeholder="Введите число"
  label="Количество"
  min={0}
  max={100}
  step={1}
  size="m"
  isBorderless={false}
  error={value !== null && value > 100 ? 'Слишком много' : undefined}
/>
```

**Пропсы:**
- `value`: `number | null` — значение
- `onChange`: `(value: number | null) => void` — изменение
- `min`: `number` — минимум
- `max`: `number` — максимум
- `step`: `number` — шаг
- `precision`: `number` — точность (количество знаков после запятой)
- `size`: `'xs' | 'sm' | 'md'` — размер
- `isBorderless`: `boolean` — без рамки

---

### InputPassword

```tsx
import { InputPassword } from '@sds-eng/base';

const [value, setValue] = useState('');

<InputPassword
  value={value}
  onChange={setValue}
  placeholder="Введите пароль"
  label="Пароль"
  size="m"
  isBorderless={false}
  error={value.length < 6 ? 'Минимум 6 символов' : undefined}
  strength
/>
```

**Пропсы:**
- `value`: `string` — значение
- `onChange`: `(value: string) => void` — изменение
- `size`: `'xs' | 'sm' | 'md'` — размер
- `isBorderless`: `boolean` — без рамки
- `strength`: `boolean` — показывать надежность пароля
- `iconRight`: `ReactNode` — иконка справа

---

### MaskedInput

```tsx
import { MaskedInput } from '@sds-eng/base';

const [phone, setPhone] = useState('');

<MaskedInput
  mask="+7 (000) 000-00-00"
  value={phone}
  onChange={setPhone}
  placeholder="+7 (___) ___-__-__"
  label="Телефон"
  size="m"
  isBorderless={false}
/>
```

**Пропсы:**
- `mask`: `string` — маска (0-цифра, *-буква, A-буква, a-буква или цифра)
- `value`: `string` — значение
- `onChange`: `(value: string) => void` — изменение
- `placeholder`: `string` — плейсхолдер
- `size`: `'xs' | 'sm' | 'md'` — размер
- `isBorderless`: `boolean` — без рамки

---

### Autocomplete

```tsx
import { Autocomplete, Box } from '@sds-eng/base';

const options = ['Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург'];

const [value, setValue] = useState('');

<Autocomplete
  options={options}
  value={value}
  onChange={setValue}
  placeholder="Введите город"
  label="Город"
  size="m"
  isBorderless={false}
  onSelect={(option) => console.log('Выбран:', option)}
  onFilter={(value, option) => option.toLowerCase().includes(value.toLowerCase())}
/>
```

**Пропсы:**
- `options`: `Array<string | {value: string; label: string}>` — опции
- `value`: `string` — значение
- `onChange`: `(value: string) => void` — изменение
- `onSelect`: `(option: string | {value: string; label: string}) => void` — выбор
- `onFilter`: `(value: string, option: string | {value: string; label: string}) => boolean` — фильтрация
- `size`: `'xs' | 'sm' | 'md'` — размер
- `isBorderless`: `boolean` — без рамки

---

### ComboBox / Creatable

```tsx
import { ComboBox, Creatable } from '@sds-eng/base';

const options = [
  { value: '1', label: 'Опция 1' },
  { value: '2', label: 'Опция 2' },
];

const [value, setValue] = useState<string>('1');

// Обычный ComboBox
<ComboBox
  options={options}
  value={value}
  onChange={setValue}
  placeholder="Выберите опцию"
  label="Опция"
  size="m"
  isBorderless={false}
  searchable
  clearable
/>

// Creatable - можно создавать новые
const [creatableValue, setCreatableValue] = useState('Новая опция');

<Creatable
  options={options}
  value={creatableValue}
  onChange={setCreatableValue}
  placeholder="Выберите или создайте"
  label="Creatable"
  size="m"
/>
```

**Пропсы ComboBox/Creatable:**
- `options`: `Array<{value: string; label: string}>` — опции
- `value`: `string` — значение
- `onChange`: `(value: string) => void` — изменение
- `searchable`: `boolean` — поиск
- `clearable`: `boolean` — кнопка очистки
- `multiple`: `boolean` — мультивыбор (в Creatable)
- `size`: `'xs' | 'sm' | 'md'` — размер
- `isBorderless`: `boolean` — без рамки

---

### Select

```tsx
import { Select } from '@sds-eng/base';

const options = [
  { value: '1', label: 'Опция 1' },
  { value: '2', label: 'Опция 2' },
  { value: '3', label: 'Опция 3' },
];

// Одиночный выбор
const [value, setValue] = useState<string>('1');

<Select
  options={options}
  value={value}
  onChange={setValue}
  placeholder="Выберите..."
  label="Опция"
  size="m"
  isBorderless={false}
  clearable
  searchable
/>

// Мультивыбор
const [multiValues, setMultiValues] = useState<string[]>(['1', '3']);

<Select
  options={options}
  value={multiValues}
  onChange={setMultiValues}
  placeholder="Выберите несколько..."
  label="Множественный выбор"
  multiple
  size="m"
  isBorderless={false}
/>
```

**Пропсы Select:**
- `options`: `Array<{value: string; label: string; disabled?: boolean}>` — опции
- `value`: `string | string[]` — значение(я)
- `onChange`: `(value: string | string[]) => void` — изменение
- `multiple`: `boolean` — мультивыбор
- `clearable`: `boolean` — кнопка очистки
- `searchable`: `boolean` — поиск
- `size`: `'xs' | 'sm' | 'md'` — размер
- `isBorderless`: `boolean` — без рамки

---

### Mentions

```tsx
import { Mentions } from '@sds-eng/base';

const [value, setValue] = useState('');

<Mentions
  value={value}
  onChange={setValue}
  placeholder="Упомяните пользователя @..."
  label="Упоминание"
  size="m"
  isBorderless={false}
  mentions={[
    { id: 'user1', name: 'Иванов Иван', login: 'iivanov' },
    { id: 'user2', name: 'Петров Петр', login: 'ppetrov' },
  ]}
  trigger="@"
  mentionTrigger="@"
  getOptionLabel={(option) => option.name}
  getOptionValue={(option) => option.login}
/>
```

**Пропсы:**
- `value`: `string` — значение
- `onChange`: `(value: string) => void` — изменение
- `mentions`: `Array<{id: string; name: string; login?: string}>` — список упоминаний
- `trigger`: `string` — триггер символ
- `mentionTrigger`: `string` — символ для триггера
- `getOptionLabel`: `(option) => string` — получение метки
- `getOptionValue`: `(option) => string` — получение значения
- `size`: `'xs' | 'sm' | 'md'` — размер
- `isBorderless`: `boolean` — без рамки

---

### FileUploader / ButtonUploader / Dropzone

```tsx
import { FileUploader, ButtonUploader, Dropzone, Text, Box } from '@sds-eng/base';

const [files, setFiles] = useState([]);

// FileUploader
<FileUploader
  value={files}
  onChange={setFiles}
  accept={['.jpg', '.png', '.pdf']}
  maxSize={5 * 1024 * 1024} // 5MB
  multiple
  label="Загрузить файлы"
  placeholder="Перетащите файлы или нажмите для загрузки"
  size="m"
  isBorderless={false}
/>

// ButtonUploader
<ButtonUploader
  onUpload={(fileList) => {
    console.log('Загружено:', fileList);
  }}
  accept={['.jpg', '.png']}
  maxSize={1024 * 1024} // 1MB
  multiple={false}
>
  Загрузить изображение
</ButtonUploader>

// Dropzone
<Dropzone
  onDrop={(fileList) => {
    console.log('Брошено:', fileList);
  }}
  accept={['.pdf']}
  multiple
>
  {({ getRootProps, getInputProps, isDragActive }) => (
    <Box
      padding="l"
      border="1px dashed #ccc"
      borderRadius="s"
      textAlign="center"
      backgroundColor={isDragActive ? '#f0f0f0' : 'transparent'}
      {...getRootProps()}
    >
      <input {...getInputProps()} />
      <Text kind="bodyM" color="primary">
        {isDragActive ? 'Бросите файлы здесь' : 'Перетащите файлы или нажмите для загрузки'}
      </Text>
    </Box>
  )}
</Dropzone>
```

**Пропсы FileUploader:**
- `value`: `Array<UploaderFile>` — загруженные файлы
- `onChange`: `(fileList: Array<UploaderFile>) => void` — изменение
- `accept`: `Array<string>` — допустимые расширения
- `maxSize`: `number` — максимальный размер файла
- `multiple`: `boolean` — мультизагрузка
- `label`: `string` — лейбл
- `placeholder`: `string` — плейсхолдер
- `size`: `'xs' | 'sm' | 'md'` — размер

**Пропсы ButtonUploader:**
- `onUpload`: `(fileList: Array<UploaderFile>) => void` — загрузка
- `accept`: `Array<string>` — допустимые расширения
- `maxSize`: `number` — максимальный размер
- `multiple`: `boolean` — мультизагрузка

---

### LabelControl

```tsx
import { LabelControl, Input } from '@sds-eng/base';

const [checked, setChecked] = useState(false);

<LabelControl checked={checked} onChange={setChecked}>
  <Input type="checkbox" />
  <Text kind="bodyM">Я согласен с условиями</Text>
</LabelControl>
```

**Пропсы:**
- `checked`: `boolean` — состояние
- `onChange`: `(checked: boolean) => void` — изменение
- `disabled`: `boolean` — отключить
- `children`: `ReactNode` — содержимое (Input + текст)

---

## 4. Дата и время (Date & Time)

### DatePicker

```tsx
import { DatePicker, Box } from '@sds-eng/base';

// Обычный DatePicker
const [date, setDate] = useState<Date | null>(null);

<DatePicker
  value={date}
  onChange={setDate}
  format="dd.MM.yyyy"
  placeholder="Выберите дату"
  label="Дата"
  size="m"
  isBorderless={false}
  disabled={false}
  disabledDates={{
    before: new Date(2020, 0, 1),
    after: new Date(2030, 0, 1),
    between: [new Date(2024, 5, 1), new Date(2024, 5, 10)],
  }}
  showToday
  showClear
/>

// Диапазон дат
const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);

<DatePicker
  range
  value={dateRange}
  onChange={setDateRange}
  format="dd.MM.yyyy"
  placeholder={['С', 'По']}
  label="Диапазон дат"
/>
```

**Пропсы DatePicker:**
- `value`: `Date | [Date | null, Date | null]` — значение(я)
- `onChange`: `(value: Date | [Date | null, Date | null]) => void` — изменение
- `format`: `string` — формат отображения
- `placeholder`: `string | string[]` — плейсхолдер
- `disabled`: `boolean` — отключить
- `disabledDates`: `{before?: Date; after?: Date; between?: [Date, Date]}` — недопустимые даты
- `showToday`: `boolean` — показать сегодня
- `showClear`: `boolean` — показать кнопку очистки
- `range`: `boolean` — режим диапазона

---

### TimePicker

```tsx
import { TimePicker } from '@sds-eng/base';

const [time, setTime] = useState<Date | null>(null);

<TimePicker
  value={time}
  onChange={setTime}
  format="HH:mm"
  placeholder="Выберите время"
  label="Время"
  size="m"
  isBorderless={false}
  disabled={false}
  hourStep={1}
  minuteStep={5}
  secondStep={10}
  showNowButton
  showClear
/>
```

**Пропсы TimePicker:**
- `value`: `Date | null` — значение
- `onChange`: `(value: Date | null) => void` — изменение
- `format`: `string` — формат отображения
- `placeholder`: `string` — плейсхолдер
- `disabled`: `boolean` — отключить
- `hourStep`: `number` — шаг часов
- `minuteStep`: `number` — шаг минут
- `secondStep`: `number` — шаг секунд
- `showNowButton`: `boolean` — показать кнопку "сейчас"
- `showClear`: `boolean` — показать кнопку очистки

---

## 5. Навигация (Navigation)

### Tabs / Tab

```tsx
import { Tabs, Tab, Box, Text } from '@sds-eng/base';

const [activeTab, setActiveTab] = useState('tab1');

<Tabs
  activeValue={activeTab}
  onChange={setActiveTab}
  variant="line"
  size="m"
>
  <Tab value="tab1" header="Вкладка 1">
    <Box padding="l">
      <Text kind="bodyM">Контент вкладки 1</Text>
    </Box>
  </Tab>
  <Tab value="tab2" header="Вкладка 2">
    <Box padding="l">
      <Text kind="bodyM">Контент вкладки 2</Text>
    </Box>
  </Tab>
  <Tab value="tab3" header="Вкладка 3" disabled>
    <Box padding="l">
      <Text kind="bodyM">Контент вкладки 3 (отключена)</Text>
    </Box>
  </Tab>
</Tabs>

// С иконками и счетчиками
<Tabs
  activeValue={activeTab}
  onChange={setActiveTab}
  variant="pills"
  size="sm"
>
  <Tab value="dashboard" header="Дашборд" iconLeft="home" counter={5} />
  <Tab value="settings" header="Настройки" iconLeft="settings" />
  <Tab value="notifications" header="Уведомления" iconLeft="bell" counter={12} />
</Tabs>
```

**Пропсы Tabs:**
- `activeValue`: `string | number` — активная вкладка
- `onChange`: `(value: string | number) => void` — изменение
- `variant`: `'line' | 'fill' | 'pills'` — вариант отображения
- `size`: `'xs' | 'sm' | 'md'` — размер
- `items`: `Array<TabItem>` — массив вкладок (альтернатива Tab)

**Пропсы Tab:**
- `value`: `string | number` — идентификатор
- `header`: `ReactNode` — заголовок
- `iconLeft`, `iconRight`: `ReactNode` — иконки
- `counter`: `number` — счетчик
- `disabled`: `boolean` — отключить

---

### Accordion / AccordionItem / AccordionIcon

```tsx
import { Accordion, AccordionItem, Text, Box } from '@sds-eng/base';

const [expanded, setExpanded] = useState<string[]>(['item1']);

<Accordion
  expandedKeys={expanded}
  onToggle={(keys) => setExpanded(keys)}
  size="md"
>
  <AccordionItem
    header="Раздел 1"
    key="item1"
    size="md"
    arrowPosition="left"
  >
    <Box padding="l">
      <Text kind="bodyM">Контент первого раздела</Text>
    </Box>
  </AccordionItem>
  <AccordionItem
    header="Раздел 2"
    key="item2"
    size="md"
    arrowPosition="left"
  >
    <Box padding="l">
      <Text kind="bodyM">Контент второго раздела</Text>
    </Box>
  </AccordionItem>
  <AccordionItem
    header="Раздел 3"
    key="item3"
    size="md"
    arrowPosition="left"
  >
    <Box padding="l">
      <Text kind="bodyM">Контент третьего раздела</Text>
    </Box>
  </AccordionItem>
</Accordion>

// Одиночное раскрытие
const [singleExpanded, setSingleExpanded] = useState<string | null>('item1');

<Accordion
  expandedKeys={singleExpanded ? [singleExpanded] : []}
  onToggle={(keys) => setSingleExpanded(keys.length ? keys[0] : null)}
  type="single"
>
  <AccordionItem header="Один" key="one" />
  <AccordionItem header="Два" key="two" />
</Accordion>
```

**Пропсы Accordion:**
- `expandedKeys`: `string[]` — раскрытые ключи
- `onToggle`: `(keys: string[]) => void` — переключение
- `size`: `'sm' | 'md' | 'lg' | 'h6' | 'h4' | 'h2'` — размер
- `type`: `'multiple' | 'single'` — тип раскрытия

**Пропсы AccordionItem:**
- `header`: `ReactNode` — заголовок
- `key`: `string` — уникальный ключ
- `expanded`: `boolean` — раскрыт (если использовать controlled模式)
- `onToggle`: `() => void` — переключение (если использовать uncontrolled模式)
- `size`: `'sm' | 'md' | 'lg' | 'h6' | 'h4' | 'h2'` — размер
- `arrowPosition`: `'left' | 'right'` — позиция стрелки

---

### Drawer / DrawerHeader / DrawerBody / DrawerFooter

```tsx
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter, Button, Text, Box } from '@sds-eng/base';

const [isOpen, setIsOpen] = useState(false);

<Drawer
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  placement="right"
  size={400}
  header={
    <DrawerHeader>
      <Text kind="h3b">Детали элемента</Text>
    </DrawerHeader>
  }
  body={
    <DrawerBody>
      <Box padding="l">
        <Text kind="bodyM">Основное содержимое drawers</Text>
      </Box>
    </DrawerBody>
  }
  footer={
    <DrawerFooter>
      <Button variant="secondary" onClick={() => setIsOpen(false)}>
        Отмена
      </Button>
      <Button variant="primary" onClick={() => setIsOpen(false)}>
        Сохранить
      </Button>
    </DrawerFooter>
  }
>
  <Box padding="l">
    <Text kind="bodyM">Контент drawers</Text>
  </Box>
</Drawer>

<Button variant="secondary" onClick={() => setIsOpen(true)}>
  Открыть drawers
</Button>
```

**Пропсы Drawer:**
- `isOpen`: `boolean` — открыто ли
- `onClose`: `() => void` — закрыть
- `placement`: `'left' | 'right' | 'top' | 'bottom'` — направление
- `size`: `number | string` — размер (ширина для left/right, высота для top/bottom)
- `header`: `ReactNode` — заголовок
- `body`: `ReactNode` — тело
- `footer`: `ReactNode` — футер
- `closeOnOutsideClick`: `boolean` — закрыть при клике вне

---

### Modal / ModalHeader / ModalBody / ModalFooter

```tsx
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Text, Box } from '@sds-eng/base';

const [isOpen, setIsOpen] = useState(false);

<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Подтверждение действия"
  size="m"
  header={
    <ModalHeader>
      <Text kind="h3b">Важное уведомление</Text>
    </ModalHeader>
  }
  body={
    <ModalBody>
      <Box padding="l">
        <Text kind="bodyM">Вы уверены, что хотите продолжить?</Text>
      </Box>
    </ModalBody>
  }
  footer={
    <ModalFooter>
      <Button variant="secondary" onClick={() => setIsOpen(false)}>
        Отмена
      </Button>
      <Button variant="danger" onClick={() => setIsOpen(false)}>
        Подтвердить
      </Button>
    </ModalFooter>
  }
>
  <Box padding="l">
    <Text kind="bodyM">Текст модального окна</Text>
  </Box>
</Modal>

<Button variant="primary" onClick={() => setIsOpen(true)}>
  Показать модальное окно
</Button>
```

**Пропсы Modal:**
- `isOpen`: `boolean` — открыто ли
- `onClose`: `() => void` — закрыть
- `title`: `ReactNode` — заголовок
- `size`: `'s' | 'm' | 'l' | 'xl' | 'xxl'` — размер
- `header`: `ReactNode` — кастомный заголовок
- `body`: `ReactNode` — кастомное тело
- `footer`: `ReactNode` — кастомный футер
- `closeOnOutsideClick`: `boolean` — закрыть при клике вне

---

### Link / BackLink

```tsx
import { Link, BackLink, Box, Text } from '@sds-eng/base';

// Обычная ссылка
<Link href="https://example.com" target="_blank">
  Перейти на сайт
</Link>

// С иконкой
<Link iconLeft="external-link" href="https://example.com">
  Внешняя ссылка
</Link>

// BackLink
<Box display="flex" gap="s" marginBottom="l">
  <BackLink onClick={() => console.log('Назад')}>
    Назад
  </BackLink>
  <Text kind="h2b">Страница деталей</Text>
</Box>

// disabled
<Link href="https://example.com" disabled>
  Недоступная ссылка
</Link>
```

**Пропсы Link:**
- `href`: `string` — URL
- `target`: `string` — целевой фрейм
- `iconLeft`, `iconRight`: `ReactNode` — иконки
- `disabled`: `boolean` — отключить
- `kind`: `'default' | 'primary' | 'secondary'` — стиль

**Пропсы BackLink:**
- `onClick`: `() => void` — клик
- `disabled`: `boolean` — отключить
- `iconLeft`: `ReactNode` — иконка
- `size`: `'sm' | 'md'` — размер

---

### Pagination

```tsx
import { Pagination } from '@sds-eng/base';

const [page, setPage] = useState(1);
const [pageSize, setPageSize] = useState(10);

<Pagination
  page={page}
  pageSize={pageSize}
  total={100}
  onChange={(newPage) => setPage(newPage)}
  onPageSizeChange={(size) => {
    setPageSize(size);
    setPage(1);
  }}
  showSizeChanger
  pageSizeOptions={[10, 20, 50, 100]}
  size="m"
  showTotal
/>

// Минимальный
<Pagination
  page={page}
  total={50}
  onChange={setPage}
/>
```

**Пропсы Pagination:**
- `page`: `number` — текущая страница
- `pageSize`: `number` — размер страницы
- `total`: `number` — всего элементов
- `onChange`: `(page: number) => void` — изменение страницы
- `onPageSizeChange`: `(size: number) => void` — изменение размера
- `showSizeChanger`: `boolean` — показать выбор размера
- `pageSizeOptions`: `number[]` — доступные размеры
- `showTotal`: `boolean` — показать общее количество
- `size`: `'xs' | 'sm' | 'md'` — размер

---

### Scope / ScopeItem

```tsx
import { Scope, ScopeItem, Text, Box } from '@sds-eng/base';

<Scope title="Фильтры" size="m">
  <ScopeItem label="Категория">
    <Text kind="bodyM">Электроника</Text>
  </ScopeItem>
  <ScopeItem label="Цена">
    <Text kind="bodyM">10 000 - 50 000 ₽</Text>
  </ScopeItem>
  <ScopeItem label="Бренд">
    <Text kind="bodyM">Samsung</Text>
  </ScopeItem>
</Scope>

// С кастомным заголовком
<Scope
  title={<Text kind="h3b">Информация</Text>}
  size="l"
>
  <ScopeItem label="ID">
    <Text kind="bodyM">123456</Text>
  </ScopeItem>
</Scope>
```

**Пропсы Scope:**
- `title`: `ReactNode` — заголовок
- `size`: `'s' | 'm' | 'l'` — размер
- `variant`: `'default' | 'borderless'` — вариант

**Пропсы ScopeItem:**
- `label`: `ReactNode` — метка
- `children`: `ReactNode` — содержимое

---

## 6. Обратная связь (Feedback)

### Notification

```tsx
import { notification, Button } from '@sds-eng/base';

// Успех
<Button
  variant="primary"
  onClick={() =>
    notification({
      title: 'Успех',
      description: 'Данные успешно сохранены',
      status: 'success',
      duration: 5000,
    })
  }
>
  Показать уведомление
</Button>

// Ошибка
notification({
  title: 'Ошибка',
  description: 'Не удалось загрузить данные',
  status: 'error',
  primaryButtonProps: {
    children: 'Повторить',
    onClick: () => console.log('Повтор'),
  },
});

// Информация
notification.info({
  title: 'Информация',
  description: 'Новая версия приложения доступна',
  duration: 0, // без авто-закрытия
});

// Варнинг
notification.warning({
  title: 'Внимание',
  description: 'У вас есть непрочитанные уведомления',
  secondaryButtonProps: {
    children: 'Перейти',
    variant: 'primary',
  },
});
```

**Пропсы notification:**
- `title`: `ReactNode` — заголовок
- `description`: `ReactNode` — описание
- `status`: `'success' | 'error' | 'warning' | 'info'` — статус
- `duration`: `number` — время показа (мс), 0 = без авто-закрытия
- `primaryButtonProps`: `ButtonProps` — кнопка
- `secondaryButtonProps`: `ButtonProps` — вторая кнопка

---

### Spinner

```tsx
import { Spinner, Box, Text } from '@sds-eng/base';

// Крутилка в центре
<Box display="flex" justifyContent="center" padding="l">
  <Spinner size="l" />
</Box>

// С текстом
<Box display="flex" alignItems="center" gap="s">
  <Spinner size="m" />
  <Text kind="bodyM">Загрузка...</Text>
</Box>

// Внутри карточки
<Box padding="l" border="1px solid #ddd" borderRadius="s" minHeight={200}>
  <Spinner size="m" />
</Box>

// Маленький spinner
<Spinner size="xs" />
```

**Пропсы Spinner:**
- `size`: `'xs' | 'sm' | 'md' | 'lg'` — размер
- `variant`: `'default' | 'secondary'` — вариант
- `active`: `boolean` — активен ли
- `ariaLabel`: `string` — aria-label

---

## 7. Вспомогательные компоненты (Helper Components)

### Box

```tsx
import { Box, Text } from '@sds-eng/base';

// Flexbox
<Box display="flex" gap="m" alignItems="center">
  <Box padding="s" backgroundColor="primary" borderRadius="s">
    <Text kind="bodyM">Элемент 1</Text>
  </Box>
  <Box padding="s" backgroundColor="secondary" borderRadius="s">
    <Text kind="bodyM">Элемент 2</Text>
  </Box>
</Box>

// Grid
<Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap="s">
  <Box padding="l" backgroundColor="neutral-light">
    <Text kind="bodyM">Ячейка 1</Text>
  </Box>
  <Box padding="l" backgroundColor="neutral-light">
    <Text kind="bodyM">Ячейка 2</Text>
  </Box>
  <Box padding="l" backgroundColor="neutral-light">
    <Text kind="bodyM">Ячейка 3</Text>
  </Box>
</Box>

// Стилизация
<Box
  padding="l"
  margin="m"
  border="1px solid #ccc"
  borderRadius="s"
  boxShadow="elevation-2"
  backgroundColor="white"
>
  <Text kind="bodyM">Контент с стилями</Text>
</Box>

// Spacing tokens
<Box padding="l">padding="l"</Box>
<Box paddingX="m" paddingY="s">
  paddingX="m" paddingY="s"
</Box>
<Box margin="xl">margin="xl"</Box>
<Box gap="s">gap="s"</Box>
```

**Пропсы Box:**
- `display`: `'flex' | 'grid' | 'block' | 'inline' | ...` — display
- `padding`, `paddingX`, `paddingY`: spacing token — отступы
- `margin`, `marginX`, `marginY`: spacing token — маржины
- `border`, `borderTop`, `borderRight`, `borderBottom`, `borderLeft`: `string` — границы
- `borderRadius`: spacing token — радиус
- `boxShadow`: `'none' | 'elevation-1' | 'elevation-2' | ...` — тень
- `backgroundColor`: color token — цвет фона
- `color`: color token — цвет текста
- `gap`: spacing token — отступ между элементами

---

### Divider

```tsx
import { Divider, Box, Text } from '@sds-eng/base';

// Горизонтальный
<Box padding="l">
  <Text kind="bodyM">Контент выше</Text>
  <Divider />
  <Text kind="bodyM">Контент ниже</Text>
</Box>

// С текстом
<Box padding="l">
  <Text kind="bodyM">Информация до</Text>
  <Divider>ИЛИ</Divider>
  <Text kind="bodyM">Информация после</Text>
</Box>

// Вертикальный
<Box display="flex" alignItems="center" gap="l">
  <Text kind="bodyM">Пункт 1</Text>
  <Divider direction="vertical" />
  <Text kind="bodyM">Пункт 2</Text>
  <Divider direction="vertical" />
  <Text kind="bodyM">Пункт 3</Text>
</Box>

// Стилизованный
<Divider
  orientation="left"
  dashed
  style={{ borderColor: '#ccc', borderStyle: 'dashed' }}
>
  Секция
</Divider>
```

**Пропсы Divider:**
- `orientation`: `'left' | 'center' | 'right'` — позиция текста
- `direction`: `'horizontal' | 'vertical'` — направление
- `dashed`: `boolean` — пунктирная линия
- `children`: `ReactNode` — текст внутри

---

### Bar

```tsx
import { Bar, Text, Button } from '@sds-eng/base';

// Header bar
<Bar
  header={<Text kind="h2b">Заголовок страницы</Text>}
  action={<Button variant="secondary" iconLeft="settings">Настройки</Button>}
  status="default"
  size="m"
>

// Footer bar
<Bar
  position="bottom"
  status="default"
  padding="m"
>
  <Text kind="bodyM">Футер страницы</Text>
</Bar>

// С разделителем
<Bar>
  <Text kind="bodyM">Контент</Text>
  <Bar.Divider />
  <Text kind="bodyM">Контент справа</Text>
</Bar>
```

**Пропсы Bar:**
- `header`: `ReactNode` — заголовок
- `action`: `ReactNode` — действие
- `status`: `'default' | 'primary' | 'secondary'` — статус
- `size`: `'s' | 'm' | 'l'` — размер
- `position`: `'top' | 'bottom'` — позиция
- `padding`: spacing token — отступ

---

### Illustration

```tsx
import { Illustration, Box, Text } from '@sds-eng/base';

// Иллюстрация с описанием
<Box display="flex" flexDirection="column" alignItems="center" gap="m" padding="l">
  <Illustration name="DataNotFound" size="l" />
  <Text kind="h3b">Ничего не найдено</Text>
  <Text kind="bodyM">Попробуйте изменить параметры поиска</Text>
</Box>

// Разные иллюстрации
<Box display="flex" gap="l" wrap="wrap">
  <Box display="flex" flexDirection="column" alignItems="center" gap="s">
    <Illustration name="DataNotFound" size="m" />
    <Text kind="caption">DataNotFound</Text>
  </Box>
  <Box display="flex" flexDirection="column" alignItems="center" gap="s">
    <Illustration name="ConnectionLost" size="m" />
    <Text kind="caption">ConnectionLost</Text>
  </Box>
  <Box display="flex" flexDirection="column" alignItems="center" gap="s">
    <Illustration name="NoAccess" size="m" />
    <Text kind="caption">NoAccess</Text>
  </Box>
  <Box display="flex" flexDirection="column" alignItems="center" gap="s">
    <Illustration name="Empty" size="m" />
    <Text kind="caption">Empty</Text>
  </Box>
</Box>
```

**Пропсы Illustration:**
- `name`: `'DataNotFound' | 'ConnectionLost' | 'NoAccess' | 'Empty' | ...` — имя иллюстрации
- `size`: `'xs' | 'sm' | 'md' | 'lg' | 'xl'` — размер

---

### Поддержка Grid System (Row / Col)

```tsx
import { Row, Col, Box, Text } from '@sds-eng/base';

// Базовая сетка
<Row gutter={16}>
  <Col span={12}>
    <Box padding="s" backgroundColor="neutral-light">
      <Text kind="bodyM">Колонка 1 (50%)</Text>
    </Box>
  </Col>
  <Col span={6}>
    <Box padding="s" backgroundColor="neutral-light">
      <Text kind="bodyM">Колонка 2 (25%)</Text>
    </Box>
  </Col>
  <Col span={6}>
    <Box padding="s" backgroundColor="neutral-light">
      <Text kind="bodyM">Колонка 3 (25%)</Text>
    </Box>
  </Col>
</Row>

// Смещения
<Row gutter={16}>
  <Col span={8} offset={4}>
    <Box padding="s" backgroundColor="neutral-light">
      <Text kind="bodyM">Колонка со смещением</Text>
    </Box>
  </Col>
</Row>

// Адаптивность
<Row gutter={16}>
  <Col span={24} md={12} lg={8}>
    <Box padding="s" backgroundColor="neutral-light">
      <Text kind="bodyM">Адаптивная колонка</Text>
    </Box>
  </Col>
  <Col span={24} md={12} lg={8}>
    <Box padding="s" backgroundColor="neutral-light">
      <Text kind="bodyM">Адаптивная колонка</Text>
    </Box>
  </Col>
</Row>
```

**Пропсы Row:**
- `gutter`: `number | [number, number]` — отступы между колонками
- `align`: `'top' | 'middle' | 'bottom'` — выравнивание
- `justify`: `'start' | 'end' | 'center' | 'space-between' | 'space-around' | 'space-evenly'`

**Пропсы Col:**
- `span`: `number` — ширина (от 1 до 24)
- `offset`: `number` — смещение
- `order`: `number` — порядок
- `pull`, `push`: `number` — смещение
- `md`, `lg`, `xl`: `number` — адаптивные настройки

---

## 🔗 Хуки (Hooks)

```tsx
import {
  useDebounce,
  useThrottle,
  useToggle,
  useLocalStorage,
  useCopy,
  useHotKeys,
} from '@sds-eng/base';

// useDebounce - задержка значения
function DebouncedInput() {
  const [value, setValue] = useState('');
  const debouncedValue = useDebounce(value, 500);
  
  useEffect(() => {
    console.log('Ищем:', debouncedValue);
  }, [debouncedValue]);
  
  return <Input value={value} onChange={setValue} placeholder="Поиск..." />;
}

// useThrottle - ограничение частоты вызова
function ThrottledScroll() {
  const [scrollY, setScrollY] = useState(0);
  const throttledScrollY = useThrottle(scrollY, 300);
  
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  return <Text kind="bodyM">Прокрутка: {throttledScrollY}</Text>;
}

// useToggle - переключатель
function ToggleDemo() {
  const [enabled, { toggle, setTrue, setFalse }] = useToggle(false);
  
  return (
    <Box display="flex" gap="s" alignItems="center">
      <Switch checked={enabled} onChange={toggle} />
      <Text kind="bodyM">{enabled ? 'Включено' : 'Выключено'}</Text>
    </Box>
  );
}

// useLocalStorage - localStorage
function LocalStorageDemo() {
  const [value, setValue, remove] = useLocalStorage<string>('my-key', 'default');
  
  return (
    <Box display="flex" gap="s" alignItems="center">
      <Input value={value} onChange={setValue} placeholder="Введите..." />
      <Button onClick={remove}>Удалить</Button>
    </Box>
  );
}

// useCopy - копирование
function CopyDemo() {
  const [text, setText] = useState('Копируемый текст');
  const [isCopied, { copy }] = useCopy(text);
  
  return (
    <Box display="flex" gap="s">
      <Input value={text} onChange={setText} />
      <Button onClick={copy} variant={isCopied ? 'success' : 'secondary'}>
        {isCopied ? 'Скопировано!' : 'Копировать'}
      </Button>
    </Box>
  );
}

// useHotKeys - горячие клавиши
function HotKeysDemo() {
  useHotKeys(
    'ctrl+s',
    () => console.log('Сохранено!'),
    { dependencies: [] }
  );
  
  useHotKeys(
    'escape',
    () => console.log('Esc нажат!'),
    { preventDefault: true }
  );
  
  return <Text kind="bodyM">Нажмите Ctrl+S или Esc</Text>;
}
```

---

## 📝 Полезные ссылки

- [Документация Sber Design System](https://sbercloud-platform.github.io/ui-kit/)
- [Иконки](https://sbercloud-platform.github.io/ui-kit-icons/)
- [Примеры компонентов](https://github.com/sbercloud-platform/ui-kit-examples)

---

*Последнее обновление: 22 мая 2026 г.*
