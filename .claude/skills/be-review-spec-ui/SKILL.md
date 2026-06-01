---
name: be-review-spec-ui
description: BE-ревью UI OpenAPI-контракта (api/openapi/ui/*) на готовность к реализации перед be-design. Вердикт approve/approve-with-comments/request-changes, матрица Draft/ReadyForBackend/ImplementedInBackend/Mismatch, обязательный make check-api-compat-all. Использовать как входной гейт BE-стадии до проектирования.
metadata: { author: vcs-pldc, version: "1.0", role: BE }
---

# BE · Ревью UI-контракта (входной гейт перед be-design)

Полный регламент — `vault/skills/be/review_spec_ui.md`. Область: **только UI-спека** (`api/openapi/ui/*`).

**Когда:** перед `be-design` — проверить, готов ли UI-контракт к backend-реализации. Только при `approve`/`ReadyForBackend` → продолжать к be-design; при `request-changes`/`Mismatch` → стоп, вернуть контракт SA.

**Порядок:**
1. Найти endpoint: `ui/index.yaml` → `$ref` в `domains/*/routes.yaml`.
2. Паспорт операции: `operationId`, `x-internal`, `x-required-privilege`, вход (`parameters`/`requestBody`/`security`), выход (`responses`, раскрыть `$ref` до `components/schemas`).
3. Связь с кодом: codegen `StrictServerInterface` → роут `routers/sc/api.go` → handler/service. Заполнить матрицу реализованности.
4. **Compat-check (обязательно):** уточнить у пользователя `BASE` (по умолчанию `origin/release/SourceControl/9.7.0`), затем `make check-api-compat-all BASE=<base_ref> FAIL_LEVEL=ERR` в `vcs-api`. Без фактического запуска вердикт `approve`/`approve-with-comments` недопустим.

**Отчёт:** Surface=UI · BASE · команда · результат (PASS/FAIL, ERR=n) · вердикт · blocking findings · матрица · рекомендации · только `ERR`-нарушения (WARN/INFO не включать).

⚠️ Команды запускать в репо `vcs-api`/`gitea` (вне vault; путь уточнить — `role.md` → «Окружение и пути»). Пересекается с [[be-api-compat]], но шире (полное ревью контракта + матрица + вердикт). Не путать с [[be-pass-review]] (ревью своего PR).

См. [[be-implement-endpoint]], [[be-submodule]], [[be-api-compat]].
