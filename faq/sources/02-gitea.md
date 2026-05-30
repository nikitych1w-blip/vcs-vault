---
tags: [faq, source, gitea]
source: 02-gitea
---

# FAQ — 02-gitea (Gitea docs)

**Что это?**
Официальная документация Gitea — self-hosted Git-сервиса, на котором основана платформа SourceControl.

**Где лежит?**
`sources/gitea/docs/` — документация в Markdown по категориям (installation, administration, usage, API).

**Как обновить?**
```bash
make pull SOURCES=02-gitea
```

**Что внутри?**
Установка и конфигурация, управление пользователями/организациями/репозиториями, webhooks, Actions, REST API.

**Зачем sparse checkout?**
Берём только `/docs/`, игнорируем исходники сайта и assets.
