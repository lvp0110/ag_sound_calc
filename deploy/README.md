# Production deploy: `partners.constrtodo.ru`

Приложение работает на приватной машине `prodfront.mcs.local`. TLS и весь
публичный входящий трафик обслуживает отдельный `gateway-01`; системный Nginx
на `prodfront` не нужен.

## Схема трафика

```text
Internet :443
    │
    ▼
gateway-01 / Nginx / wildcard TLS
    │  proxy_pass http://prodfront.mcs.local:3004
    ▼
prodfront private IP :3004 / frontend container
    ├── static React application
    └── /api, /health, /uploads, /commerce → backend:3006
                                                   │
                                                   ├── postgres:5432
                                                   └── ConstrTodo internal DNS:3005
```

На `prodfront` публикуется только frontend-порт `3004`, причём только на
приватном IP. Backend и PostgreSQL доступны исключительно внутри Docker-сети.
Firewall должен разрешать TCP/3004 только с приватного адреса `gateway-01`.

## 1. Подготовка `prodfront`

Установите Docker Engine, Compose plugin и Git. Пользователь деплоя должен
иметь доступ к Docker и право создавать `$DEPLOY_DIR`. Nginx, Certbot и TLS-
сертификаты на этой машине не требуются.

Пример firewall (подставьте реальные адреса):

```bash
sudo ufw allow from 10.20.0.10 to 10.20.0.40 port 3004 proto tcp
sudo ufw enable
```

Публично открывать `3004`, `3006` и `5432` нельзя.

## 2. Настройка production environment

После появления checkout на `prodfront` создайте `.env.prod`:

```bash
cd /srv/ag_sound_calc/ag_sound_calc
cp deploy/.env.prod.example .env.prod
chmod 600 .env.prod
```

Если запустить `make deploy-bootstrap` до создания файла, скрипт сам положит
шаблон в `$DEPLOY_DIR/.env.prod`, остановится и попросит заполнить его. После
заполнения просто запустите команду повторно.

Обязательно замените значения:

- `FRONTEND_BIND_IP` — приватный IP `prodfront`, например `10.20.0.40`;
- `FRONTEND_TRUST_PROXY` — приватный IP/CIDR `gateway-01`, например
  `10.20.0.10/32`;
- `CORS_ORIGIN=https://partners.constrtodo.ru`;
- `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`;
- `CALC_SERVICE_URL` и `AUTH_SERVICE_URL` — внутренний URL ConstrTodo,
  например `http://constrtodo.mcs.local:3005`;

Имя `constrtodo.mcs.local` должно разрешаться именно из backend-контейнера.
Проверьте это после запуска:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml \
  exec backend getent hosts constrtodo.mcs.local
```

## 3. Доступ через SSH jump host

На машине оператора:

```bash
cp deploy/.env.deploy.example deploy/.env.deploy
```

Основные значения:

```dotenv
DEPLOY_HOST=deploy@prodfront.mcs.local
DEPLOY_JUMP_HOST=antares@<public-address-of-gateway-01>
DEPLOY_DIR=/srv/ag_sound_calc/ag_sound_calc
DEPLOY_DOMAIN=partners.constrtodo.ru
```

`DEPLOY_JUMP_HOST` используется как `ssh -J`. Если команда запускается из
приватной сети и `prodfront.mcs.local` доступен напрямую, значение можно
оставить пустым. SSH forwarding настраивается в `sshd` и firewall gateway,
а не в HTTP-конфигурации Nginx.

Проверьте подключение:

```bash
ssh -J antares@<gateway-public-host> deploy@prodfront.mcs.local
```

## 4. Первый запуск

```bash
make deploy-bootstrap
make deploy-frontend
make deploy-status
```

`deploy-bootstrap` клонирует репозиторий, проверяет `.env.prod`, поднимает
PostgreSQL и backend, применяет миграции и запускает frontend. TLS и настройки
gateway этот проект не изменяет.

На `gatewaytodo` должен быть настроен маршрут:

```dotenv
PARTNERS_DOMAIN=partners.constrtodo.ru
PARTNERS_UPSTREAM=prodfront.mcs.local:3004
```

После изменения `.env` gateway следует пересоздать/перезапустить его средствами
проекта `gatewaytodo` и проверить `https://partners.constrtodo.ru/health`.

## Регулярный деплой

| Ситуация | Команда | Результат |
|---|---|---|
| Изменился backend | `make deploy-backend` | Checkout ревизии, rebuild и restart только backend |
| Изменился frontend | `make deploy-frontend` | Локальная Vite-сборка и rsync `dist` без restart контейнера |
| Изменились `server.js`, frontend Dockerfile или prod package | `REBUILD=1 make deploy-frontend` | Дополнительно rebuild/restart frontend-контейнера |
| Появилась Prisma-миграция | `make deploy-migrate` | Одноразовый `prisma migrate deploy` |
| Нужен откат backend | `REV=<commit> make deploy-backend` | Выкат указанной ревизии |
| Проверка | `make deploy-status` | Compose status и публичный `/health` через gateway |

Для additive-миграции сначала выполните `make deploy-migrate`, затем
`make deploy-backend`. Rename/drop делайте через промежуточную совместимую
версию приложения (expand/contract).

## GitHub Actions

Workflow [prod-deploy.yml](../.github/workflows/prod-deploy.yml) запускается при
push в `main` и вручную через `workflow_dispatch`. GitHub-hosted runner входит
на приватный `prodfront` через SSH jump host.

При автоматическом запуске выкатывается точный commit из `GITHUB_SHA`, а не
подвижная ссылка `origin/main`. Итоговый smoke-test `/health` является строгим:
если production не отвечает после повторных попыток, workflow завершается с
ошибкой.

Repository secrets:

| Secret | Значение |
|---|---|
| `DEPLOY_HOST` | `deploy@prodfront.mcs.local` |
| `DEPLOY_JUMP_HOST` | `antares@<public-address-of-gateway-01>` |
| `DEPLOY_DIR` | `/srv/ag_sound_calc/ag_sound_calc` |
| `DEPLOY_DOMAIN` | `partners.constrtodo.ru` |
| `DEPLOY_SSH_KEY` | Приватный ключ, авторизованный для SSH через gateway и на prodfront |
| `DEPLOY_KNOWN_HOSTS` | Host keys и gateway, и prodfront |
| `TELEGRAM_BOT_TOKEN` | Токен уведомлений |
| `TELEGRAM_CHAT_ID` | ID чата уведомлений |

`DEPLOY_KNOWN_HOSTS` должен содержать две записи. Для приватного узла ключ
удобнее получить с доверенной машины внутри сети:

```bash
ssh-keyscan -t ed25519 <gateway-public-host>
ssh-keyscan -t ed25519 prodfront.mcs.local
```

Не отключайте `StrictHostKeyChecking`. Приватный ключ должен подходить обоим
SSH-переходам либо gateway должен пропускать тот же публичный ключ, который
авторизован на `prodfront`.

На ручном запуске доступны:

- `force_migrate=auto|yes|no`;
- `rev=<branch|tag|sha>` для выкатки конкретной ревизии.

Workflow не управляет gateway, сертификатами или `.env.prod`.

## Бэкапы

Пример cron на `prodfront`:

```cron
0 3 * * * cd /srv/ag_sound_calc/ag_sound_calc && docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres pg_dump -U postgres ag_sound_calc | gzip > /var/backups/ag_sound_calc/$(date +\%F).sql.gz
```

Восстановление:

```bash
gunzip -c /var/backups/ag_sound_calc/2026-10-15.sql.gz | \
  docker compose --env-file .env.prod -f docker-compose.prod.yml \
  exec -T postgres psql -U postgres -d ag_sound_calc
```

## Диагностика

```bash
make deploy-status

ssh -J antares@<gateway-public-host> deploy@prodfront.mcs.local \
  "cd /srv/ag_sound_calc/ag_sound_calc && docker compose --env-file .env.prod -f docker-compose.prod.yml logs --tail=200 frontend backend"

curl -v https://partners.constrtodo.ru/health
```

Если публичный health не отвечает, проверяйте последовательно:

1. `curl http://<prodfront-private-ip>:3004/health` с `gateway-01`;
2. firewall между gateway и prodfront;
3. DNS-резолв `prodfront.mcs.local` на gateway;
4. логи gateway и контейнеров frontend/backend.
