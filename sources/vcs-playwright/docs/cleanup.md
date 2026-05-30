# Документация по работе с фикстурой Cleanup

## Обзор

Фикстура `cleanup` предоставляет механизм автоматического выполнения очисточных функций после завершения теста, даже если тест завершится с ошибкой. Это особенно полезно для удаления временных ресурсов, таких как пользователи, тестовые данные, файлы и т.д.

## Использование фикстуры

### Основной принцип

1. Фикстура `cleanup` автоматически создается для каждого теста
2. Все функции, добавленные через `cleanup.push()`, выполняются после завершения теста
3. Функции выполняются в порядке LIFO (последний добавленный — первый выполнен)
4. Ошибки в функциях очистки логируются, но не приводят к падению теста

### Пример базового использования

```ts
import { test } from '@vcs-pw/fixtures';

test('тест с cleanup', async ({ cleanup }) => {
  const user = await userService.createUser('John');
  cleanup.push(() => userService.deleteUser(user.id));
  expect(user.name).toBe('NotJohn');
  // Даже если тест упадёт — cleanup сработает
});
```

## Примеры использования

### 1. Работа с пользователями

```ts
test('создание и удаление пользователя', async ({ cleanup, page }) => {
  const user = await userService.createUser('John');
  cleanup.push(() => userService.deleteUser(user.id));

  await page.goto('/profile');
  await page.fill('#username', user.name);

  expect(await page.inputValue('#username')).toBe('John');
});
```

### 2. Работа с файлами

```ts
test('работа с временными файлами', async ({ cleanup }) => {
  const tempFile = await createTempFile('test data');
  cleanup.push(() => fs.unlinkSync(tempFile.path));

  const content = await readFile(tempFile.path);
  expect(content).toContain('test data');
});
```

### 3. Комплексная очистка

```ts
test('сложный тест с несколькими ресурсами', async ({ cleanup }) => {
  // Создаем пользователя
  const user = await userService.createUser('John');
  cleanup.push(() => userService.deleteUser(user.id));

  // Создаем проект
  const project = await projectService.createProject('Test Project', user.id);
  cleanup.push(() => projectService.deleteProject(project.id));

  // Создаем задачу
  const task = await taskService.createTask('Test Task', project.id);
  cleanup.push(() => taskService.deleteTask(task.id));

  // Выполняем тестовые действия
  await page.goto(`/projects/${project.id}`);
  expect(await page.textContent('.project-name')).toBe('Test Project');
});
```

## Особенности работы

### Обработка ошибок

Ошибки в функциях очистки:

- Не приводят к падению теста
- Логируются с уровнем WARNING
- Все функции в стеке все равно выполняются

```ts
// Если одна из функций очистки выбросит ошибку
cleanup.push(() => {
  throw new Error('Ошибка при очистке');
});
cleanup.push(() => {
  console.log('Эта функция всё равно выполнится');
});
```

### Порядок выполнения

Функции выполняются в обратном порядке добавления (LIFO):

```ts
cleanup.push(() => console.log('1')); // Выполнится последним
cleanup.push(() => console.log('2')); // Выполнится вторым
cleanup.push(() => console.log('3')); // Выполнится первым
```

## Рекомендации по использованию

### 1. Обязательная очистка

Всегда добавляйте функции очистки сразу после создания ресурсов:

```ts
const user = await userService.createUser('John');
cleanup.push(() => userService.deleteUser(user.id));
```

### 2. Проверка существования ресурсов

При необходимости можно добавить проверку перед очисткой:

```ts
cleanup.push(async () => {
  if (user && user.id) {
    await userService.deleteUser(user.id);
  }
});
```

### 3. Использование в before/after блоках

```ts
test.beforeEach(async ({ cleanup }) => {
  // Можно использовать cleanup и здесь
  cleanup.push(() => cleanupAllTestData());
});

test('тест', async ({ cleanup }) => {
  // Очистка будет выполнена после теста
});
```
