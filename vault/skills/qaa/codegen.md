# QAA · Кодоген типов из контракта (zod)

Скилл-выжимка. Заметки — `<vcs-playwright>/docs/spec.md`. Источник правды — `vcs-api` (submodule `spec/`).

## Источник спеки

`spec/` — git-submodule `vcs-api` (`ssh://…/vcs/vcs-api.git`), sparse-checkout `api/openapi/*`.

```bash
git submodule sync
git submodule update --remote     # обновить spec до свежего
# или npm-обёртка: npm run submodule:update
```

## Генерация zod-типов

Инструмент — **@hey-api/openapi-ts** (плагин `zod`). Маппинг входов/выходов — `openapi-ts.config.ts`.

```bash
npm run generate:zod   # submodule:update + очистка + openapi-ts → src/api/generated/types
```

Покрывает (из `openapi-ts.config.ts`): `http/v2`, `http/v3`, UI-bundle (`web/bundle`), Kafka-продьюсеры (`v1/v2/elk`: repo, pull, commit). Вывод — `src/api/generated/types/<...>` (definitions + requests + responses + infer-типы).

## Правила

- **`src/api/generated/` руками НЕ править** — перегенерируется (clean). Это аналог codegen-правил BE/FE.
- Новый/изменённый эндпоинт или Kafka-схема в `vcs-api` → обновить submodule → `npm run generate:zod` → использовать сгенерированные zod-типы в тестах и для валидации ответов.
- zod-типы — для типобезопасности и проверки структуры; доп. валидация JSON-схем — ajv ([[api-tests]]).

Связано: [[api-tests]], [[role]]. Контракт — общий с BE/FE (vcs-api).
