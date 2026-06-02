# QAA · Окружение и запуск

Скилл-выжимка. Заметки — `<vcs-playwright>/docs/{setup,configuration,vault,npm}.md`. Команды из `package.json`.

## Подготовка

- Установка/окружение — `docs/setup.md`; конфиг (`config/`, `.env` из `.env.example`) — `docs/configuration.md`; npm-доступ к корп. реестру — `docs/npm.md` (`.npmrc`).
- Секреты (токены, креды) — через **Vault** (`docs/vault.md`, `node-vault`). Не хардкодить.
- Контракт-типы: `npm run generate:zod` ([[codegen]]) перед тестами на новый/изменённый API.

## Запуск тестов

```bash
npx playwright test            # базовый прогон
npm run test:ui                # UI-режим Playwright
npm run test:debug             # debug
npm run test:trace             # с трейсом
npm run trace                  # show-trace <file>
```

Конфигурация раннера — `playwright.config.ts`; глобальная подготовка — `global.setup.ts`.

## Отчёты

```bash
npm run allure                 # сгенерировать и открыть Allure-отчёт
```
Репортеры: `allure-playwright` + `@vcs/test-culture-playwright-reporter`. Информативность шагов — за счёт `step()` ([[ui-tests]]/[[api-tests]]).

## Окружение/пути

`<vcs-playwright>` и submodule `spec` — вне vault, путь уточнять у разработчика; параметры (URL стенда, креды) — из конфига/Vault, не хардкодить.

Связано: [[codegen]], [[review]], [[role]].
