# FE · Линты и готовность к ревью

Скилл-выжимка. Опирается на `../../knowledges/fe/stack.md`, `styleguide.md`, `development-checklist.md`. Ветки/коммиты — общий стандарт `vault/skills/be/git-flow.md` (husky + commitlint + lint-staged).

## Проверки перед PR

```bash
npm run lint          # prettier --check + eslint (web_src/spa)
npm run lint:types     # tsc --noEmit
npm run lint:css       # stylelint web_src/spa/**/*.css
npm run lint:fsd       # steiger — архитектура FSD
npm run lint:orval     # prettier+eslint --fix по generated
npm run format         # prettier --write (фикс)
```

## Чек-лист

- [ ] Ветка/коммит по стандарту (`feature/VCS-XXXX_...`, `VCS-XXXX: ...`) — git-flow.
- [ ] `lint` + `lint:types` + `lint:css` + `lint:fsd` зелёные.
- [ ] `generated/` и `openapi_ui_bundle.yaml` не правились руками ([[api-client]]).
- [ ] Покрыты состояния loading/empty/error/no-access ([[states-checklist]]).
- [ ] Экран сверен с макетом из change (`desktop` + `mobile`): соблюдены фиксированные размеры/отступы и порядок контролов, лишние элементы не добавлены.
- [ ] Новый роут синхронизирован с `gitea-react-adapter.js` ([[create-page]]).
- [ ] `data-testid` на ключевых элементах; WireMock-моки обновлены ([[testing]]).
- [ ] Standalone-сборка проверена ([[states-checklist]]).

## Red flags

- Правки в `generated/`/бандле руками.
- Нарушение FSD (импорт снизу вверх / мимо `index.ts`).
- `useQuery` вместо Orval-хуков; необработанные состояния.
- `FC<>`, `interface` вместо `type`, `import React`, `!!`/`+''` (нарушения [[styleguide]]).
- Лишние UI-контролы или отклонения от фиксированных размеров из `fe/design.md` без явного согласования.
- Новый роут без regex в адаптере.

Связано: [[styleguide]], [[architecture]], [[api-client]], [[states-checklist]], [[testing]], [[role]].
