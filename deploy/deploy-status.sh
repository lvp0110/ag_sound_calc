#!/usr/bin/env bash
# Состояние прод-стека: контейнеры + здоровье приложения через gateway-01.
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

info "docker compose ps:"
compose "ps"

info "версии образов:"
compose "images"

if [ -n "$DEPLOY_DOMAIN" ]; then
  info "строгая проверка health https://$DEPLOY_DOMAIN/health"
  curl -fsS \
    --retry 5 \
    --retry-delay 3 \
    --retry-all-errors \
    -w "  HTTP %{http_code}\n" \
    "https://$DEPLOY_DOMAIN/health"
fi
