# Тесткейсы для метода GET /repos/{project_name}/{repo_name}/milestones

## Метод: GET /repos/{project_name}/{repo_name}/milestones

**Описание:** Получить список этапов (milestones) репозитория

**Параметры запроса:**
- `project_name` (path, required) - имя проекта
- `repo_name` (path, required) - имя репозитория
- `q` (query, optional) - поисковый запрос
- `page` (query, optional) - номер страницы
- `limit` (query, optional) - количество элементов на странице

**Схема ответа (Milestone):**
- `id` (integer) - уникальный идентификатор этапа
- `name` (string) - название этапа
- `description` (string, optional) - описание этапа
- `due_date` (string, date-time, nullable) - дата завершения
- `state` (string, enum: open, closed) - состояние этапа

**Тестовые данные для проверки:**
- Base URL: `https://sc-vp.ift.pd04.pvw.sbt/web/v2`
- project_name: `scvp`
- repo_name: `repo_1`


## vcs-1-ep-001
**Id:** vcs-1-ep-001  
**Название:** GET /repos/{project_name}/{repo_name}/milestones — 200 OK — Успешное получение списка этапов  
**Приоритет:** major  
**Уровень теста:** api  
**Теги:** api, milestones, vcs, equivalence, get  
**Шаги:**  
**Шаг 1:** Заполнить поле project_name корректным значением существующего проекта  
**Тестовые данные:** scvp  
**Ожидаемый результат:** Значение принято  

**Шаг 2:** Заполнить поле repo_name корректным значением существующего репозитория  
**Тестовые данные:** repo_1  
**Ожидаемый результат:** Значение принято  

**Шаг 3:** Подставить валидный Bearer токен авторизованного пользователя с правами read  
**Тестовые данные:** eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ3UlhJemQ1Zjk0dUVqaUUtZW0xVG1iNXNvU3  
**Ожидаемый результат:** Токен принят  

**Шаг 4:** Отправить GET-запрос на /repos/{project_name}/{repo_name}/milestones  
**Тестовые данные:** GET /api/v3/repos/scvp/repo_1/milestones  
**Ожидаемый результат:** Запрос выполнен. Статус ответа 200 OK  

**Шаг 5:** Проверить тело ответа  
**Тестовые данные:** {"pagination": {"current_page": 1, "total_items": 3}, "data": [{"id": 1, "name": "Sprint 1", "state": "open"}]}  
**Ожидаемый результат:** Тело содержит пагинированный список этапов согласно схеме  


## vcs-1-ep-002
**Id:** vcs-1-ep-002  
**Название:** GET /repos/{project_name}/{repo_name}/milestones — 200 OK — Пустой список этапов  
**Приоритет:** minor  
**Уровень теста:** api  
**Теги:** api, milestones, vcs, equivalence, empty  
**Шаги:**  
**Шаг 1:** Заполнить поле project_name корректным значением существующего проекта  
**Тестовые данные:** scvp  
**Ожидаемый результат:** Значение принято  

**Шаг 2:** Заполнить поле repo_name значением репозитория без этапов  
**Тестовые данные:** repo_empty  
**Ожидаемый результат:** Значение принято  

**Шаг 3:** Подставить валидный Bearer токен авторизованного пользователя  
**Тестовые данные:** eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ3UlhJemQ1Zjk0dUVqaUUtZW0xVG1iNXNvU3  
**Ожидаемый результат:** Токен принят  

**Шаг 4:** Отправить GET-запрос на /repos/{project_name}/{repo_name}/milestones  
**Тестовые данные:** GET /api/v3/repos/scvp/repo_empty/milestones  
**Ожидаемый результат:** Запрос выполнен. Статус ответа 200 OK  

**Шаг 5:** Проверить тело ответа  
**Тестовые данные:** {"pagination": {"total_items": 0}, "data": []}  
**Ожидаемый результат:** Тело содержит пустой массив данных  


## vcs-1-ep-003
**Id:** vcs-1-ep-003  
**Название:** GET /repos/{project_name}/{repo_name}/milestones — 401 Unauthorized — Запрос без авторизации  
**Приоритет:** critical  
**Уровень теста:** api  
**Теги:** api, milestones, auth, security, equivalence  
**Шаги:**  
**Шаг 1:** Заполнить поле project_name корректным значением  
**Тестовые данные:** scvp  
**Ожидаемый результат:** Значение принято  

**Шаг 2:** Заполнить поле repo_name корректным значением  
**Тестовые данные:** repo_1  
**Ожидаемый результат:** Значение принято  

**Шаг 3:** Не передавать токен авторизации в заголовке  
**Тестовые данные:** (отсутствует)  
**Ожидаемый результат:** Заголовок Authorization не передан  

**Шаг 4:** Отправить GET-запрос на /repos/{project_name}/{repo_name}/milestones  
**Тестовые данные:** GET /api/v3/repos/scvp/repo_1/milestones  
**Ожидаемый результат:** Запрос выполнен. Статус ответа 401 Unauthorized  

**Шаг 5:** Проверить тело ответа  
**Тестовые данные:** {"detail": "Требуется аутентификация"}  
**Ожидаемый результат:** Тело содержит ошибку авторизации  


## vcs-1-ep-004
**Id:** vcs-1-ep-004  
**Название:** GET /repos/{project_name}/{repo_name}/milestones — 401 Unauthorized — Невалидный токен  
**Приоритет:** critical  
**Уровень теста:** api  
**Теги:** api, milestones, auth, security, equivalence  
**Шаги:**  
**Шаг 1:** Заполнить поле project_name корректным значением  
**Тестовые данные:** scvp  
**Ожидаемый результат:** Значение принято  

**Шаг 2:** Заполнить поле repo_name корректным значением  
**Тестовые данные:** repo_1  
**Ожидаемый результат:** Значение принято  

**Шаг 3:** Подставить невалидный Bearer токен  
**Тестовые данные:** invalid_token_12345  
**Ожидаемый результат:** Токен некорректен  

**Шаг 4:** Отправить GET-запрос на /repos/{project_name}/{repo_name}/milestones  
**Тестовые данные:** GET /api/v3/repos/scvp/repo_1/milestones  
**Ожидаемый результат:** Запрос выполнен. Статус ответа 401 Unauthorized  

**Шаг 5:** Проверить тело ответа  
**Тестовые данные:** {"detail": "Невалидный токен"}  
**Ожидаемый результат:** Тело содержит ошибку авторизации  


## vcs-1-ep-005
**Id:** vcs-1-ep-005  
**Название:** GET /repos/{project_name}/{repo_name}/milestones — 403 Forbidden — Пользователь без прав  
**Приоритет:** major  
**Уровень теста:** api  
**Теги:** api, milestones, auth, security, equivalence  
**Шаги:**  
**Шаг 1:** Заполнить поле project_name корректным значением существующего проекта  
**Тестовые данные:** scvp  
**Ожидаемый результат:** Значение принято  

**Шаг 2:** Заполнить поле repo_name корректным значением существующего репозитория  
**Тестовые данные:** repo_1  
**Ожидаемый результат:** Значение принято  

**Шаг 3:** Подставить Bearer токен пользователя без права read на репозиторий  
**Тестовые данные:** eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ3UlhJemQ1Zjk0dUVqaUUtZW0xVG1iNXNvU3  
**Ожидаемый результат:** Токен принят  

**Шаг 4:** Отправить GET-запрос на /repos/{project_name}/{repo_name}/milestones  
**Тестовые данные:** GET /api/v3/repos/scvp/repo_1/milestones  
**Ожидаемый результат:** Запрос выполнен. Статус ответа 403 Forbidden  

**Шаг 5:** Проверить тело ответа  
**Тестовые данные:** {"type": "null", "title": "Forbidden", "detail": "Доступ запрещен."}  
**Ожидаемый результат:** Тело содержит ошибку доступа  


## vcs-2-bv-003
**Id:** vcs-2-bv-003  
**Название:** GET /repos/{project_name}/{repo_name}/milestones — Пустое значение project_name  
**Приоритет:** minor  
**Уровень теста:** api  
**Теги:** api, milestones, boundary, validation  
**Шаги:**  
**Шаг 1:** Заполнить поле project_name пустым значением  
**Тестовые данные:** (пустая строка)  
**Ожидаемый результат:** Значение передано  

**Шаг 2:** Заполнить поле repo_name корректным значением  
**Тестовые данные:** repo_1  
**Ожидаемый результат:** Значение принято  

**Шаг 3:** Подставить валидный Bearer токен  
**Тестовые данные:** eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ3UlhJemQ1Zjk0dUVqaUUtZW0xVG1iNXNvU3  
**Ожидаемый результат:** Токен принят  

**Шаг 4:** Отправить GET-запрос на /repos/{project_name}/{repo_name}/milestones  
**Тестовые данные:** GET /api/v3/repos//repo_1/milestones  
**Ожидаемый результат:** Запрос выполнен. Статус 400 Bad Request  

**Шаг 5:** Проверить тело ответа  
**Тестовые данные:** {"title": "Bad Request"}  
**Ожидаемый результат:** Тело содержит ошибку валидации   


## vcs-2-bv-005
**Id:** vcs-2-bv-005  
**Название:** GET /repos/{project_name}/{repo_name}/milestones — Пустое значение repo_name  
**Приоритет:** minor  
**Уровень теста:** api  
**Теги:** api, milestones, boundary, validation  
**Шаги:**  
**Шаг 1:** Заполнить поле project_name корректным значением  
**Тестовые данные:** scvp  
**Ожидаемый результат:** Значение принято  

**Шаг 2:** Заполнить поле repo_name пустым значением  
**Тестовые данные:** (пустая строка)  
**Ожидаемый результат:** Значение передано  

**Шаг 3:** Подставить валидный Bearer токен  
**Тестовые данные:** eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ3UlhJemQ1Zjk0dUVqaUUtZW0xVG1iNXNvU3  
**Ожидаемый результат:** Токен принят  

**Шаг 4:** Отправить GET-запрос на /repos/{project_name}/{repo_name}/milestones  
**Тестовые данные:** GET /api/v3/repos/scvp//milestones  
**Ожидаемый результат:** Запрос выполнен. Статус 400 Bad Request  

**Шаг 5:** Проверить тело ответа  
**Тестовые данные:** {"title": "Bad Request"}  
**Ожидаемый результат:** Тело содержит ошибку валидации  


## vcs-2-bv-006
**Id:** vcs-2-bv-006  
**Название:** GET /repos/{project_name}/{repo_name}/milestones — Специальные символы в project_name  
**Приоритет:** minor  
**Уровень теста:** api  
**Теги:** api, milestones, boundary, validation  
**Шаги:**  
**Шаг 1:** Заполнить поле project_name значением со специальными символами  
**Тестовые данные:** sc@vp!#$  
**Ожидаемый результат:** Значение передано  

**Шаг 2:** Заполнить поле repo_name корректным значением  
**Тестовые данные:** repo_1  
**Ожидаемый результат:** Значение принято  

**Шаг 3:** Подставить валидный Bearer токен  
**Тестовые данные:** eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ3UlhJemQ1Zjk0dUVqaUUtZW0xVG1iNXNvU3  
**Ожидаемый результат:** Токен принят  

**Шаг 4:** Отправить GET-запрос на /repos/{project_name}/{repo_name}/milestones  
**Тестовые данные:** GET /api/v3/repos/sc@vp!#$/repo_1/milestones  
**Ожидаемый результат:** Запрос выполнен. Статус 400 Bad Request  

**Шаг 5:** Проверить тело ответа  
**Тестовые данные:** {"title": "Bad Request"}  
**Ожидаемый результат:** Тело содержит ошибку валидации  


## vcs-3-pw-001
**Id:** vcs-3-pw-001  
**Название:** GET /repos/{project_name}/{repo_name}/milestones — Pairwise #1 — Валидные параметры + авторизация  
**Приоритет:** major  
**Уровень теста:** api  
**Теги:** api, milestones, pairwise  
**Шаги:**  
**Шаг 1:** Заполнить поле project_name корректным значением  
**Тестовые данные:** scvp  
**Ожидаемый результат:** Значение принято  

**Шаг 2:** Заполнить поле repo_name корректным значением  
**Тестовые данные:** repo_1  
**Ожидаемый результат:** Значение принято  

**Шаг 3:** Подставить валидный Bearer токен авторизованного пользователя с правами read  
**Тестовые данные:** eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ3UlhJemQ1Zjk0dUVqaUUtZW0xVG1iNXNvU3  
**Ожидаемый результат:** Токен принят  

**Шаг 4:** Отправить GET-запрос на /repos/{project_name}/{repo_name}/milestones  
**Тестовые данные:** GET /api/v3/repos/scvp/repo_1/milestones  
**Ожидаемый результат:** Запрос выполнен. Статус ответа 200 OK  

**Шаг 5:** Проверить тело ответа  
**Тестовые данные:** {"data": [...]}  
**Ожидаемый результат:** Тело содержит пагинированный список этапов  


## vcs-3-pw-002
**Id:** vcs-3-pw-002  
**Название:** GET /repos/{project_name}/{repo_name}/milestones — Pairwise #2 — Несуществующий репозиторий  
**Приоритет:** minor  
**Уровень теста:** api  
**Теги:** api, milestones, pairwise  
**Шаги:**  
**Шаг 1:** Заполнить поле project_name корректным значением  
**Тестовые данные:** scvp  
**Ожидаемый результат:** Значение принято  

**Шаг 2:** Заполнить поле repo_name несуществующим значением  
**Тестовые данные:** nonexistent_repo  
**Ожидаемый результат:** Значение принято  

**Шаг 3:** Подставить валидный Bearer токен авторизованного пользователя  
**Тестовые данные:** eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ3UlhJemQ1Zjk0dUVqaUUtZW0xVG1iNXNvU3  
**Ожидаемый результат:** Токен принят  

**Шаг 4:** Отправить GET-запрос на /repos/{project_name}/{repo_name}/milestones  
**Тестовые данные:** GET /api/v3/repos/scvp/nonexistent_repo/milestones  
**Ожидаемый результат:** Запрос выполнен. Статус ответа 404 Not Found  


## vcs-3-pw-003
**Id:** vcs-3-pw-003  
**Название:** GET /repos/{project_name}/{repo_name}/milestones — Pairwise #3 — Несуществующий проект  
**Приоритет:** minor  
**Уровень теста:** api  
**Теги:** api, milestones, pairwise  
**Шаги:**  
**Шаг 1:** Заполнить поле project_name несуществующим значением  
**Тестовые данные:** nonexistent_project  
**Ожидаемый результат:** Значение принято  

**Шаг 2:** Заполнить поле repo_name любым значением  
**Тестовые данные:** repo_1  
**Ожидаемый результат:** Значение принято  

**Шаг 3:** Подставить валидный Bearer токен авторизованного пользователя  
**Тестовые данные:** eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ3UlhJemQ1Zjk0dUVqaUUtZW0xVG1iNXNvU3  
**Ожидаемый результат:** Токен принят  

**Шаг 4:** Отправить GET-запрос на /repos/{project_name}/{repo_name}/milestones  
**Тестовые данные:** GET /api/v3/repos/nonexistent_project/repo_1/milestones  
**Ожидаемый результат:** Запрос выполнен. Статус ответа 404 Not Found  


## vcs-3-pw-004
**Id:** vcs-3-pw-004  
**Название:** GET /repos/{project_name}/{repo_name}/milestones — Pairwise #4 — Без авторизации  
**Приоритет:** minor  
**Уровень теста:** api  
**Теги:** api, milestones, pairwise  
**Шаги:**  
**Шаг 1:** Заполнить поле project_name корректным значением  
**Тестовые данные:** scvp  
**Ожидаемый результат:** Значение принято  

**Шаг 2:** Заполнить поле repo_name корректным значением  
**Тестовые данные:** repo_1  
**Ожидаемый результат:** Значение принято  

**Шаг 3:** Не передавать токен авторизации  
**Тестовые данные:** (отсутствует)  
**Ожидаемый результат:** Заголовок Authorization не передан  

**Шаг 4:** Отправить GET-запрос на /repos/{project_name}/{repo_name}/milestones  
**Тестовые данные:** GET /api/v3/repos/scvp/repo_1/milestones  
**Ожидаемый результат:** Запрос выполнен. Статус ответа 401 Unauthorized  


## vcs-3-pw-005
**Id:** vcs-3-pw-005  
**Название:** GET /repos/{project_name}/{repo_name}/milestones — Pairwise #5 — Пользователь без прав  
**Приоритет:** minor  
**Уровень теста:** api  
**Теги:** api, milestones, pairwise  
**Шаги:**  
**Шаг 1:** Заполнить поле project_name корректным значением  
**Тестовые данные:** scvp  
**Ожидаемый результат:** Значение принято  

**Шаг 2:** Заполнить поле repo_name корректным значением  
**Тестовые данные:** repo_1  
**Ожидаемый результат:** Значение принято  

**Шаг 3:** Подставить Bearer токен пользователя без прав read  
**Тестовые данные:** eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ3UlhJemQ1Zjk0dUVqaUUtZW0xVG1iNXNvU3  
**Ожидаемый результат:** Токен принят  

**Шаг 4:** Отправить GET-запрос на /repos/{project_name}/{repo_name}/milestones  
**Тестовые данные:** GET /api/v3/repos/scvp/repo_1/milestones  
**Ожидаемый результат:** Запрос выполнен. Статус ответа 403 Forbidden  


## vcs-3-pw-006
**Id:** vcs-3-pw-006  
**Название:** GET /repos/{project_name}/{repo_name}/milestones — Pairwise #6 — Архивированный репозиторий  
**Приоритет:** minor  
**Уровень теста:** api  
**Теги:** api, milestones, pairwise  
**Шаги:**  
**Шаг 1:** Заполнить поле project_name корректным значением  
**Тестовые данные:** scvp  
**Ожидаемый результат:** Значение принято  

**Шаг 2:** Заполнить поле repo_name значением архивированного репозитория  
**Тестовые данные:** archived_repo  
**Ожидаемый результат:** Значение принято  

**Шаг 3:** Подставить валидный Bearer токен авторизованного пользователя  
**Тестовые данные:** eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ3UlhJemQ1Zjk0dUVqaUUtZW0xVG1iNXNvU3  
**Ожидаемый результат:** Токен принят  

**Шаг 4:** Отправить GET-запрос на /repos/{project_name}/{repo_name}/milestones  
**Тестовые данные:** GET /api/v3/repos/scvp/archived_repo/milestones  
**Ожидаемый результат:** Запрос выполнен. Статус 200 OK  


## vcs-4-eg-001
**Id:** vcs-4-eg-001  
**Название:** GET /repos/{project_name}/{repo_name}/milestones — Отсутствие project_name  
**Приоритет:** major  
**Уровень теста:** api  
**Теги:** api, milestones, error_guessing  
**Шаги:**  
**Шаг 1:** Не заполнять поле project_name (пропустить в URL)  
**Тестовые данные:** (отсутствует)  
**Ожидаемый результат:** Параметр не передан  

**Шаг 2:** Заполнить поле repo_name корректным значением  
**Тестовые данные:** repo_1  
**Ожидаемый результат:** Значение принято  

**Шаг 3:** Подставить валидный Bearer токен  
**Тестовые данные:** eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ3UlhJemQ1Zjk0dUVqaUUtZW0xVG1iNXNvU3  
**Ожидаемый результат:** Токен принят  

**Шаг 4:** Отправить GET-запрос на /repos/{project_name}/{repo_name}/milestones  
**Тестовые данные:** GET /api/v3/repos//repo_1/milestones  
**Ожидаемый результат:** Запрос выполнен. Статус 404 Not Found  


## vcs-4-eg-002
**Id:** vcs-4-eg-002  
**Название:** GET /repos/{project_name}/{repo_name}/milestones — Отсутствие repo_name  
**Приоритет:** major  
**Уровень теста:** api  
**Теги:** api, milestones, error_guessing  
**Шаги:**  
**Шаг 1:** Заполнить поле project_name корректным значением  
**Тестовые данные:** scvp  
**Ожидаемый результат:** Значение принято  

**Шаг 2:** Не заполнять поле repo_name (пропустить в URL)  
**Тестовые данные:** (отсутствует)  
**Ожидаемый результат:** Параметр не передан  

**Шаг 3:** Подставить валидный Bearer токен  
**Тестовые данные:** eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ3UlhJemQ1Zjk0dUVqaUUtZW0xVG1iNXNvU3  
**Ожидаемый результат:** Токен принят  

**Шаг 4:** Отправить GET-запрос на /repos/{project_name}/{repo_name}/milestones  
**Тестовые данные:** GET /api/v3/repos/scvp//milestones  
**Ожидаемый результат:** Запрос выполнен. Статус 404 Not Found  


## vcs-4-eg-003
**Id:** vcs-4-eg-003  
**Название:** POST /repos/{project_name}/{repo_name}/milestones — Неверный метод HTTP  
**Приоритет:** minor  
**Уровень теста:** api  
**Теги:** api, milestones, error_guessing  
**Шаги:**  
**Шаг 1:** Заполнить поле project_name корректным значением  
**Тестовые данные:** scvp  
**Ожидаемый результат:** Значение принято  

**Шаг 2:** Заполнить поле repo_name корректным значением  
**Тестовые данные:** repo_1  
**Ожидаемый результат:** Значение принято  

**Шаг 3:** Подставить валидный Bearer токен  
**Тестовые данные:** eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ3UlhJemQ1Zjk0dUVqaUUtZW0xVG1iNXNvU3  
**Ожидаемый результат:** Токен принят  

**Шаг 4:** Отправить POST-запрос на /repos/{project_name}/{repo_name}/milestones  
**Тестовые данные:** POST /api/v3/repos/scvp/repo_1/milestones  
**Ожидаемый результат:** Запрос выполнен. Статус 405 Method Not Allowed  


## vcs-4-eg-004
**Id:** vcs-4-eg-004  
**Название:** GET /repos/{project_name}/{repo_name}/milestones — Неверный формат токена  
**Приоритет:** major  
**Уровень теста:** api  
**Теги:** api, milestones, error_guessing, auth  
**Шаги:**  
**Шаг 1:** Заполнить поле project_name корректным значением  
**Тестовые данные:** scvp  
**Ожидаемый результат:** Значение принято  

**Шаг 2:** Заполнить поле repo_name корректным значением  
**Тестовые данные:** repo_1  
**Ожидаемый результат:** Значение принято  

**Шаг 3:** Подставить некорректный Bearer токен  
**Тестовые данные:** invalid_token_format  
**Ожидаемый результат:** Токен некорректен  

**Шаг 4:** Отправить GET-запрос на /repos/{project_name}/{repo_name}/milestones  
**Тестовые данные:** GET /api/v3/repos/scvp/repo_1/milestones  
**Ожидаемый результат:** Запрос выполнен. Статус 401 Unauthorized  


## vcs-4-eg-005
**Id:** vcs-4-eg-005  
**Название:** GET /repos/{project_name}/{repo_name}/milestones — Истекший токен  
**Приоритет:** major  
**Уровень теста:** api  
**Теги:** api, milestones, error_guessing, auth  
**Шаги:**  
**Шаг 1:** Заполнить поле project_name корректным значением  
**Тестовые данные:** scvp  
**Ожидаемый результат:** Значение принято  

**Шаг 2:** Заполнить поле repo_name корректным значением  
**Тестовые данные:** repo_1  
**Ожидаемый результат:** Значение принято  

**Шаг 3:** Подставить просроченный Bearer токен  
**Тестовые данные:** eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwiZXhwIjoxNjAwMDAwMDAwfQ.expired  
**Ожидаемый результат:** Токен просрочен  

**Шаг 4:** Отправить GET-запрос на /repos/{project_name}/{repo_name}/milestones  
**Тестовые данные:** GET /api/v3/repos/scvp/repo_1/milestones  
**Ожидаемый результат:** Запрос выполнен. Статус 401 Unauthorized  


## vcs-4-eg-008
**Id:** vcs-4-eg-008  
**Название:** GET /repos/{project_name}/{repo_name}/milestones — Очень длинное project_name  
**Приоритет:** minor  
**Уровень теста:** api  
**Теги:** api, milestones, error_guessing, validation  
**Шаги:**  
**Шаг 1:** Заполнить поле project_name очень длинным значением (>1000 символов)  
**Тестовые данные:** aaaaaaaaaa... (1000+ раз)  
**Ожидаемый результат:** Значение передано  

**Шаг 2:** Заполнить поле repo_name корректным значением  
**Тестовые данные:** repo_1  
**Ожидаемый результат:** Значение принято  

**Шаг 3:** Подставить валидный Bearer токен  
**Тестовые данные:** eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ3UlhJemQ1Zjk0dUVqaUUtZW0xVG1iNXNvU3  
**Ожидаемый результат:** Токен принят  

**Шаг 4:** Отправить GET-запрос на /repos/{project_name}/{repo_name}/milestones  
**Тестовые данные:** GET /api/v3/repos/{1000+ chars}/repo_1/milestones  
**Ожидаемый результат:** Запрос выполнен. Статус 400 Bad Request   


## vcs-5-sb-001
**Id:** vcs-5-sb-001  
**Название:** GET /repos/{project_name}/{repo_name}/milestones — State #1 — Новый репозиторий без истории  
**Приоритет:** minor  
**Уровень теста:** api  
**Теги:** api, milestones, state_based  
**Шаги:**  
**Шаг 1:** Создать новый пустой репозиторий в проекте  
**Тестовые данные:** project=scvp, repo=new_empty_repo  
**Ожидаемый результат:** Репозиторий создан  

**Шаг 2:** Заполнить поле project_name значением проекта  
**Тестовые данные:** scvp  
**Ожидаемый результат:** Значение принято  

**Шаг 3:** Заполнить поле repo_name значением нового репозитория  
**Тестовые данные:** new_empty_repo  
**Ожидаемый результат:** Значение принято  

**Шаг 4:** Подставить валидный Bearer токен  
**Тестовые данные:** eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ3UlhJemQ1Zjk0dUVqaUUtZW0xVG1iNXNvU3  
**Ожидаемый результат:** Токен принят  

**Шаг 5:** Отправить GET-запрос на /repos/{project_name}/{repo_name}/milestones  
**Тестовые данные:** GET /api/v3/repos/scvp/new_empty_repo/milestones  
**Ожидаемый результат:** Запрос выполнен. Статус 200 OK, пустой список этапов  


## vcs-5-sb-002
**Id:** vcs-5-sb-002  
**Название:** GET /repos/{project_name}/{repo_name}/milestones — State #2 — Репозиторий с активными этапами  
**Приоритет:** minor  
**Уровень теста:** api  
**Теги:** api, milestones, state_based  
**Шаги:**  
**Шаг 1:** Подготовить репозиторий с активными этапами  
**Тестовые данные:** project=scvp, repo=active_repo  
**Ожидаемый результат:** Репозиторий подготовлен  

**Шаг 2:** Заполнить поле project_name значением проекта  
**Тестовые данные:** scvp  
**Ожидаемый результат:** Значение принято  

**Шаг 3:** Заполнить поле repo_name значением репозитория  
**Тестовые данные:** active_repo  
**Ожидаемый результат:** Значение принято  

**Шаг 4:** Подставить валидный Bearer токен  
**Тестовые данные:** eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ3UlhJemQ1Zjk0dUVqaUUtZW0xVG1iNXNvU3  
**Ожидаемый результат:** Токен принят  

**Шаг 5:** Отправить GET-запрос на /repos/{project_name}/{repo_name}/milestones  
**Тестовые данные:** GET /api/v3/repos/scvp/active_repo/milestones  
**Ожидаемый результат:** Запрос выполнен. Статус 200 OK, этапы со state=open  


## vcs-5-sb-003
**Id:** vcs-5-sb-003  
**Название:** GET /repos/{project_name}/{repo_name}/milestones — State #3 — Все этапы закрыты  
**Приоритет:** minor  
**Уровень теста:** api  
**Теги:** api, milestones, state_based  
**Шаги:**  
**Шаг 1:** Закрыть все этапы в репозитории  
**Тестовые данные:** project=scvp, repo=was_active_repo, state=closed  
**Ожидаемый результат:** Все этапы закрыты  

**Шаг 2:** Заполнить поле project_name значением проекта  
**Тестовые данные:** scvp  
**Ожидаемый результат:** Значение принято  

**Шаг 3:** Заполнить поле repo_name значением репозитория  
**Тестовые данные:** was_active_repo  
**Ожидаемый результат:** Значение принято  

**Шаг 4:** Подставить валидный Bearer токен  
**Тестовые данные:** eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ3UlhJemQ1Zjk0dUVqaUUtZW0xVG1iNXNvU3  
**Ожидаемый результат:** Токен принят  

**Шаг 5:** Отправить GET-запрос на /repos/{project_name}/{repo_name}/milestones  
**Тестовые данные:** GET /api/v3/repos/scvp/was_active_repo/milestones  
**Ожидаемый результат:** Запрос выполнен. Статус 200 OK, этапы со state=closed  


## vcs-5-sb-004
**Id:** vcs-5-sb-004  
**Название:** GET /repos/{project_name}/{repo_name}/milestones — State #4 — Репозиторий после удаления  
**Приоритет:** minor  
**Уровень теста:** api  
**Теги:** api, milestones, state_based  
**Шаги:**  
**Шаг 1:** Удалить существующий репозиторий  
**Тестовые данные:** project=scvp, repo=deleted_repo  
**Ожидаемый результат:** Репозиторий удалён  

**Шаг 2:** Заполнить поле project_name значением проекта  
**Тестовые данные:** scvp  
**Ожидаемый результат:** Значение принято  

**Шаг 3:** Заполнить поле repo_name значением удалённого репозитория  
**Тестовые данные:** deleted_repo  
**Ожидаемый результат:** Значение принято  

**Шаг 4:** Подставить валидный Bearer токен  
**Тестовые данные:** eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ3UlhJemQ1Zjk0dUVqaUUtZW0xVG1iNXNvU3  
**Ожидаемый результат:** Токен принят  

**Шаг 5:** Отправить GET-запрос на /repos/{project_name}/{repo_name}/milestones  
**Тестовые данные:** GET /api/v3/repos/scvp/deleted_repo/milestones  
**Ожидаемый результат:** Запрос выполнен. Статус 404 Not Found  


## vcs-5-sb-005
**Id:** vcs-5-sb-005  
**Название:** GET /repos/{project_name}/{repo_name}/milestones — State #5 — Изменение прав пользователя  
**Приоритет:** minor  
**Уровень теста:** api  
**Теги:** api, milestones, state_based, auth  
**Шаги:**  
**Шаг 1:** Изменить права пользователя с read на none для репозитория  
**Тестовые данные:** user=test_user, repo=repo_1, new_privilege=none  
**Ожидаемый результат:** Права изменены  

**Шаг 2:** Заполнить поле project_name значением проекта  
**Тестовые данные:** scvp  
**Ожидаемый результат:** Значение принято  

**Шаг 3:** Заполнить поле repo_name значением репозитория  
**Тестовые данные:** repo_1  
**Ожидаемый результат:** Значение принято  

**Шаг 4:** Подставить Bearer токен пользователя с изменёнными правами  
**Тестовые данные:** eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ3UlhJemQ1Zjk0dUVqaUUtZW0xVG1iNXNvU3  
**Ожидаемый результат:** Токен принят  

**Шаг 5:** Отправить GET-запрос на /repos/{project_name}/{repo_name}/milestones  
**Тестовые данные:** GET /api/v3/repos/scvp/repo_1/milestones  
**Ожидаемый результат:** Запрос выполнен. Статус 403 Forbidden  