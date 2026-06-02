# FE · Линты и готовность к ревью

Перед PR прогнать весь набор проверок FE (скрипты `package.json`). Правила веток/коммитов — общие, см. BE `git-flow.md` (husky + commitlint + lint-staged).

## Проверки (команды из `package.json`)

```bash
npm run lint          # prettier --check + eslint по ./web_src/spa
npm run lint:types    # tsc --noEmit (строгие типы)
npm run lint:css      # stylelint web_src/spa/**/*.css
npm run lint:fsd      # steiger ./web_src/spa — архитектура FSD
npm run lint:orval    # prettier+eslint --fix по shared/api/generated
npm run format        # prettier --write (фикс)
```

Линтеры/конфиги: ESLint (`eslint.config.js`: import, simple-import-sort, react, react-hooks, prettier, @tanstack/query), Prettier, Stylelint (`.stylelintrc.cjs`), Steiger (`steiger.config.js`).

## Чек-лист перед PR

- [ ] Имя ветки/коммита по стандарту (`feature/VCS-XXXX_...`, `VCS-XXXX: ...`) — [[git-flow]].
- [ ] `npm run lint` + `lint:types` + `lint:css` без ошибок.
- [ ] `npm run lint:fsd` — нет нарушений FSD.
- [ ] `shared/api/generated/` не правился руками ([[api-client]]).
- [ ] Покрыты состояния loading/empty/error/no-access ([[data-state]]).
- [ ] UI из `@sds-eng`/octicons, не дублируется ([[components]]).
- [ ] Тесты Playwright проходят ([[testing]]).
- [ ] MFE-контракт (`exposes ./export-app`, react singleton) не сломан ([[mfe]]).

## Red flags на ревью

- Правки в `shared/api/generated/` руками.
- Нарушение FSD (импорт снизу вверх / мимо `index.ts`).
- Самописный fetch вместо React Query; необработанные состояния ошибок.
- Хардкод строк вместо i18n; дублирование компонентов UI-кита.

Связано: [[architecture]], [[api-client]], [[data-state]], [[testing]], [[role]]. Общие коммиты/ветки — `vault/skills/be/git-flow.md`.
