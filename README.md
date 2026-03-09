LostToFound is a Next.js app for lost pet profiles and finder messages.

## Local Development

Install dependencies and run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Production Deploy

This repo deploys with GitHub Actions via [`.github/workflows/deploy.yml`](/Users/BailyHartman/code/losttofound/.github/workflows/deploy.yml).
On push to `main`, it:

1. SSHes to your server
2. Updates the server checkout at `/opt/losttofound` (or `LOSTTOFOUND_PATH`)
3. Rebuilds the `losttofound` service in your Docker stack at `/opt/listhaus` (or `STACK_PATH`)

Configure these GitHub Actions secrets in this repository:

- `DEPLOY_HOST`
- `DEPLOY_PORT` (optional, default `22`)
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `COMPOSE_PROJECT_NAME` (optional, default `listhaus`)
- `LOSTTOFOUND_PATH` (optional, default `/opt/losttofound`)
- `STACK_PATH` (optional, default `/opt/listhaus`)

Manual fallback deploy on the server:

```bash
cd /opt/losttofound && git pull origin main
cd /opt/listhaus && docker compose up -d --build losttofound caddy
```
