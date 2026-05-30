---
tags: [faq, source, vcs-playwright, internal]
source: 03-vcs-playwright
---

# FAQ — 03-vcs-playwright

**Что это?**
Внутренний репозиторий с E2E-тестами платформы SourceControl на Playwright.

**Где лежит?**
`sources/vcs-playwright/`

**Как обновить?**
```bash
make pull SOURCES=03-vcs-playwright
```

**Требования**
SSH-доступ к внутреннему Gitea. Источник помечен `optional: true`.

**Что внутри?**
Тест-сценарии на TypeScript: создание/клонирование репозиториев, PR-флоу, права доступа, webhooks.
