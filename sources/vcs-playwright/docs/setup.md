# Настройка окружения

Инструкция по настройке локального окружения для запуска и разработки тестов на базе **TypeScript** и **Playwright** с использованием **Node.js 23**.
Убедитесь, что в VSCode включен auto save файлов. :-) (Если используете его.)

## 0. Превентивная мера для решения проблем с сертификатами

Можно выбрать один из вариантов:

1. Прописать в `~/.bashrc`: `export NODE_TLS_REJECT_UNAUTHORIZED=0`.
2. Перед каждой командой (npm, npx) указывать: `NODE_TLS_REJECT_UNAUTHORIZED=0 {command}`.
3. Непосредственно в терминале выполнить до следующей команды: `export NODE_TLS_REJECT_UNAUTHORIZED=0`.

## 1. Установка Node.js 23+

Проект требует **Node.js версии 23+** (рекомендуется LTS). Ниже описаны способы установки.

### Вариант A: Установка через `nvm` (рекомендуется для macOS и Linux)

1. Установите `nvm`, если он ещё не установлен:

   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
   ```

   После установки перезапустите терминал или выполните:

   ```bash
   source ~/.bashrc
   # или source ~/.zshrc, если используете zsh
   ```

1. Установите Node.js 24:

   ```bash
   nvm install 24
   ```

1. Активируйте версию:

   ```bash
   nvm use 24
   ```

1. (Опционально) Сделайте Node.js 24 версией по умолчанию:

   ```bash
   nvm alias default 24
   ```

### Вариант B: Установка через nvm-windows (для Windows)

1. Скачайте и установите nvm-windows.
1. Запустите командную строку от имени администратора.
1. Установите Node.js 24:

   ```cmd
   nvm install 24.0.0
   nvm use 24.0.0
   ```

### Вариант C: Установка пакета на Linux Debian (АРМ)

```bash
   sudo apt get nodejs
```

Установится версия NodeJS 23.

⚠️ Убедитесь, что не установлено несколько версий Node.js — это может вызвать конфликты.

## 2. Проверка версии Node.js и npm

```bash
node --version
# Ожидаемый вывод: v24.x.x или v23.x.x

npm --version
# Ожидаемый вывод: 10.x.x или выше
```

## 3. Настройка .npmrc

Для корректной загрузки библиотек на доменных АРМ/ВАРМ необходимо [сконфигурировать npm](./npm.md).

## 4. Установка зависимостей проекта

### Установка зависимостей

```bash
npm ci
```

### Установка браузеров

```bash
PLAYWRIGHT_BROWSERS_PATH='/home/{LOGIN}@sbertech.ru/Development/playwright/browsers' PLAYWRIGHT_DOWNLOAD_HOST=https://token:{OSC_TOKEN}@sberworks.ru/osc/repo/playwright/dbazure/download/playwright npx playwright install
```

Путь PLAYWRIGHT_BROWSERS_PATH можно задать любым для удобства.
