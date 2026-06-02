# QAA · Линты и готовность к ревью

Скилл-выжимка. Команды из `package.json`. Ветки/коммиты — общий стандарт `vault/skills/be/git-flow.md` (husky + lint-staged).

## Проверки перед PR

```bash
npm run lint            # eslint . (+ playwright plugin, filename-rules)
npm run prettier        # prettier . --check
npm run madge:circular  # запрет циклических зависимостей (src/ tests/)
npx playwright test     # тесты зелёные
npm run allure          # отчёт (при необходимости приложить)
```

## Чек-лист

- [ ] Ветка/коммит по стандарту (`feature/VCS-XXXX_...`, `VCS-XXXX: ...`).
- [ ] `lint` + `prettier` + `madge:circular` без ошибок.
- [ ] `src/api/generated/` не правился руками ([[codegen]]).
- [ ] Нейминг по `naming-convention` (kebab + суффиксы; DTO snake_case) — [[conventions]].
- [ ] Локаторы только в page/component классах; селекторы по `data-testid` ([[ui-tests]]).
- [ ] Ресурсы чистятся через `cleanup.push()` ([[conventions]]).
- [ ] Действия в `step()` (информативный Allure).
- [ ] Каждый автотест связан с **TC** и **узлом** test-model (трассировка).
- [ ] Покрыты позитив + ошибки (4xx/5xx) + edge cases по `qa/test-plan.md`.

## Red flags

- Правки в `src/api/generated/` руками.
- Локаторы/селекторы в тестах вместо page/component классов; селекторы не по `data-testid`.
- Нет `cleanup` для созданных ресурсов; «висящие» данные на стенде.
- Хардкод кредов/URL вместо Vault/конфига.
- Циклические зависимости (ловит `madge:circular`).
- Тест без привязки к TC/узлу.

Связано: [[conventions]], [[api-tests]], [[ui-tests]], [[codegen]], [[setup-run]], [[role]].
