---
tags: [faq, source, wiki, swtr, task-tracker]
source: 09-task-tracker
---

# FAQ — 09-task-tracker (SWTR wiki)

**Что это?**
Wiki пространства SWTR в SberTrack — документация по task-трекеру, используемому командой SourceControl.

**Где лежит?**
`sources/wiki/SWTR/`

**Как обновить?**
```bash
make pull SOURCES=09-task-tracker
```

**Требования**
Переменная окружения `SBERTRACK_TOKEN`. Опционально: `SBERTRACK_BASE`.

**Что ещё есть в этом источнике?**
`sources/wiki/SWTR/api.yaml` — OpenAPI 3.1.0 спецификация REST API SberTrack (SWTR).

**Что внутри wiki?**
Описание процессов работы с задачами, типы тикетов, воркфлоу, интеграции, FAQ по трекеру.
