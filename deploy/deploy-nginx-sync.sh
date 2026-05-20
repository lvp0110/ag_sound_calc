#!/usr/bin/env bash
# Синхронизировать nginx server block с шаблоном из репо.
#
# Что делает:
#   1) подставляет $DEPLOY_DOMAIN на место <domain> в deploy/nginx/ag_sound_calc.conf
#   2) rsync результата в staging-путь на сервере ($DEPLOY_DIR/deploy/nginx/)
#   3) sudo cp staging → /etc/nginx/sites-available/ag_sound_calc.conf
#   4) sudo ln -sf в sites-enabled (idempotent — повтор ок)
#   5) sudo nginx -t (валидация)
#
# Reload вызывается ОТДЕЛЬНО — deploy-nginx-reload.sh. Это разделение даёт
# возможность сначала прогнать nginx -t, увидеть ошибку и НЕ применять reload.
#
# Требования на сервере: deploy-юзер должен иметь NOPASSWD-sudo на:
#   /usr/bin/cp, /usr/bin/ln, /usr/sbin/nginx, /usr/bin/systemctl reload nginx
# (последние два уже нужны для deploy-nginx-reload.sh).
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

: "${DEPLOY_DOMAIN:?DEPLOY_DOMAIN не задан в deploy/.env.deploy (нужен для подстановки <domain> в nginx-конфиг)}"

LOCAL_TEMPLATE="$REPO_ROOT/deploy/nginx/ag_sound_calc.conf"
LOCAL_RENDERED="$(mktemp -t ag_sound_calc.nginx.XXXXXX.conf)"
REMOTE_STAGE_DIR="$DEPLOY_DIR/deploy/nginx"
REMOTE_STAGE_FILE="$REMOTE_STAGE_DIR/ag_sound_calc.rendered.conf"
SYSTEM_CONF="/etc/nginx/sites-available/ag_sound_calc.conf"
SYSTEM_LINK="/etc/nginx/sites-enabled/ag_sound_calc.conf"

trap 'rm -f "$LOCAL_RENDERED"' EXIT

info "рендерю шаблон с DEPLOY_DOMAIN=$DEPLOY_DOMAIN"
sed "s|<domain>|$DEPLOY_DOMAIN|g" "$LOCAL_TEMPLATE" > "$LOCAL_RENDERED"

# Сабстрочный sanity-check: в результате не осталось плейсхолдеров.
if grep -q '<domain>' "$LOCAL_RENDERED"; then
  fail "после подстановки в шаблоне всё ещё остался <domain> — sed промахнулся"
fi

info "rsync $LOCAL_RENDERED → $DEPLOY_HOST:$REMOTE_STAGE_FILE"
ssh_exec "mkdir -p '$REMOTE_STAGE_DIR'"
rsync -az -e "ssh ${SSH_OPTS[*]}" "$LOCAL_RENDERED" "$DEPLOY_HOST:$REMOTE_STAGE_FILE"

info "копирую staging → $SYSTEM_CONF и валидирую nginx -t"
ssh_exec "sudo cp '$REMOTE_STAGE_FILE' '$SYSTEM_CONF' && \
  sudo ln -sf '$SYSTEM_CONF' '$SYSTEM_LINK' && \
  sudo nginx -t"

ok "nginx config обновлён и валиден; reload — отдельным шагом (deploy-nginx-reload.sh)"
