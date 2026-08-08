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

Proxy Nginx to `http://127.0.0.1:3200`.

## Login (after seed)

- Email: `admin@vayuguard.com`
- Password: `Password@123`
