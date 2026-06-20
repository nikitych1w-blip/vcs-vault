# BE · Сабмодуль vcs-api в gitea (BE Flow)

Источник: VCS-22810. API-контракт живёт в сабмодуле `vcs-api` по пути `api/openapi/spec_embed/spec_from_sub_module` (относительно корня репо `gitea`). Типовой сценарий: аналитик вмержил ручку в `vcs-api/master` с `x-internal: true`, разработчик начинает реализацию в `gitea`.

> ⚠️ `<gitea-repo>` ниже — плейсхолдер пути к репозиторию `gitea` (лежит вне vault, расположение уточнить у разработчика — см. `role.md` → «Окружение и пути»). Пути вида `api/openapi/...` — относительные внутри репо.

## Первый запуск

```bash
cd <gitea-repo>
make update-spec
```
Ожидаемо: сабмодуль зарегистрирован и синхронизирован, sparse-checkout настроен, embedded-спеки собираются (`go build` для `api/openapi/spec_embed`).

## Работа с одним эндпойнтом

1. `make update-spec` — актуальный checkout спеки.
2. Снять `x-internal`:
   ```bash
   make ready-impl-use SURFACE=ui \
     API_PATH='/repos/{project_name}/{repo_name}/pulls/{index}/time_attributes/track' \
     METHOD=post
   ```
   Команда: создаёт/использует рабочую ветку в `vcs-api` (по умолчанию = имя текущей ветки `gitea`); снимает `x-internal`; `npm ci` при необходимости; `make build` в `vcs-api`; commit+push в `vcs-api`; проверяет embed; для `SURFACE=ui` запускает `make update-codegen`; добавляет в stage `gitea` gitlink сабмодуля и tracked `*.gen.go`.
3. Реализовать endpoint и тесты в `gitea`, commit + push.

**Порядок merge:** сначала merge ветки `gitea`, затем одноимённой ветки `vcs-api`.

## Базовая ветка сабмодуля

В обычном flow менять не нужно. `.gitmodules` остаётся `branch = master`; переход на feature-commit — через gitlink (`ready-impl-use`), а не сменой базовой ветки. Если временно переключали на feature — перед финальным PR вернуть `.gitmodules` на `master` и `make update-spec`.

## Перепривязать gitlink на новый SHA

```bash
cd <gitea-repo>/api/openapi/spec_embed/spec_from_sub_module
BRANCH=feature/VCS-19369
git fetch origin "$BRANCH"
git checkout --detach "origin/$BRANCH"
git rev-parse HEAD
cd <gitea-repo>
git add api/openapi/spec_embed/spec_from_sub_module
```
На конкретный commit — то же с `git fetch` + `git checkout --detach <SHA>`. После `git add` закоммитить gitlink обычным коммитом feature-ветки. `git checkout --detach origin/<branch>` — безопасный способ, если локальная ветка разошлась.

## Если кодген затронул чужую ручку

Проверить, на какой commit ссылается сабмодуль (`spec_from_sub_module`) — должен быть commit вашей feature-ветки `vcs-api`. Если не тот — переключить сабмодуль на нужный commit и `make update-codegen`.

## Force-флаги

- `FORCE_UPDATE_SPEC=1` — принудительно обновить сабмодуль на свежий `vcs-api/master`, даже если pinned на non-master.
- `FORCE_UPDATE_CODEGEN=1` — запустить кодген при изменённых tracked generated-файлах.
- `ALLOW_ALREADY_PUBLIC=1` — для `ready-impl-use`, если `x-internal` уже снят.

Норма: `current branch is pinned to non-master vcs-api commit; master refresh skipped` — защитная логика, сабмодуль оставлен на pinned commit до merge в master.

## Команды под капотом

- `make update-spec` — регистрирует/инициализирует сабмодуль, sparse-checkout, ставит gitlink текущей ветки, переводит на свежий master только если безопасно.
- `make update-codegen` — кодген по текущему сабмодулю; auto-stage только generated файлов; gitlink не стейджит.
- `make clean-codegen` / `clean-pkg` / `clean-bundles` — чистка результатов кодгена.
- `make ready-impl-use` — обязательно `SURFACE`, `METHOD`, `API_PATH` (или `REF`); опц. `API_BRANCH`, `API_COMMIT_MSG`, `API_TARGET`, `BASE_REF`. Печатает `SPEC_PROMOTE_SHA` — commit `vcs-api`, на который смотрит gitlink.

## Чек-лист

- [ ] `spec_from_sub_module` на верном commit верной ветки `vcs-api`.
- [ ] Кодген дал только изменения вашей ручки.
- [ ] `make test-backend-correct` проходит.

Связано: [[be-implement-endpoint]], [[be-git-flow]].
