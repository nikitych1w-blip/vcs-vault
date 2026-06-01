## Why

Нужно формализовать поведение `GET /repos/search` в SDD-артефактах, чтобы требования к фильтрации, сортировке, пагинации и структуре ответа были однозначными для BE/FE/QA.
Это важно сейчас, потому что endpoint используется как базовый сценарий поиска репозиториев в UI API web2 и должен иметь трассируемые требования до уровня сценариев.

## What Changes

- Добавляем capability для поиска репозиториев через `GET /repos/search` (web2).
- Фиксируем требования к входным query-параметрам: `q`, `project_name`, `language`, `archived`, `is_watching`, `is_favorite`, `is_in_source_hub`, `sort`, `page`, `limit`.
- Фиксируем правила сортировки и пагинации в ответе (`pagination` + `data`).
- Фиксируем контракт успешного ответа `ReposShortList` и обязательные коды ошибок `400/401/403/404/500`.
- Scope изменения ограничен только endpoint `/repos/search` без расширения на другие маршруты.

## Capabilities

### New Capabilities
- `repos-search`: Поиск репозиториев с фильтрацией, сортировкой и пагинацией через `GET /repos/search`.

### Modified Capabilities
- Нет.

## Impact

- OpenAPI path: `sources/vcs-api/api/openapi/ui/index.yaml` (`/repos/search` -> `#/ReposSearch`).
- Описание endpoint: `sources/vcs-api/api/openapi/ui/domains/repos/routes.yaml` (`ReposSearch`).
- Query-параметры: `sources/vcs-api/api/openapi/ui/domains/repos/params.yaml` и `sources/vcs-api/api/openapi/ui/common/params.yaml`.
- Ответы и схемы: `sources/vcs-api/api/openapi/ui/domains/repos/responses.yaml`, `sources/vcs-api/api/openapi/ui/domains/repos/schemas.yaml`, `sources/vcs-api/api/openapi/ui/common/pagination.yaml`.
