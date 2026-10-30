#!/usr/bin/env bash
# Deploy the independent host. Keep the legacy release and timer configuration intact.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -n "$(git status --porcelain)" ]]; then
  echo 'Commit and push changes before deploying.' >&2
  exit 1
fi
commit=$(git rev-parse HEAD)
if [[ "$commit" != "$(git rev-parse '@{upstream}')" ]]; then
  echo 'Push the current commit before deploying.' >&2
  exit 1
fi
npm run build
uv run python -m unittest discover -s tests -p 'test_*.py'
npm test
printf '%s\n' "$commit" > dist/version.txt
asset=$(basename "$(rg --files dist/assets -g 'index-*.js')")
release="/var/www/enarm-contraste/releases/${commit:0:12}-$(date -u +%Y%m%dT%H%M%S)-standalone"
api_release="${release%-standalone}-api"
config_upload="/tmp/enarm-nginx-${commit:0:12}.conf"
unit_upload="/tmp/enarm-units-$(basename "$release")"
ssh -o BatchMode=yes my-vps bash -s -- "$release" "$api_release" "$unit_upload" <<'PREPARE'
set -euo pipefail
sudo -n install -d -m 755 -o "$(id -un)" -g "$(id -gn)" \
  /var/www/enarm-contraste /var/www/enarm-contraste/releases "$1" "$2" "$3"
PREPARE
rsync -az --chmod=D755,F644 dist/ "my-vps:$release/"
rsync -az --chmod=D755,F644 dist-server/ "my-vps:$api_release/"
rsync -az deploy/enarm-progress.service deploy/enarm-progress-backup.service deploy/enarm-progress-backup.timer "my-vps:$unit_upload/"
rsync -az deploy/nginx-enarm.musel.dev.conf "my-vps:$config_upload"
bash scripts/setup-domain.sh

ssh -o BatchMode=yes my-vps bash -s -- "$release" "$commit" "$asset" "$config_upload" "$api_release" "$unit_upload" <<'REMOTE'
set -euo pipefail
release=$1
commit=$2
asset=$3
config_upload=$4
api_release=$5
unit_upload=$6
current=/var/www/enarm-contraste/site-current
api_current=/var/www/enarm-contraste/api-current
config=/etc/nginx/sites-available/enarm.musel.dev
backup="${config}.backup-$(date -u +%Y%m%dT%H%M%S)"
if [[ -e "$current" && ! -L "$current" ]]; then
  echo 'Refusing to replace a current path that is not a symbolic link.' >&2
  exit 1
fi
if [[ -e "$api_current" && ! -L "$api_current" ]]; then
  echo 'Refusing to replace an API path that is not a symbolic link.' >&2
  exit 1
fi
previous=$(readlink "$current" || true)
previous_api=$(readlink "$api_current" || true)
if [[ -z "$previous_api" ]] && ss -ltnH | grep -F ':4187 ' > /dev/null; then
  echo 'Port4187 belongs to an existing service. Refusing to replace it.' >&2
  exit 1
fi
for unit in enarm-progress.service enarm-progress-backup.service enarm-progress-backup.timer; do
  if sudo -n systemctl is-enabled --quiet "$unit"; then touch "$unit_upload/$unit.was-enabled"; fi
  if sudo -n systemctl is-active --quiet "$unit"; then touch "$unit_upload/$unit.was-active"; fi
  if [[ -e "/etc/systemd/system/$unit" ]]; then
    if ! grep -F '# ENARM Contraste progress' "/etc/systemd/system/$unit" > /dev/null; then
      echo 'Existing service unit belongs to another application.' >&2
      exit 1
    fi
    sudo -n cp -p "/etc/systemd/system/$unit" "$unit_upload/$unit.previous"
  fi
done
sudo -n cp -p "$config" "$backup"
rollback() {
  result=$?
  trap - ERR
  echo 'Check failed; restoring the independent host and release.' >&2
  if [[ -n "$previous" ]]; then
    ln -sfn "$previous" "${current}.rollback"
    mv -Tf "${current}.rollback" "$current"
  else
    rm -f "$current"
  fi
  sudo -n cp -p "$backup" "$config"
  sudo -n systemctl disable --now enarm-progress.service enarm-progress-backup.timer || true
  sudo -n systemctl stop enarm-progress-backup.service || true
  if [[ -n "$previous_api" ]]; then
    ln -sfn "$previous_api" "${api_current}.rollback"
    mv -Tf "${api_current}.rollback" "$api_current"
  elif [[ -L "$api_current" ]]; then
    unlink "$api_current"
  fi
  for unit in enarm-progress.service enarm-progress-backup.service enarm-progress-backup.timer; do
    if [[ -e "$unit_upload/$unit.previous" ]]; then
      sudo -n install -m 644 "$unit_upload/$unit.previous" "/etc/systemd/system/$unit"
    elif [[ -f "/etc/systemd/system/$unit" ]]; then
      sudo -n unlink "/etc/systemd/system/$unit"
    fi
  done
  sudo -n systemctl daemon-reload
  for unit in enarm-progress.service enarm-progress-backup.service enarm-progress-backup.timer; do
    if [[ -e "$unit_upload/$unit.was-enabled" ]]; then sudo -n systemctl enable "$unit"; fi
    if [[ -e "$unit_upload/$unit.was-active" ]]; then sudo -n systemctl start "$unit"; fi
  done
  sudo -n nginx -t && sudo -n systemctl reload nginx
  exit "$result"
}
trap rollback ERR
if ! id enarm-progress > /dev/null 2>&1; then sudo -n useradd --system --user-group --home-dir /var/lib/enarm-contraste --shell /usr/sbin/nologin enarm-progress; fi
sudo -n install -d -m 700 -o enarm-progress -g enarm-progress /var/lib/enarm-contraste
sudo -n -u enarm-progress env ENARM_DATABASE=/var/lib/enarm-contraste/progress.sqlite /usr/bin/node "$api_release/server.mjs" --backup
for unit in enarm-progress.service enarm-progress-backup.service enarm-progress-backup.timer; do sudo -n install -m 644 "$unit_upload/$unit" "/etc/systemd/system/$unit"; done
sudo -n systemd-analyze verify /etc/systemd/system/enarm-progress.service /etc/systemd/system/enarm-progress-backup.service /etc/systemd/system/enarm-progress-backup.timer
ln -sfn "$api_release" "${api_current}.next"
mv -Tf "${api_current}.next" "$api_current"
sudo -n systemctl daemon-reload
sudo -n systemctl enable enarm-progress.service enarm-progress-backup.timer
sudo -n systemctl restart enarm-progress.service
curl -fsS --retry 10 --retry-all-errors --retry-delay 1 --max-time 5 http://127.0.0.1:4187/api/health | grep -F '"ok":true' > /dev/null
sudo -n systemctl start enarm-progress-backup.timer enarm-progress-backup.service
sudo -n install -m 644 "$config_upload" "$config"
ln -sfn "$release" "${current}.next"
mv -Tf "${current}.next" "$current"
sudo -n nginx -t
sudo -n systemctl reload nginx
curl -fsS --resolve enarm.musel.dev:443:127.0.0.1 \
  --retry 5 --retry-all-errors --retry-delay 1 --max-time 10 \
  https://enarm.musel.dev/version.txt | grep -Fx "$commit" > /dev/null
curl -fsS --retry 5 --retry-all-errors --retry-delay 1 --max-time 10 \
  https://enarm.musel.dev/version.txt | grep -Fx "$commit" > /dev/null
curl -fsS --max-time 15 https://enarm.musel.dev/ | grep -F '<title>ENARM Contraste' > /dev/null
curl -fsS --max-time 15 https://enarm.musel.dev/api/health | grep -F '"ok":true' > /dev/null
curl -fsS --max-time 15 "https://enarm.musel.dev/assets/$asset" > /dev/null
curl -fsS --max-time 15 https://enarm.musel.dev/study/manifest.json | grep -F '"cross-reviewed"' > /dev/null
curl -fsS --max-time 30 https://enarm.musel.dev/study/enarm-eje.apkg > /dev/null
curl -fsS --max-time 30 https://enarm.musel.dev/study/enarm-madre.apkg > /dev/null
curl -fsS --max-time 15 https://timer.musel.dev/grind/enarm/ | grep -F '<title>ENARM Contraste' > /dev/null
curl -fsS --max-time 15 https://timer.musel.dev/api/health | grep -F '"ok":true' > /dev/null
trap - ERR
rm -f "$config_upload"
echo "Published $release"
echo "Nginx backup: $backup"
REMOTE
echo 'https://enarm.musel.dev/'
