#!/usr/bin/env bash
# Publish compiled assets to the existing VPS. No PDFs or local reviews are uploaded.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -n "$(git status --porcelain)" ]]; then
  echo 'Commit and push changes before deploying.' >&2
  exit 1
fi
commit=$(git rev-parse HEAD)
if [[ "$commit" != "$(git rev-parse '@{upstream}')" ]]; then
  echo 'The current commit must be pushed before deploying.' >&2
  exit 1
fi

npm test
npm run build
printf '%s\n' "$commit" > dist/version.txt
asset=$(basename "$(rg --files dist/assets -g 'index-*.js')")
release="/var/www/enarm-contraste/releases/${commit:0:12}-$(date -u +%Y%m%dT%H%M%S)"

ssh -o BatchMode=yes my-vps bash -s -- "$release" <<'PREPARE'
set -euo pipefail
sudo -n install -d -m 755 -o "$(id -un)" -g "$(id -gn)" \
  /var/www/enarm-contraste /var/www/enarm-contraste/releases "$1"
PREPARE
rsync -az --chmod=D755,F644 dist/ "my-vps:$release/"

ssh -o BatchMode=yes my-vps bash -s -- "$release" "$commit" "$asset" <<'REMOTE'
set -euo pipefail
release=$1
commit=$2
asset=$3
current=/var/www/enarm-contraste/current
config=/etc/nginx/sites-available/timer.musel.dev
backup="${config}.enarm-backup-$(date -u +%Y%m%dT%H%M%S)"
if [[ -e "$current" && ! -L "$current" ]]; then
  echo 'Refusing to replace a current path that is not a symbolic link.' >&2
  exit 1
fi
previous=$(readlink "$current" || true)
sudo -n cp -p "$config" "$backup"
rollback() {
  result=$?
  trap - ERR
  echo 'Check failed. Restoring previous release and nginx configuration.' >&2
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

if ! grep -Fq 'location ^~ /grind/enarm/' "$config"; then
  config_temp=$(mktemp)
  awk '
    /# Grind Recall static application/ && !inserted {
      print "    # ENARM Contraste static application"
      print "    location = /grind/enarm { return 301 /grind/enarm/; }"
      print "    location ^~ /grind/enarm/ {"
      print "        alias /var/www/enarm-contraste/current/;"
      print "        index index.html;"
      print "        expires -1;"
      print "    }"
      inserted=1
    }
    { print }
    END { if (!inserted) exit 2 }
  ' "$config" > "$config_temp"
  sudo -n install -m 644 "$config_temp" "$config"
  rm -f "$config_temp"
fi

ln -sfn "$release" "${current}.next"
mv -Tf "${current}.next" "$current"
sudo -n nginx -t
sudo -n systemctl reload nginx

# Check the origin and the public route. Retries account for old nginx workers.
curl -fsS --resolve timer.musel.dev:443:127.0.0.1 \
  --retry 5 --retry-all-errors --retry-delay 1 --max-time 10 \
  https://timer.musel.dev/grind/enarm/version.txt | grep -Fxq "$commit"
curl -fsS --retry 5 --retry-all-errors --retry-delay 1 --max-time 10 \
  https://timer.musel.dev/grind/enarm/version.txt | grep -Fxq "$commit"
curl -fsS https://timer.musel.dev/grind/enarm/ | grep -Fq '<title>ENARM Contraste'
curl -fsS "https://timer.musel.dev/grind/enarm/assets/$asset" > /dev/null
curl -fsS https://timer.musel.dev/grind/ > /dev/null
curl -fsS https://timer.musel.dev/grind/capital-one/ > /dev/null
curl -fsS https://timer.musel.dev/api/health | grep -Fq '"ok":true'
trap - ERR
echo "Published $release"
echo "Nginx backup: $backup"
REMOTE

echo 'https://timer.musel.dev/grind/enarm/'
