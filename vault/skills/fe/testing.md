# FE · Тесты и моки

Скилл-выжимка. Полная заметка — `../../knowledges/fe/wiremock.md` (источник VCS-8337).

## WireMock (моки API)

Маппинги в `__files` (тела) + `mappings` (правила). Покрывать **все состояния**: success / error / empty / loading.

Сценарии (stateful) — по `scenarioName` + `requiredScenarioState`:
- список (`GET …/entities` → `list.json`), элемент, создание (1-й POST → 400, 2-й → 201), удаление (1-й DELETE → 404, 2-й → 200).
- начальное состояние `"Started"`, цепочка состояний непрерывна, без опечаток.
- приоритет: меньше число = выше; точное совпадение метод/URL/query/headers/body.

**Отладка:** `/__admin/requests`, сброс сценариев `POST /__admin/scenarios/reset`. В dev (Strict Mode) возможны дубль-запросы → использовать prod-сборку / curl / тесты.

## data-testid

Добавлять на ключевые элементы для E2E/компонентных тестов — стандарт `data-testid` ([[styleguide]]).

## E2E

Playwright (`@playwright/test`, `playwright.config.js`). Связывать сценарий с узлом test-model/TC (как у QAA), переиспользовать фикстуры из `mocks/__files/`.

> ⚠️ Юнит-раннер компонентов (vitest/jest) в стеке однозначно не зафиксирован — уточнить у фронтендера; не выдумывать.

Связано: [[states-checklist]], [[review]], [[role]].
