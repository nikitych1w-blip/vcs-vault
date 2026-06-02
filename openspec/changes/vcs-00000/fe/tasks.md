> Внимание: `qa/test-plan.md` отсутствует. Раздел тестов сформирован по `fe/design.md`, `sa/specs/repos-search/spec.md` и `vault/skills/fe/testing.md`; после появления QA-плана нужна сверка и актуализация.

## 0. API-клиент

- [x] 0.1 Обновить контракт `vcs-api` (UI) для `GET /repos/search` и сгенерировать клиент: `npm run api:generate` (Orval).
- [x] 0.2 Проверить, что в `shared/api/generated` появились/обновились нужные хуки и модели (`useGetReposSearch`, `ReposShortList`, `RepoShortListItem`, `ErrorResponse`); `generated/**` руками не править.

## 1. Реализация (FSD/React)

- [x] 1.1 Разместить код по слоям FSD (`pages/ | features/ | entities/ | shared/`) для сценария `UI / Проект / Репозитории / Поиск` (`#web2 #FE`).
- [x] 1.2 Собрать UI на `shared/ui` + `@sds-eng` (по макету), добавить `data-testid` на ключевые интерактивные элементы и экспортировать публичный API срезов через `index.ts`.
- [x] 1.3 Подключить данные через React Query только сгенерированными Orval-хуками; выполнить маппинг query-параметров `q`, `project_name`, `is_favorite`, `is_watching`, `is_in_source_hub`, `language`, `archived`, `sort`, `page`, `limit` в API-запрос.
- [x] 1.4 Реализовать состояния экрана: `loading / empty / error/{400,401,403,404,500} / no-access / content` с корректными UX-реакциями (retry, reset фильтров, переход в auth-flow).
- [x] 1.5 Обновить URL-state и MFE-интеграцию: shareable query params, сброс `page=1` при смене фильтров/сортировки, при необходимости обновить `exposes` и синхронизацию с хостом (`gitea-react-adapter`).

## 2. Тесты

- [x] 2.1 Playwright: позитивный сценарий поиска (`q` + быстрые фильтры + сортировка `update:desc` + пагинация + переход в карточку репозитория).
- [ ] 2.2 Playwright + WireMock: негативные/граничные сценарии (`empty`, `error 400/401/403/404/500`, `no-access`, tri-state фильтры, `language` CSV без пробелов).
- [ ] 2.3 Уточнить у разработчика раннер юнит-тестов компонентов (vitest/jest) и после подтверждения добавить минимальные тесты на маппинг состояний/пропсов.
- [ ] 2.4 После появления `qa/test-plan.md` синхронизировать FE E2E-набор с QA-сценариями и обновить этот чеклист.

## 3. Линты и quality-gate

- [ ] 3.1 Запустить `npm run lint`, `npm run lint:types`, `npm run lint:css` и устранить замечания.
- [x] 3.2 Запустить `npm run lint:fsd` (steiger) и убрать нарушения границ слоёв/импортов FSD.
- [ ] 3.3 Проверить работу страницы в MFE и standalone-режиме перед готовностью к PR.
