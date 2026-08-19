#!/usr/bin/env bash
# Şakül — one-time server provisioning. Run as root on the Hetzner box:
#   bash provision.sh
# Idempotent: safe to re-run. Mirrors the yildiz360 layout.
set -euo pipefail

DOMAIN="sakulproject.duckdns.org"
APP_DIR="/var/www/sakul"
GIT_DIR="/var/www/sakul.git"
PORT=3002

echo "== 1/6 directories =="
mkdir -p "$APP_DIR"/{app,data/uploads,shared}
touch "$APP_DIR/shared/.env"
chown -R deploy:deploy "$APP_DIR"

echo "== 2/6 bare git repo + post-receive hook =="
if [ ! -d "$GIT_DIR" ]; then
  sudo -u deploy git init --bare "$GIT_DIR"
fi
cat > "$GIT_DIR/hooks/post-receive" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail
APP=/var/www/sakul/app
GIT_DIR=/var/www/sakul.git

echo "==> checkout"
git --work-tree="$APP" --git-dir="$GIT_DIR" checkout -f main

echo "==> backend"
cd "$APP/server"
npm ci --omit=dev --no-audit --no-fund
npm i -D typescript --no-audit --no-fund   # tsc needed for build only
npx tsc
ln -sfn /var/www/sakul/shared/.env "$APP/server/.env"

echo "==> frontend"
cd "$APP/web"
npm ci --no-audit --no-fund
npm run build

echo "==> restart"
cd "$APP/server"
pm2 restart sakul-api 2>/dev/null || pm2 start dist/index.js --name sakul-api --node-args="--env-file=.env"
pm2 save
echo "==> deploy complete"
HOOK
chmod +x "$GIT_DIR/hooks/post-receive"
chown -R deploy:deploy "$GIT_DIR"

echo "== 3/6 nginx vhost =="
cat > /etc/nginx/sites-available/sakul <<NGINX
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}
server {
    listen 443 ssl;
    server_name $DOMAIN;

    # certbot fills in ssl_certificate lines on first run
    root $APP_DIR/app/web/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # NOTE: no /uploads/ location on purpose — files are private,
    # served only through the auth-gated API.
    location /api/ {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 25M;
    }

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_types text/plain text/css application/json application/javascript image/svg+xml;
    gzip_min_length 1000;
}
NGINX
ln -sfn /etc/nginx/sites-available/sakul /etc/nginx/sites-enabled/sakul
nginx -t

echo "== 4/6 TLS certificate =="
# HTTP vhost must be live for the ACME challenge
systemctl reload nginx
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || \
  echo "!! certbot failed — is the DuckDNS subdomain '$DOMAIN' pointing at this IP yet?"
systemctl reload nginx

echo "== 5/6 backup cron =="
cat > /etc/cron.d/sakul-backup <<'CRON'
# Nightly Şakül DB backup, 7-day rotation (03:15, after yildiz360's 03:00)
15 3 * * * deploy sqlite3 /var/www/sakul/data/sakul.db ".backup /var/www/sakul/data/sakul.db.bak.$(date +\%A)" 2>/dev/null || cp /var/www/sakul/data/sakul.db "/var/www/sakul/data/sakul.db.bak.$(date +\%A)"
CRON

echo "== 6/6 summary =="
echo "done. Next steps (local machine):"
echo "  git remote add production deploy@128.140.106.121:/var/www/sakul.git"
echo "  git push production main"
