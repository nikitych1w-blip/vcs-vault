# BE · Архитектура и нейминг (gitea)

Источник правды по кодстайлу — стандарт команды (VCS-13092), дополнения: VCS-6472 (слои), VCS-15891 (пакет контроллера). Репозиторий продукта — `gitea` (форк Gitea; **не копировать legacy-подходы оригинального Gitea**, если противоречат стандарту).

## Слои (4–5)

```
Web/REST → Controller(Handler/Server) → Service(Usecase) → Repository → Database
                                              ↑ Domain/Model (независим)
```

| Слой | Пакет | Назначение | Чего быть НЕ должно |
|------|-------|------------|---------------------|
| Handler/Server/Controller | `api/servers/ui`, `routers/api/v1..v3` | принимает HTTP, валидирует параметры, зовёт сервис, формирует HTTP-ответ | нет бизнес-логики; нет прямых походов в БД/Gitaly |
| Service/Usecase | `services` | бизнес-логика, оркестрация репозиториев, проверка прав | нет HTTP-контекста (`http.Request/ResponseWriter`, статусов); нет деталей БД/XORM |
| Pkg (опц.) | `modules` | общие переиспользуемые утилиты (http-клиенты, парсеры, обёртки) | нет конкретной бизнес-логики |
| Repository | `repository` | доступ к данным: SQL/XORM/Gitaly; возвращает модели/Entity | нет бизнес-логики и проверки прав; нет транспортных ошибок |
| Model/Domain | `models` | доменные сущности, DTO/Entity, доменные ошибки | нет зависимостей от верхних слоёв (запрещён импорт services/repository/routers) |

## DI

Зависимости передаются в конструктор и хранятся в полях структуры; внутри методов — уже готовые зависимости, новые экземпляры руками не создаём. В новом коде **не используем указатели** (меньше риск nil pointer dereference). Сервис получает в конструктор репозитории/трейсер/логгер; репозиторий — engine/tracer.

## Суффиксы модулей по слоям

| Слой | Именование |
|------|------------|
| Handler/Server | `<Name>Server` |
| Service | `<Name>Service` |
| PKG | `<Name>Module` |
| Repository | `<Name>DB`, `<Name>Git` |
| Model | `<Name>` |

## Нейминг и раскладка файлов

**Общее правило:** файлы именуются по функциональной роли — `getter.go`, `setter.go`, `merger.go`, `creater.go`, `deleter.go`. Если в пакете много логики в одном файле — раздробить по ролям.

**Серверный слой** (см. VCS-15891):
- `server.go` — только конструктор (`Server`, `NewServer`), без бизнес-логики.
- `interfaces.go` — все интерфейсы зависимостей контроллера в одном файле.
- `handler_<operationId_snake_case>.go` — **1 операция = 1 файл**. Имя метода = `operationId` из OpenAPI; имя файла = `handler_` + snake_case(operationId). `operationId` — единственный источник правды.
- `convert.go` — маппинг доменных сущностей в API-модели; `validate.go` — валидация; `errors.go` — типизированные API-ошибки.

```
api/servers/ui/pull_requests/
├── server.go
├── interfaces.go
├── handler_get_pr.go        # operationId: GetPR
├── handler_subscribe_pr.go  # operationId: SubscribePR
├── convert.go  validate.go  errors.go
```

**Сервисный слой:** `service.go` (интерфейс + структура + DI-конструктор), реализация методов по ролям — `getter.go`, `creater.go`, `deleter.go`.

**Репозиторный слой:** постфикс источника данных:
- БД → `_db.go` в `repository/db` (напр. `repository/db/repos/repo_db.go`).
- Gitaly → `_git.go` в `repository/git` (напр. `repository/git/commits/commit_git.go`).
- При дроблении объёмной логики базовый файл `{domain}_db.go` / `{domain}_git.go` хранит структуру и DI-конструктор: `repository/comment/comment_db.go`, `checker_db.go`, `deleter_db.go`.

**Доменный слой:** `models/{domain}.go`; доменные ошибки — `models/error.go` внутри пакета; DTO — см. [[be-db-xorm]] (Entity).

## Структура импортов (3 блока, разделены пустой строкой)

```go
import (
    "context"   // stdlib
    "fmt"
    "net/http"

    "github.com/go-chi/chi/v5"   // внешние (go get)
    "go.opentelemetry.io/otel"

    "code.gitea.io/gitea/modules/setting"  // внутренние
)
```
GoLand: Code Style → Go → Imports, Sorting type `gofmt`, Group stdlib imports.

## Legacy

- Старые функции, заменяемые DI-реализацией, помечать `// Deprecated: use <...>` с указанием замены.
- **Не использовать именованные возвращаемые значения** (`(err error)`) в новом коде.
- Логику обращения к БД из `models`/`modules` при рефакторинге выносить в `repository` и помечать старое Deprecated.

Связано: [[be-error-logging]], [[be-db-xorm]], [[be-implement-endpoint]].
