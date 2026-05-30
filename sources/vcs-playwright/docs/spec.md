# Единая точка правды спецификации OpenAPI

## Структура папки `spec`

Папка `spec` содержит файлы, полученные из репозитория SourceControl, доступного по адресу:

```bash
ssh://git@portal.works.prod.sbt:7998/vcs/vcs-api.git
```

### Как было выполнено подключение?

Подключение осуществлялось следующей последовательностью команд:

```bash
git submodule add ssh://git@portal.works.prod.sbt:7998/vcs/vcs-api.git spec
cd spec
git checkout develop
git sparse-checkout init --no-cone
git sparse-checkout set api/openapi/*
```

Последовательность действий следующая:

1. Добавление репозитория в качестве подмодуля (`submodule add`).
2. Переключение на ветку `develop` (`checkout develop`).
3. Настройка режима выборочной загрузки файлов (`sparse-checkout`):
   - Инициализация выборочной выгрузки (`init --no-cone`).
   - Установка правил выборочной выгрузки, согласно которым будут извлечены только файлы из каталога `api/openapi/*`.

## Генерация zod-схем

Используется `@hey-api/openapi-ts`.

В файле `openapi-ts.config.ts` описан маппинг входных спецификаций OpenAPI и выходных `zod.gen.ts`.

Для запуска процесса генерации с предварительной очисткой сгенерированных ранее файлов необходимо выполнить команду:

```bash
npm run generate:zod
```

Сгенерированные схемы будут расположены в директории: `./src/api/generated/types/`.

## Обновление сабмодуля

```bash
git submodule sync
git submodule update --remote
```

## Зависимости

- [hey-api](https://heyapi.dev/openapi-ts/get-started)
- [zod](https://github.com/colinhacks/zod)
