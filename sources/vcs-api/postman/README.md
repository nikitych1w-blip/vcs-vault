# Postman-коллекции SourceControl API

Сгенерированные коллекции лежат в `generated/` и разбиты по поверхностям API:


| Папка           | API         | Base URL                |
| --------------- | ----------- | ----------------------- |
| `generated/v2/` | HTTP API v2 | `https://<host>/api/v2` |
| `generated/v3/` | HTTP API v3 | `https://<host>/api/v3` |
| `generated/ui/` | UI API      | `https://<host>/web/v2` |


Каждая подпапка содержит JSON-файл Postman Collection v2.1, сгруппированный по тегу (User, Repos, PR и т.д.).

## Аутентификация и переменные

Все коллекции используют **Basic Auth** на уровне коллекции и ожидают внешние переменные окружения:

- `baseUrl` — полный базовый URL, например `https://{ift3}/api/v3`
- `basicAuthUsername` — логин
- `basicAuthPassword` — пароль

## Перегенерация

```bash
# Из корня vcs-api:
make postman
# Или, если бандлы уже актуальны:
npm run postman:generate
# Проверить генератор:
npm run test:postman
# Проверить генерацию и структурную корректность сгенерированных коллекций:
npm run postman:check
```

## Импорт в Postman

1. Открыть Postman, нажать **Import** (или `Ctrl+O`).
2. Перетащить один или несколько JSON-файлов из `generated/`.
3. Создать или выбрать environment.
4. Добавить переменные `baseUrl`, `basicAuthUsername`, `basicAuthPassword`.
5. Заполнить их актуальными значениями.
6. Убедиться, что выбран нужный environment.

## Импорт в Insomnia

1. Открыть Insomnia, нажать **Import** в меню (или через Scratch Pad).
2. Выбрать **From File** и указать нужный JSON из `generated/`.
3. Перейти в **Manage Environments** (`Ctrl+E`).
4. Добавить переменные `baseUrl`, `basicAuthUsername`, `basicAuthPassword`.
5. Заполнить их актуальными значениями.
6. Убедиться, что на запросе выбран `Basic Auth`, если Insomnia не подхватил его автоматически при импорте.

> Insomnia не поддерживает вложенные ссылки на переменные вида `{{A}}` внутри значений других переменных, поэтому `baseUrl` содержит полный URL, а не ссылку на отдельную переменную хоста.

