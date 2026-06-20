# Рабочий процесс: от идеи до реализации

## Общая схема

```
Intent Steward сессия
        ↓
Proposal (SA) → sa-specs (SA)
                     ↓              ↓
               be-design (BE)   fe-design (FE)
                     ↓              ↓
               qa-plan (QA) ←←←←←←←←
                     ↓
               qaa-tasks (QAA) ← be-design
                     ↓
               be-tasks (BE)
                     ↓
               fe-tasks (FE)
                     ↓
               apply (реализация)
                     ↓
               archive
```

---

## Шаг 0: Intent Steward

Перед созданием proposal SA (или вся команда) проводит сессию с AI в роли **Intent Steward** (`vault/skills/common/ai-native-workflow.md`).

Цель: сформулировать **Daily Intent Contract** — осознанное бизнес-намерение с критериями успеха.

Результат становится основой для `proposal.md`.

---

## Шаг 1: Создание изменения

```bash
make openspec-new CHANGE=vcs-10012-add-reactions
```

Создаёт директорию `openspec/changes/vcs-10012-add-reactions/` с `.openspec.yaml`.

Нейминг: `vcs-<номер-задачи>-<kebab-case-описание>`.

---

## Шаг 2: Proposal (SA)

**Кто**: Системный аналитик  
**Скилл**: `vault/skills/sa/role.md`  
**Артефакт**: `sa/proposal.md`

Содержит:
- Why / Why Now
- What Changes (список изменений)
- Capabilities (новые и изменённые)
- Impact (затронутые API, сервисы)
- Макет (ссылка на Figma, если затрагивает UI)

Не описывает реализацию — только намерение и контекст.

---

## Шаг 3: SA-specs (SA)

**Артефакт**: `sa/specs/<capability-name>/spec.md`  
Один файл на каждую capability из proposal.

Delta-спека с разделами: `ADDED / MODIFIED / REMOVED Requirements`.

**Гейт**: после черновика — прогнать ревью UI-контракта (`vault/skills/be/review_spec_ui.md`). Расхождение → доработать до be-design.

---

## Шаг 4: BE-design (BE)

**Скилл**: `vault/skills/be/`  
**Артефакт**: `be/design.md`

**Гейт (шаг 0)**: прогнать `review_spec_ui.md`. При вердикте `request-changes/Mismatch` — стоп, вернуть контракт SA.

Содержит: Endpoints, Auth, Flow, Error Handling, DTO, Dependencies, Архитектурные решения.

Если затрагивается схема БД → `migrations.md` (SQL != SELECT требует аппрув человека).

---

## Шаг 5: FE-design (FE)

**Скилл**: `vault/skills/fe/`  
**Артефакт**: `fe/design.md`

Основывается на: proposal + sa-specs + be-design + **макет** (Figma/скрин из proposal).

Содержит: Макет, Компоненты, Состояния (loading/success/empty/error), API-интеграция, Навигация, Узлы test-model.

API-клиент генерируется Orval из `sources/vcs-api` — сгенерированные файлы не редактировать.

---

## Шаг 6: QA-plan (QA)

**Скилл**: `vault/skills/qa/`  
**Артефакт**: `qa/test-plan.md`

Содержит: затрагиваемые узлы test-model, позитивные/негативные/граничные сценарии, приоритетные #ПАО-тесты.

**Gate релиза** в конце:
- Все `#ПАО`-узлы имеют `status: covered`
- SA подтвердил список изменённых узлов
- Метрика покрытия рассчитана

---

## Шаг 7: QAA-tasks (QAA)

**Артефакт**: `qaa/tasks.md`

Чеклист автоматизации: E2E (Playwright), Integration (API), Contract (OpenAPI).

---

## Шаг 8: BE-tasks + FE-tasks

**Артефакты**: `be/tasks.md`, `fe/tasks.md`

Чеклисты реализации по разделам: Реализация → Тесты → Документация.

---

## Шаг 9: Apply (реализация)

Финальная стадия. Ассистент читает `be/design.md`, `fe/design.md`, `qa/test-plan.md` и последовательно выполняет задачи из чеклистов.

BE — по этапам: submodule → endpoint-flow → errors-logging → db-xorm → migrations → testing → git-flow → code-review.

FE — по этапам: api-client → architecture → create-page → styleguide → states-checklist → testing → review.

---

## Шаг 10: Archive

```bash
make openspec-archive CHANGE=vcs-10012-add-reactions
```

Перемещает изменение в архив (нельзя редактировать после).

---

## One-command запуск

```bash
make openspec-flow CHANGE=vcs-10012-add-reactions
```

Проходит все шаги 2–10 интерактивно, с confirm-gate перед apply и archive.

Продолжить прерванный flow:
```bash
make openspec-flow-resume CHANGE=vcs-10012-add-reactions
```

---

## Конвенция нейминга

| Элемент | Формат |
|---------|--------|
| Change name | `vcs-<ID>-<kebab-case>` |
| Git-ветка | `feature/VCS-<ID>` |
| Capability | kebab-case, создаёт `sa/specs/<name>/spec.md` |
| Требование | `REQ-XXX` |
| Тест-кейс | `TC-XXXX` |
| Дефект | `BUG-XXXX` |
