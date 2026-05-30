# Настройка Playwright в VSCode

Этот документ описывает процесс настройки расширения Playwright в VSCode для корректной работы с тестами (успешное нахождение тестов в проекте и т. д.).

## Переменные окружения

Для корректной работы расширения Playwright необходимо настроить следующие переменные окружения:

### Основные переменные окружения

1. **VCS_CONFIG** - путь к конфигурационным файлам. Например:

   ```bash
   VCS_CONFIG=config/common.yaml,config/ow.yaml,config/sc-vp.yaml
   ```

2. **PLAYWRIGHT_BROWSERS_PATH** - путь к установленным браузерам Playwright. Актуально, если был переопределена директория для загрузки браузеров, к примеру:

   ```bash
   PLAYWRIGHT_BROWSERS_PATH=/home/lokkina.o.s@sbertech.ru/Development/playwright/browsers
   ```

## Настройка VSCode

### Файл .vscode/settings.json

В файле `.vscode/settings.json` должны быть указаны переменные окружения:

```json
{
  "playwright.env": {
    "VCS_CONFIG": "config/common.yaml,config/ow.yaml,config/sc-vp.yaml",
    "PLAYWRIGHT_BROWSERS_PATH": "/home/lokkina.o.s@sbertech.ru/Development/playwright/browsers"
  }
}
```
