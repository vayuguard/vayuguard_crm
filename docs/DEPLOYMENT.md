# VayuGuard CRM — Deployment (Hostinger VPS)

## Prerequisites

- Node.js 20+
- PostgreSQL running locally on the VPS
- `.env` configured (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `PORT=3200`)

## First-time setup

```bash
cd ~/vayuguard_crm
npm install
npx prisma generate
npm run db:push
npm run db:seed
```

## Build + start with PM2 (required)

`next start` **needs** a production build. Always build first:

```bash
cd ~/vayuguard_crm
npm run build
pm2 delete vayuguard-crm   # if already exists / crash-looping
pm2 start npm --name vayuguard-crm -- start
pm2 save
pm2 startup                 # once, so it survives reboot
```

App listens on **port 3200**.

## Verify

```bash
pm2 list
pm2 logs vayuguard-crm --lines 50
curl http://127.0.0.1:3200/api/health
```

Healthy response looks like JSON with `"status":"ok"`.

## After code updates

```bash
cd ~/vayuguard_crm
# git pull / upload new files
npm install
npx prisma generate
npm run db:push            # only if schema changed
npm run build
pm2 restart vayuguard-crm
```

## Env for production domain

```env
AUTH_URL="https://crm.yourdomain.com"
NEXT_PUBLIC_APP_URL="https://crm.yourdomain.com"
PORT=3200
DATABASE_URL="postgresql://USER:PASSWORD@127.0.0.1:5432/vayuguard_crm?schema=public"
AUTH_SECRET="long-random-secret"
AUTH_TRUST_HOST="true"
```

## Nginx + HTTPS (required for the business-card scanner)

Browsers only expose `navigator.mediaDevices` on secure origins, so the **Scan
card** camera on `/contacts` will not work — and cannot even show a permission
prompt — until the CRM is served over HTTPS. Photo upload still works on HTTP.

Create `/etc/nginx/sites-available/crm.yourdomain.com`:

```nginx
server {
    listen 80;
    server_name crm.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3200;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;   # OCR/report requests can be slow
        client_max_body_size 25M;  # card photos and document uploads
    }
}
```

Enable it and issue a certificate:

```bash
sudo ln -s /etc/nginx/sites-available/crm.yourdomain.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d crm.yourdomain.com   # adds the TLS block + auto-renew
```

Point the domain's A record at the VPS first, and make sure `AUTH_URL` /
`NEXT_PUBLIC_APP_URL` use the `https://` address, then `pm2 restart vayuguard-crm`.

## Login (after seed)

- Email: `admin@vayuguard.com`
- Password: `Password@123`
