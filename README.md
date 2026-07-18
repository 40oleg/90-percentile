# 90 Percentile

Пиксельный трекер физических испытаний. Выполни все челленджи, чтобы стать сильнее и спортивнее 90% людей на планете.

PWA на Angular — устанавливается на телефон прямо из браузера. Прогресс хранится локально в устройстве.

## Разработка

```bash
npm install
npm start        # http://localhost:4200
npm run build     # production-сборка в dist/90-percentile
```

## Деплой

При каждом push в `main` GitHub Actions собирает приложение и публикует его на GitHub Pages
(`.github/workflows/deploy.yml`). В настройках репозитория: **Settings → Pages → Build and
deployment → Source: GitHub Actions**.
