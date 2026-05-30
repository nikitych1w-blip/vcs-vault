---
tags: [faq, source, vcs-monitoring, internal]
source: 07-vcs-monitoring
---

# FAQ — 07-vcs-monitoring

**Что это?**
Внутренний репозиторий с дашбордами и конфигурацией мониторинга платформы SourceControl (Grafana, alerting).

**Где лежит?**
`sources/vcs-monitoring/`

**Как обновить?**
```bash
make pull SOURCES=07-vcs-monitoring
```

**Требования**
SSH-доступ к внутреннему Gitea. Источник помечен `optional: true`.

**Что внутри?**
JSON-дашборды Grafana, правила алертинга, описание метрик и SLO платформы.
