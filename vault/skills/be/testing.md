# BE · Юнит-тесты и моки (gitea)

Источники: VCS-22821 §8 (тесты endpoint-а), VCS-13092 (моки mockery).

## Корнер-кейсы (обязательный набор)

Для новой логики endpoint-а нужны unit-тесты на:
- позитивный сценарий;
- валидационные ошибки (`400`) — проверка параметров request (payload/query/path);
- отсутствие сущности (`404`);
- внутренние ошибки (`500`);
- специфичные бизнес-ветки (`401/403/409`, если есть).

**Сначала тесты, затем реализация endpoint-а** (test-first).

## Моки — только generated (mockery)

Самописные моки запрещены. Установка:
```bash
go install github.com/vektra/mockery/v2@latest
```

Директива над интерфейсом (`//go:generate` — ровно два слеша, иначе не запустится):
```go
//go:generate mockery --name=SomeModule --output=./mocks --filename=some_module_mock.go
type SomeModule interface {
    DoSomething(ctx context.Context, id string) error
    GetSomething(ctx context.Context, id string) (*Something, error)
}
```
Генерация: `go generate ./...`

### Два сценария размещения мока

1. **Интерфейс используется во многих местах** — мок рядом с интерфейсом, импортируется по проекту:
   ```
   modules/some_module/
     some_module.go        # интерфейс + go:generate
     mocks/some_module_mock.go
   ```
2. **Интерфейс нужен в одном/нескольких пакетах** — мок рядом с тестом пакета (через `--srcpkg`):
   ```
   services/some_service/
     some_service.go
     some_service_test.go  # go:generate здесь
     mocks/some_module_mock.go
   ```
   ```go
   //go:generate mockery --name=SomeModule --srcpkg=code.gitea.io/gitea/modules/some_module --output=./mocks --filename=some_module_mock.go
   ```

### Использование в тесте
```go
import "code.gitea.io/gitea/modules/some_module/mocks"
func TestSomething(t *testing.T) {
    m := new(mocks.SomeModule)
    m.On("DoSomething", mock.Anything, "123").Return(nil)
    // ...
}
```

### Правила именования и флаги
- Папка моков: `mocks/`; файл: `<имя_файла>_mock.go`.
- Флаги mockery: `--name` (имя интерфейса), `--srcpkg` (пакет интерфейса), `--output` (куда), `--filename` (имя файла).

## Прогон

```bash
make test-backend-correct   # перед коммитом
```

> Открытый вопрос: что именно покрывает `make test-backend-correct` (только тесты / + линт / + покрытие) — уточняется. Узкие интерфейсы DI (см. [[be-db-xorm]]) упрощают мок-тестирование.

Связано: [[be-implement-endpoint]], [[be-db-xorm]], [[be-code-architecture]].
