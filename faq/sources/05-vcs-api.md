---
tags: [faq, source, vcs-api, internal]
source: 05-vcs-api
---

# FAQ — 05-vcs-api

**Что это?**
Внутренний репозиторий с OpenAPI-спецификациями и Postman-коллекциями API платформы SourceControl.

**Где лежит?**
`sources/vcs-api/`

**Как обновить?**
```bash
make pull SOURCES=05-vcs-api
```

**Требования**
SSH-доступ к внутреннему Gitea. Источник помечен `optional: true` — при отсутствии доступа пропускается без ошибки.

**Что внутри?**
OpenAPI 3.x specs для публичного и внутреннего API, примеры запросов.
