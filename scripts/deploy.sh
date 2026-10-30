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
config_upload="/tmp/enarm-nginx-${commit:0:12}.conf"
ssh -o BatchMode=yes my-vps bash -s -- "$release" <<'PREPARE'
set -euo pipefail
sudo -n install -d -m 755 -o "$(id -un)" -g "$(id -gn)" \
  /var/www/enarm-contraste /var/www/enarm-contraste/releases "$1"
PREPARE
rsync -az --chmod=D755,F644 dist/ "my-vps:$release/"
rsync -az deploy/nginx-enarm.musel.dev.conf "my-vps:$config_upload"
bash scripts/setup-domain.sh

ssh -o BatchMode=yes my-vps bash -s -- "$release" "$commit" "$asset" "$config_upload" <<'REMOTE'
set -euo pipefail
release=$1
commit=$2
asset=$3
config_upload=$4
current=/var/www/enarm-contraste/site-current
config=/etc/nginx/sites-available/enarm.musel.dev
backup="${config}.backup-$(date -u +%Y%m%dT%H%M%S)"
if [[ -e "$current" && ! -L "$current" ]]; then
  echo 'Refusing to replace a current path that is not a symbolic link.' >&2
  exit 1
fi
previous=$(readlink "$current" || true)
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
  sudo -n nginx -t && sudo -n systemctl reload nginx
  exit "$result"
}
trap rollback ERR
sudo -n install -m 644 "$config_upload" "$config"
ln -sfn "$release" "${current}.next"
mv -Tf "${current}.next" "$current"
sudo -n nginx -t
sudo -n systemctl reload nginx
curl -fsS --resolve enarm.musel.dev:443:127.0.0.1 \
  --retry 5 --retry-all-errors --retry-delay 1 --max-time 10 \
  https://enarm.musel.dev/version.txt | grep -Fxq "$commit"
curl -fsS --retry 5 --retry-all-errors --retry-delay 1 --max-time 10 \
  https://enarm.musel.dev/version.txt | grep -Fxq "$commit"
curl -fsS --max-time 15 https://enarm.musel.dev/ | grep -Fq '<title>ENARM Contraste'
curl -fsS --max-time 15 "https://enarm.musel.dev/assets/$asset" > /dev/null
curl -fsS --max-time 15 https://enarm.musel.dev/study/manifest.json | grep -Fq '"cross-reviewed"'
curl -fsS --max-time 30 https://enarm.musel.dev/study/enarm-eje.apkg > /dev/null
curl -fsS --max-time 30 https://enarm.musel.dev/study/enarm-madre.apkg > /dev/null
curl -fsS --max-time 15 https://timer.musel.dev/grind/enarm/ | grep -Fq '<title>ENARM Contraste'
curl -fsS --max-time 15 https://timer.musel.dev/api/health | grep -Fq '"ok":true'
trap - ERR
rm -f "$config_upload"
echo "Published $release"
echo "Nginx backup: $backup"
REMOTE
echo 'https://enarm.musel.dev/'
