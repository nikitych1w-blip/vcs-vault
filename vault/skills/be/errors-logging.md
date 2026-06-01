# BE · Ошибки, логирование, трейсинг (gitea)

Источник: стандарт кодстайла VCS-13092.

## Враппинг ошибок

Каждая ошибка, возвращаемая вверх по стеку, **оборачивается** через `fmt.Errorf("...: %w", err)` (именно `%w`, не `%v`).

```go
// плохо
return nil, err
return nil, fmt.Errorf("error: %w", err)   // неинформативно
// хорошо
return nil, fmt.Errorf("get user: %w", err)
```

## Логирование

### Требования к логам
- человекочитаемые, на английском;
- без явных имён функций (`GetUserById` → `get user by id`).

### Уровни
| Уровень | Когда |
|---------|-------|
| `Debug` | старт/завершение операции; доп. данные **без сенситива**; все пользовательские ошибки (400) |
| `Info` | запуск сложных/тяжёлых операций; важное для первичного анализа, без сенситива |
| `Warn` | неполные данные, но операция продолжается; повторные попытки; потенциально проблемные ситуации |
| `Error` | операция не завершена; исключения; провал валидации (но приложение живёт); системные ошибки (500) |

Исключение: если ошибка на текущем уровне не будет завёрнута и выше не пойдёт, но её надо зафиксировать — допустимо логировать уровнем `error`. Шаблон: `Error has occurred while <operation>: %v, err`.

### Где логировать
- Основное место — **граница выполнения операции**: `handler` / `worker`.
- Во внутренних слоях (`service`, `repository`) **не логировать** ошибки, которые просто пробрасываются вверх (избегаем дублирования и шума).
- Исключение (логировать локально, обычно `warn`/`error`): ошибка обрабатывается локально и не поднимается; нужен доп. операционный контекст; деградация/fallback/partial success.

### Переход на `zap`
Предпочтительно — **DI-логгер** (передан в конструктор): `gvc.logger.Debug("Gigaview recalculation completed")`. Контекст добавлять полями логгера.

Глобальный логгер `log.HTTP().Error/Warn/Debug(...)` допустим в коде, ещё не переведённом на DI, или где используется общий инфраструктурный контекст.

Поля лога — типизированные helpers из `params`; если подходящего нет — `extra fields`:
```go
log.HTTP().Error("Get repo watchers failed",
    params.WithRepoParams(params.WithRepoID(repoID)),
    params.WithErrParams(err),
)
```
Часто: `params.WithErrParams`, `WithRepoParams`, `WithExtraParams`, `WithCommitParams`.

### Примеры
- **Граница (handler):** залогировать `log.HTTP().Error(...)` и `return`.
- **Проброс вверх (service):** просто `return nil, fmt.Errorf("get repo by id: %w", err)` — залогируется на handler.
- **Локальная деградация (fallback):** `log.HTTP().Warn("Create token failed, mail sent without reply-to", params.WithErrParams(err))` — операция продолжается.

## Трейсинг

Во **всех публичных методах** — трейсинг (замер времени, трассы вызовов). Если есть DI — tracer передаётся полем структуры; если нет — локальная инициализация:
```go
tracer := trace.NewTracer() // только если нет DI
message := tracer.CreateTraceMessage(ctx)
if err = tracer.Trace(message); err != nil {
    log.Error("Error has occurred while creating trace message: %v", err)
}
defer func() {
    if err = tracer.TraceTime(message); err != nil {
        log.Error("Error has occurred while creating trace time message: %v", err)
    }
}()
```

Связано: [[be-code-architecture]], [[be-implement-endpoint]].
