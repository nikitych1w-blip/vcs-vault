# BE · Ветки и коммиты (git-flow)

Источник: VCS-11242. Правила проверяются автоматически: некорректное имя ветки/коммита блокирует push.

## Ветки

**Системные** (нельзя переименовывать/удалять/пушить напрямую): `main`, `master`, `develop`. Все новые изменения — от `develop`.

**Релизные:** `release/SourceControl/X.Y.Z` (семантическая версия). ✅ `release/SourceControl/2.1.0` · ❌ `release/2.1.0`, `release/sourcecontrol/2.1.0`, `release/SourceControl/v2.1.0`.

**Рабочие:** `тип/ТИКЕТ-номер-описание-на-латинице`
- тип: `feature` | `bugfix` | `hotfix`
- ТИКЕТ: `VCS` | `STS` | `SBTSUPPORT` | `CORESUP` | `PVWS` | `CRPV`
- номер: только цифры, без ведущих нулей
- описание: кратко, латиница, через дефисы

✅ `feature/VCS-8603-add-changelog`, `bugfix/STS-456-fix-security-issue`
❌ `feature/vcs-8603-...`, `bugfix/STS_456_fix_security`, `hotfix/CORESUP-0789-...`

## Коммиты

Формат заголовка: `ТИКЕТ-123: Описание действия`
1. Обязательно `": "` (двоеточие + пробел) после номера(ов) тикета.
2. Номер: `{ПРЕФИКС}-{НОМЕР}` (префикс из списка выше, номер без ведущих нулей).
3. Описание — с заглавной латинской буквы; разрешены латиница, цифры, пробелы, `. , ! ? : ; ( ) - / @`.

Несколько тикетов: `VCS-123 STS-456: Add user validation and fix login flow`.

✅ `VCS-123: Add user authentication`
❌ `VCS-123 Add ...` (нет `: `), `vcs-123: ...`, `VCS-0123: ...`, `VCS-123: Добавить...` (кириллица), `VCS-123: Fix "broken" logic! 😎`

## Инструменты контроля (до общего репозитория)

- **Husky** — git-хуки: `pre-commit` (проверка перед коммитом), `pre-push` (финальные проверки перед push). Конфиг в `.husky/`.
- **Commitlint** — валидация заголовка коммита по `commitlint.config.ts`, часть `pre-commit`.
- **Lint-staged** — линтеры только для staged-файлов (ESLint/Prettier/TS), вызывается из `pre-push`.

При нарушении: некорректная ветка → push остановлен с примерами; некорректный коммит → commitlint отклоняет с ошибкой.

## Пошаговый flow

```bash
git fetch --all
git checkout develop
git pull origin develop
git checkout -b feature/VCS-123-add-user-profile
# изменения...
git status
git add .
git commit -m "VCS-123: Add user profile page"   # → pre-commit (commitlint)
git push -u origin feature/VCS-123-add-user-profile  # → pre-push (lint-staged)
```

## FAQ

- **Лишние коммиты в PR:** `git pull --rebase origin develop`, затем `git push origin <branch> --force-with-lease`.
- **Забыли правку:** `git add <file>` → `git commit --amend` → `git push origin <branch> --force-with-lease`.
- **Переименовать ветку:** `git branch -m old new` → `git push origin :old` → `git push -u origin new`.

`--force-with-lease` безопасно перезаписывает только вашу ветку, не затрагивая чужие коммиты.

Связано: [[be-submodule]], [[be-implement-endpoint]].
