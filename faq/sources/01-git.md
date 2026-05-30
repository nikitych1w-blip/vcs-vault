---
tags: [faq, source, git]
source: 01-git
---

# FAQ — 01-git (Pro Git book)

**Что это?**
Первое издание книги «Pro Git» Скотта Чакона, английский текст. Классический справочник по Git: от основ до internals.

**Где лежит?**
`sources/git/en/` — главы в Markdown, `sources/git/figures/` — иллюстрации.

**Как обновить?**
```bash
make pull SOURCES=01-git
```

**Что внутри?**
Главы 1–9: основы, branching, distributed workflow, Git internals, настройка, GitHub.

**Зачем sparse checkout?**
Репозиторий содержит переводы на ~10 языков. Мы берём только `/en/` и `/figures/`.

**Почему `.markdown` → `.md`?**
Исходные файлы имеют расширение `.markdown`; постобработка переименовывает их для корректной индексации Obsidian.
