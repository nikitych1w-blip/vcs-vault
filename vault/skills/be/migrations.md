# BE · Миграции БД (sc-migrator / goose)

Источник: README `sc-migrator`. **Правило:** любое **добавление/изменение таблиц БД** (новая таблица, колонка, индекс, ограничение) требует **новой миграции**. Менять схему «руками» на проде запрещено.

> 🔒 **SQL-аппрув (governance):** миграции содержат SQL кроме `SELECT` (DDL/DML) → требуют **аппрува человека** перед выполнением и мёржем (CLAUDE.md → «Ограничения доступа»). Агент готовит миграцию, но не накатывает на реальную БД без подтверждения.

`sc-migrator` — отдельный CLI на базе [pressly/goose v3], управляет схемой SC:
- по **версии приложения** (через `schema_map.yaml`);
- по **прямой db-версии** (timestamp/sequence, напр. `20260415150000`).
Миграции embedded в бинарь (`go:embed sql/*.sql` + `goose.Provider`).

## Когда нужна миграция

Изменил `models/` (схему таблицы) или появилась новая сущность в БД → **обязательно**:
1. Добавить миграцию (SQL или Go) с новой **db-версией** (timestamp).
2. Прописать её в `schema_map.yaml` (маппинг релиза → `db_version`; при изменении **данных** — добавить в `manual_migrations`).
3. Проверить локально: `sc-migrator up ...` затем `sc-migrator check-pending` (должно быть `no pending migrations`).

## Где лежат миграции

```
migrations/sql/                         # SQL-миграции goose (формат goose: Up/Down)
migrations/release_map/schema_map.yaml  # релиз → db_version + список manual_migrations
internal/db_migrator/migrations/
  ├── sql_fs.go          # go:embed sql/*.sql → fs.FS
  └── go_migrations.go   # регистрация Go-миграций (WithGoMigrations)
```

- **SQL-миграция** — для обычных DDL (таблицы, колонки, индексы).
- **Go-миграция** — для сложных/долгих операций с данными (`goose.NewGoMigration`). Версии Go и SQL не должны конфликтовать; порядок общий по timestamp.

## schema_map.yaml

```yaml
releases:
  "1.2.0":
    db_version: 20260415150000
manual_migrations:
  - 20260415150000
```
`up --app-version 1.2.0` → находит `db_version`, накатывает `UpTo(target)`; если в диапазоне есть **ручная** миграция — останавливается перед ней с инструкцией запустить `run-manual`.

## Команды

| Команда | Назначение |
|---------|------------|
| `up --app-version <v>` / `--db-version <n>` | поднять схему (ровно один флаг) |
| `down --app-version <v>` / `--db-version <n>` | откатить (⚠️ `DROP COLUMN`/данные → возможна необратимая потеря; на проде — roll-forward + бэкапы) |
| `up-to --db-version <n>` / `down-to --db-version <n>` | до конкретной db-версии |
| `run-manual --db-version <n>` | ручная миграция (в `manual_migrations`): current<n → накат, =n → откат, >n → ошибка |
| `status` | какие применены / pending |
| `version` | текущая db-версия |
| `check-pending` | exit 1 если есть pending (для CI/health-check) |

Конфиг БД: `POSTGRES_DSN`/`POSTGRES_SCHEMA`/`SC_SCHEMA_MAP` (ENV), флаги `--db-dsn`/`--db-schema`/`--schema-map`, либо `--config <ini>` (тогда ENV и флаги БД игнорируются). Конкурентные миграции защищены advisory-lock (`--lock-timeout`/`--unlock-timeout`/`--lock-id`).

## Локальная проверка (реальный пример)

> ⚠️ Команды запускаются из корня репо `gitea` (`<gitea-repo>` — путь уточнить у разработчика, см. `role.md` → «Окружение и пути»). DSN, хост и порт (`localhost:5434`) ниже — **иллюстративные**, реальные значения уточнить (ENV `POSTGRES_DSN` / `--config`).

```bash
cd <gitea-repo>
go build -o bin/sc-migrator ./cmd/sc-migrator

# DSN/порт/версия ниже — из реального прогона (значения окружения-specific, уточнить)
./bin/sc-migrator \
  --db-dsn "postgres://sourcecontrol:sourcecontrol_pass@localhost:5434/sourcecontrol?sslmode=disable" \
  up --app-version 9.8.0
```

Успешный прогон (формат логов `op=... key=value`):
```text
sc-migrator: migrator: op=up app_version=9.8.0 target_db_version=20260527130000
sc-migrator: migrator: op=up-to noop current=20260527130000 target=20260527130000
sc-migrator: migrator: op=up app_version=9.8.0 db_version=20260527130000 status=success
```

- `status=success` — миграция применена (или схема уже на целевой версии).
- **Идемпотентно:** повторный `up` той же версии даёт `op=up-to noop current=<v> target=<v>` — изменений нет, это норма.
- `target_db_version` берётся из `schema_map.yaml` по `--app-version`.

## Ручные миграции

Авто `up/up-to/down/down-to` **останавливаются** перед миграциями из `manual_migrations` (и при накате, и при откате). Запускаются отдельно командой `run-manual` в maintenance-окно — нужны для модификации **данных**. При первой установке окружения ручных миграций быть не должно.

## Логирование Go-миграций (обязательно)

В Go-миграциях логгер передаётся аргументом функции. Уровни: `Info` (ключевые этапы, число обработанных строк, итог), `Warn` (нештатное некритичное), `Error` (только прерывающие ошибки). Логи информативны: версия миграции, таблица, операция; для долгих — прогресс каждые N записей + общее время. Ошибки оборачивать `fmt.Errorf("...: %w", err)` (см. [[be-error-logging]]).

```go
func Up(ctx context.Context, tx *sql.Tx, logger *log.Logger) error {
    logger.Println("migration 20260405190000: INFO: starting migration")
    if _, err := tx.ExecContext(ctx, `CREATE EXTENSION IF NOT EXISTS pg_trgm`); err != nil {
        return fmt.Errorf("create pg_trgm extension: %w", err)
    }
    return nil
}
```

## Деплой (типовой пайплайн)

CI собирает бинарь сервиса + `sc-migrator` → читает `schema_map.yaml` для `$RELEASE_VERSION` → `sc-migrator up --app-version $RELEASE_VERSION` → при успехе деплой сервиса. Если остановился на ручной миграции — админ в maintenance-окне `run-manual --db-version <n>`. Rollback: `down --app-version <R_old>` (ручные — через `run-manual`).

## На code review (миграции)

- Изменение схемы (таблицы/колонки/индексы) **есть → миграция должна присутствовать** в PR.
- Миграция данных — Go-миграция с информативными логами (`Info`/`Error`), итог с количественными показателями.
- Запись добавлена в `schema_map.yaml`; при модификации данных — в `manual_migrations`.
- Миграции не правятся на проде вручную; `down` с `DROP COLUMN` — осознанно.

Связано: [[be-db-xorm]], [[be-error-logging]], [[be-pass-review]].
