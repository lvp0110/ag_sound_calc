# Makefile для локальной разработки ag_sound_calc.
#
# Быстрый старт с нуля:
#   make setup    — поставить зависимости, создать .env, поднять БД, прогнать миграции
#   make dev      — запустить postgres + backend + frontend (Ctrl-C остановит всё)
#
# Сервисы после `make dev`:
#   postgres       → localhost:5433 (контейнер ag_sound_calc_postgres)
#   backend API    → http://localhost:3006  (Swagger: /api/docs)
#   frontend       → http://localhost:5173
#   Adminer (SQL)  → http://localhost:8080
#   Prisma Studio  → http://localhost:5555  (после `make db-ui`)

SHELL := /bin/bash
BACKEND_DIR := backend
FRONTEND_DIR := frontend

.PHONY: help setup install reinstall env db-up db-down db-migrate db-reset db-ui \
        backend frontend dev stop build clean status \
        deploy-bootstrap deploy-backend deploy-frontend deploy-migrate \
        deploy-nginx-sync deploy-nginx-reload deploy-status

.DEFAULT_GOAL := help

help: ## Показать список команд
	@echo "Команды:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

# ─── one-shot setup ─────────────────────────────────────────────────────────

setup: install env db-up db-migrate ## Первая инициализация: deps + .env + БД + миграции
	@echo ""
	@echo "✓ Готово. Запустите:  make dev"

# ─── deps ───────────────────────────────────────────────────────────────────

install: ## Установить зависимости (backend + frontend)
	@echo "→ backend deps"
	cd $(BACKEND_DIR) && npm install
	@echo "→ frontend deps"
	cd $(FRONTEND_DIR) && npm install

reinstall: ## Чистая переустановка зависимостей (на случай сбоев npm / ENOTEMPTY)
	@echo "→ удаляю node_modules и package-lock.json"
	rm -rf $(BACKEND_DIR)/node_modules $(BACKEND_DIR)/package-lock.json \
	       $(FRONTEND_DIR)/node_modules $(FRONTEND_DIR)/package-lock.json
	@$(MAKE) --no-print-directory install

env: ## Создать backend/.env из .env.example, если отсутствует
	@if [ ! -f $(BACKEND_DIR)/.env ]; then \
	  echo "→ создаю $(BACKEND_DIR)/.env"; \
	  cp $(BACKEND_DIR)/.env.example $(BACKEND_DIR)/.env; \
	else \
	  echo "✓ $(BACKEND_DIR)/.env уже есть — не перезаписываю"; \
	fi

# ─── database ───────────────────────────────────────────────────────────────

db-up: ## Поднять postgres + adminer в docker и дождаться healthcheck
	@docker info >/dev/null 2>&1 || { echo "✗ Docker не запущен. Запустите Docker Desktop."; exit 1; }
	docker compose up -d postgres adminer
	@echo "→ жду healthcheck postgres..."
	@for i in $$(seq 1 30); do \
	  status=$$(docker inspect -f '{{.State.Health.Status}}' ag_sound_calc_postgres 2>/dev/null); \
	  if [ "$$status" = "healthy" ]; then echo "✓ postgres healthy ($$i s)"; exit 0; fi; \
	  sleep 1; \
	done; \
	echo "✗ postgres не стал healthy за 30 s"; exit 1

db-down: ## Остановить контейнеры docker compose
	docker compose down

db-migrate: ## Применить миграции prisma к локальной БД
	cd $(BACKEND_DIR) && npx prisma migrate deploy

db-reset: ## ⚠️  Полностью пересоздать БД и применить миграции (ВСЕ ДАННЫЕ БУДУТ СТЁРТЫ)
	cd $(BACKEND_DIR) && npx prisma migrate reset --force --skip-seed

db-ui: ## Prisma Studio на http://localhost:5555
	cd $(BACKEND_DIR) && npm run db:ui

# ─── dev runners ────────────────────────────────────────────────────────────

backend: ## Запустить backend (tsx watch) на :3006
	cd $(BACKEND_DIR) && npm run dev

frontend: ## Запустить frontend (vite) на :5173
	cd $(FRONTEND_DIR) && npm run dev

dev: ## Запустить postgres + миграции + backend + frontend (Ctrl-C остановит всё)
	@$(MAKE) --no-print-directory db-up
	@$(MAKE) --no-print-directory db-migrate
	@echo ""
	@echo "→ backend: http://localhost:3006  |  frontend: http://localhost:5173"
	@echo "→ Ctrl-C остановит backend и frontend (postgres продолжит работать)"
	@echo ""
	@trap 'echo ""; echo "→ останавливаю dev-процессы"; kill 0' INT TERM; \
	 ( cd $(BACKEND_DIR) && npm run dev ) & \
	 ( cd $(FRONTEND_DIR) && npm run dev ) & \
	 wait

stop: ## Убить зависшие backend/frontend процессы (на случай отваливших Ctrl-C)
	@pkill -f "tsx watch src/index.ts" 2>/dev/null || true
	@pkill -f "vite" 2>/dev/null || true
	@echo "✓ backend и frontend остановлены"

# ─── builds ─────────────────────────────────────────────────────────────────

build: ## Production-сборка backend (tsc) + frontend (vite)
	cd $(BACKEND_DIR) && npm run build
	cd $(FRONTEND_DIR) && npm run build

# ─── housekeeping ───────────────────────────────────────────────────────────

clean: ## Удалить node_modules и dist
	rm -rf $(BACKEND_DIR)/node_modules $(BACKEND_DIR)/dist \
	       $(FRONTEND_DIR)/node_modules $(FRONTEND_DIR)/dist

status: ## Проверить, что где крутится
	@echo "— docker:"
	@docker ps --filter "name=ag_sound_calc" --format "  {{.Names}}  {{.Status}}  {{.Ports}}" || true
	@echo "— listen ports:"
	@for port in 3006 5173 5433 5555 8080; do \
	  if lsof -iTCP:$$port -sTCP:LISTEN -n -P 2>/dev/null | tail -n +2 | head -1 >/dev/null; then \
	    echo "  :$$port — busy"; \
	  else \
	    echo "  :$$port — free"; \
	  fi; \
	done

# ─── prod deploy (SSH + Makefile) ───────────────────────────────────────────
# Требуется deploy/.env.deploy (копия из deploy/.env.deploy.example).

deploy-bootstrap: ## Первый запуск на чистом сервере (клонирует репо, проверяет nginx+.env.prod, поднимает все сервисы, мигрирует)
	bash deploy/bootstrap.sh

deploy-backend: ## Роллаут backend на прод (БД/frontend не трогает). REV=<commit> для точечной ревизии
	bash deploy/deploy-backend.sh

deploy-frontend: ## Локальный vite build + rsync dist на прод. REBUILD=1 если менялся server.js/Dockerfile
	bash deploy/deploy-frontend.sh

deploy-migrate: ## Применить prisma migrate deploy на проде (отдельный run --rm, не трогает работающий backend)
	bash deploy/deploy-migrate.sh

deploy-nginx-sync: ## Залить nginx server block из deploy/nginx/ на сервер и валидировать nginx -t
	bash deploy/deploy-nginx-sync.sh

deploy-nginx-reload: ## nginx -t && systemctl reload nginx на сервере
	bash deploy/deploy-nginx-reload.sh

deploy-status: ## Состояние прод-стека (compose ps + curl /health)
	bash deploy/deploy-status.sh
