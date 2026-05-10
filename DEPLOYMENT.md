# Deployment — Cloudflare Pages

> Astro static build, deployed via Cloudflare Pages directly from the GitHub repo.
> Once set up, every push to `main` triggers a rebuild + deploy.

## One-time setup (you do this in the Cloudflare dashboard)

### 1. Connect the GitHub repo

1. Log in to https://dash.cloudflare.com/ → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Authorize Cloudflare to access GitHub if prompted.
3. Select repo: `kovylin1/studyroom-project-site`.
4. Branch: `main`.

### 2. Build settings (paste exactly)

| Setting | Value |
|---|---|
| **Framework preset** | Astro |
| **Build command** | `cd site && npm ci && npm run build` |
| **Build output directory** | `site/dist` |
| **Root directory** | _(leave empty — repo root)_ |
| **Node version** | `20` (set as env var: `NODE_VERSION=20`) |

Click **Save and deploy**. First build takes ~2 minutes.

### 3. Custom domain

After the first successful build:

1. **Pages project → Custom domains → Set up a custom domain.**
2. Enter `studyroom.kz` (or a subdomain like `unis.studyroom.kz`).
3. Cloudflare gives you a CNAME target. Add it at your DNS provider:
   - Type: `CNAME`
   - Name: `unis` (or `@` for apex — see Cloudflare's apex CNAME flattening if going apex)
   - Target: `<your-project>.pages.dev`
4. Wait 1–5 minutes for DNS + cert provisioning.

### 4. Preview branches (optional but recommended)

Cloudflare Pages auto-builds every PR as `https://<commit-sha>.<your-project>.pages.dev`. Use this to review scraper PRs visually before merging — see the Decap workflow below.

## Verify it works

After a deploy completes:
- `https://<your-project>.pages.dev/` — catalog
- `https://<your-project>.pages.dev/glasgow/` — University of Glasgow landing
- `https://<your-project>.pages.dev/liverpool/` — University of Liverpool landing

## Local preview (no Cloudflare)

```bash
cd site
npm install      # one-time
npm run dev      # http://localhost:4321
npm run build    # outputs site/dist/
npm run preview  # serves site/dist/ locally
```

## Rebuild manually (without a code push)

In the Cloudflare Pages project: **Deployments → ⋮ → Retry deployment**. Or run the cron workflow from GitHub Actions UI.
