# FE · MFE (Rsbuild + Module Federation)

Новый FE поставляется как **микрофронтенд (MFE)** и встраивается в платформенный хост. Сборка — **Rsbuild**, федерация — **Module Federation** (`@module-federation/rsbuild-plugin`). Конфиг — `rsbuild.config.ts`.

## Конфигурация (факты из `rsbuild.config.ts`)

```ts
pluginModuleFederation({
  name: 'sourcecontrol',
  manifest: true,
  dts: true,
  shared: { react: { singleton: true, requiredVersion: '^18' },
            'react-dom': { singleton: true, requiredVersion: '^18' } },
  exposes: { './export-app': './web_src/spa/app/export-app.tsx' },
})
```

- **Имя remote**: `sourcecontrol`.
- **Экспонируется**: `./export-app` → точка входа `web_src/spa/app/export-app.tsx` (её монтирует хост).
- **shared**: `react`/`react-dom` — singleton `^18` (хост и MFE используют один экземпляр React).
- `manifest: true` + `dts: true` — манифест федерации и типы для потребителей.

## Команды

```bash
npm run mfe:dev       # rsbuild dev — локальная разработка MFE
npm run mfe:build     # rsbuild build — сборка remote
npm run mfe:preview   # rsbuild preview
```

## Интеграция

- В хост встраивается через `@module-federation/bridge-react` (мост React-MFE ↔ хост).
- Используются платформенные MFE: `@onework/mfe-framework`, `@sbt-works/side-menu-mfe` (боковое меню) — потребляются как remotes.
- Точка входа `export-app.tsx` должна принимать контекст от хоста (props/роутинг) и не зависеть от конкретного хоста.

## Правила

- Не ломать `exposes`-контракт (`./export-app`) без согласования с платформой.
- `react`/`react-dom` держать singleton `^18` — рассинхрон версий с хостом ломает рантайм.
- Бизнес-логику не привязывать к конкретному хосту; зависимость от хоста — только через переданные props/контекст.

Связано: [[role]], [[architecture]]. Бизнес-смысл MFE-миграции — в proposal фичи (web2/ПАО).
