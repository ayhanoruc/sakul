# Şakül — Deployment Runbook

> Secrets (tokens, keys) do **not** belong in this file or anywhere in git.
> They live on the server in `/var/www/sakul/shared/.env`.

## Where it runs

Same Hetzner box as yildiz360 (Nuremberg, Ubuntu 24.04). Şakül is fully independent:
own vhost, own PM2 process, own DB, own uploads.

| Thing | Value |
|---|---|
| URL | https://sakulproject.duckdns.org |
| API process | PM2 `sakul-api` (user `deploy`), port 3002 |
| Code | `/var/www/sakul/app/` (checkout of the bare repo) |
| Push target | `deploy@<server-ip>:/var/www/sakul.git` |
| DB | `/var/www/sakul/data/sakul.db` (outside the checkout — a re-deploy can never clobber it) |
| Uploads | `/var/www/sakul/data/uploads/` (private; served via API auth, no nginx location) |
| Env | `/var/www/sakul/shared/.env`, symlinked into the checkout by the deploy hook |
| Backups | `/etc/cron.d/sakul-backup`, nightly 03:15, 7-day rotation |

## One-time setup

1. **DNS** — add subdomain `sakul` in the DuckDNS dashboard, pointing at the server IP.
2. **Provision** — copy `deploy/provision.sh` to the server and run as root:
   `scp deploy/provision.sh root@<server-ip>:/tmp/ && ssh root@<server-ip> "bash /tmp/provision.sh"`
3. **Local remote** — `git remote add production deploy@<server-ip>:/var/www/sakul.git`

## Deploy

```bash
git push production main
```

The post-receive hook checks out, installs, builds backend (`tsc`) and frontend (Vite),
and restarts `sakul-api` under PM2.

## Maintenance

```bash
ssh deploy@<server-ip> "pm2 logs sakul-api --lines 50"   # logs (PM2 is per-user: use deploy, not root)
ssh deploy@<server-ip> "pm2 restart sakul-api"
curl -s https://sakulproject.duckdns.org/api/health              # health
```

## Restore drill (documented before it's needed)

```bash
ssh deploy@<server-ip>
pm2 stop sakul-api
cp /var/www/sakul/data/sakul.db.bak.<Day> /var/www/sakul/data/sakul.db
pm2 start sakul-api
```
