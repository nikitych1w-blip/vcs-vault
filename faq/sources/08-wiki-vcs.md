---
tags: [faq, source, wiki, vcs]
source: 08-wiki-vcs
---

# FAQ — 08-wiki-vcs (VCS wiki)

**Что это?**
Внутренняя wiki команды SourceControl, экспортированная из SberTrack (пространство VCS).

**Где лежит?**
`sources/wiki/VCS/`

**Как обновить?**
```bash
make pull SOURCES=08-wiki-vcs
```

**Требования**
Переменная окружения `SBERTRACK_TOKEN`. Опционально: `SBERTRACK_BASE` для переопределения URL портала.

**Как работает синхронизация?**
1. Загружается иерархия страниц пространства VCS.
2. Для каждой страницы инициируется async экспорт в PDF.
3. PDF конвертируется в Markdown через pandoc.
4. Результат сохраняется с YAML-фронтматтером (title, code, updated).

**Что внутри?**
Процессы команды, договорённости, описание компонентов, onboarding-материалы.
