#!/usr/bin/env bash
# Provision only enarm.musel.dev. DNS must already point to this VPS.
set -euo pipefail
ssh -o BatchMode=yes my-vps bash -s <<'REMOTE'
set -euo pipefail
config=/etc/nginx/sites-available/enarm.musel.dev
enabled=/etc/nginx/sites-enabled/enarm.musel.dev
if [[ -e "$config" ]] && ! grep -Fq '# ENARM Contraste dedicated host' "$config"; then
  echo 'The domain configuration belongs to another application.' >&2
  exit 1
fi
if [[ ! -e "$config" ]]; then
  temp=$(mktemp)
  cat > "$temp" <<'HTTP'
# ENARM Contraste dedicated host
server {
    listen 80;
    listen [::]:80;
    server_name enarm.musel.dev;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 503 "ENARM Contraste: preparando la nueva muestra.\n"; }
}
HTTP
  sudo -n install -m 644 "$temp" "$config"
  rm -f "$temp"
  sudo -n ln -s "$config" "$enabled"
  if ! sudo -n nginx -t; then
    sudo -n rm -f "$enabled" "$config"
    exit 1
  fi
  sudo -n systemctl reload nginx
fi
sudo -n certbot certonly --webroot -w /var/www/html \
  -d enarm.musel.dev --non-interactive --keep-until-expiring
REMOTE
