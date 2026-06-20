# BE · БД, XORM, DTO/Entity (gitea)

Источник: стандарт кодстайла VCS-13092.

## DTO / Entity vs Модели

В Go избегаем суффиксов `UserDTO`/`CommentDTO`. Различаем два типа структур:

| Тип | Где | Признак |
|-----|-----|---------|
| **Модели** | `models/` | напрямую связаны с хранилищем, содержат теги `xorm` |
| **Entity** (DTO) | `models/*/entity/` | без `xorm`-тегов, выражают только бизнес-данные, свободно ходят между слоями |

Правила:
- Repository работает с DB-моделями (выполняет запросы) и **мапит их в Entity**.
- Service принимает/возвращает только **Entity** (и доменные ошибки), никогда не импортирует DB-модели.
- Entity не содержит XORM-тегов.

Размещение: `models/{domain}/entity/*.go` (напр. `models/repository/entity/initial_commit_opts.go`).
Алиас импорта: префикс домена + `_entity` → `import repo_entity "code.gitea.io/gitea/models/repo/entity"`.

## DI engine (не глобальный `db.Engine`)

Каждый репозиторий принимает зависимость через конструктор в виде **узкого интерфейса** `dbEngine` — только нужные методы. Так упрощается тестирование и не подтягивается весь `engine`.

```go
type codeHubCounterDBEngine interface {
    Insert(...interface{}) (int64, error)
    Delete(beans ...interface{}) (int64, error)
    // только реально используемые методы
}
type codeHubCounterDB struct { engine codeHubCounterDBEngine }
func NewCodeHubCounterDB(engine codeHubCounterDBEngine) codeHubCounterDB {
    return codeHubCounterDB{engine: engine}
}
```
В новом коде на DI **без указателей**.

Нейминг:
| Что | Именование |
|-----|------------|
| Интерфейс движка | `<RepositoryName>DBEngine` |
| Структура репозитория | `<RepositoryName>DB` |
| Конструктор | `New<RepositoryName>DB` |

## Известное ограничение: транзакции

Текущая реализация **не поддерживает транзакции через `context.Context`**. В Gitea `db.WithTx(ctx, ...)` кладёт сессию внутрь `ctx`, а `db.GetEngine(ctx)` достаёт её оттуда. Репозиторий с фиксированным `engine` в поле эту транзакцию не видит — запросы идут мимо.

**Временное решение:** если метод репозитория вызывается внутри транзакции (`db.WithTx`), использовать `db.GetEngine(ctx)` для этого конкретного вызова вместо `c.engine`:
```go
func (c codeHubCounterDB) InsertMetricCounter(ctx context.Context, repoID int64) error {
    counter := &internal_metric_counter.InternalMetricCounter{RepoID: repoID, MetricKey: ...}
    _, err := db.GetEngine(ctx).Insert(counter)  // внутри db.WithTx
    if err != nil { return fmt.Errorf("insert metric counter: %w", err) }
    return nil
}
```
(В перспективе — транзакционный менеджер.)

## Запросы

- **Передача таблиц:** если передаём структуру — таблицу указывать не нужно (XORM определит сам). Если `map[string]interface{}` — явно `.Table()`. В простых случаях предпочитать структуру.
- **Билдеры:** во всех новых SQL и при рефакторинге — `builder.Eq`/`builder.And`/`builder.Or` для условий. Повышает читаемость и **предотвращает SQL-инъекции**.

```go
cond := builder.Eq{"user_id": uid, "repo_id": repo.ID}
_, err := c.engine.Where(cond).Cols("mode").Update(updateBean)
```

> Изменение схемы (новая таблица/колонка/индекс) → обязательна миграция `sc-migrator` ([[be-db-migration]]).

Связано: [[be-code-architecture]], [[be-unit-tests]], [[be-db-migration]].
