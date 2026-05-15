# Deployment — Cloudflare Pages (manual wrangler push)

> Astro static build, manually deployed to Cloudflare Pages via `wrangler pages deploy`.
> Cloudflare's GitHub auto-deploy is **not** connected — pushing to `main` does **not** trigger a build.

## Projects

| Project | URL | Purpose |
|---|---|---|
| `studyroom-project-site` | https://studyroom-project-site.pages.dev | Production — all 27 university landings + catalog |
| `studyroom-redesign` | https://studyroom-redesign.pages.dev | Preview / staging for redesigns |
| `studyroom-glasgow-v2` | https://studyroom-glasgow-v2.pages.dev | One-off prototype (legacy) |

CF account: `Molodes.1469@gmail.com` (cached at `.wrangler/cache/wrangler-account.json`).

## Custom domain

`studyroom.kz` is a **separate WordPress site** (`195.49.210.73`, nginx). It is **not** connected to this project. To expose the landings on a real domain, set up `unis.studyroom.kz` (or similar) via the Cloudflare Pages dashboard → Custom domains → CNAME to `studyroom-project-site.pages.dev`.

## Deploy to production (the actual flow)

```bash
cd site
rm -rf .astro                              # clean Astro cache (optional but recommended after Zod schema changes)
npm run build                              # outputs site/dist/
cd ..
npx wrangler pages deploy site/dist \
  --project-name=studyroom-project-site \
  --branch=main \
  --commit-dirty=true
```

Wrangler uploads only changed files (CF caches the rest by hash). A full deploy of 27 landings is typically 2–5 seconds after the build.

Output ends with:
```
🌎 Deploying...
✨ Deployment complete! Take a peek over at https://<hash>.studyroom-project-site.pages.dev
```

The `<hash>` URL is a permanent snapshot of this specific deploy. The latest deploy is always at `https://studyroom-project-site.pages.dev/`.

## Deploy to preview / staging

For testing a redesign before promoting to prod, deploy to `studyroom-redesign`:

```bash
cd site && npm run build && cd ..
npx wrangler pages deploy site/dist \
  --project-name=studyroom-redesign \
  --branch=preview \
  --commit-dirty=true
```

Live at https://studyroom-redesign.pages.dev/ after deploy.

## Local preview (no Cloudflare)

```bash
cd site
npm install            # one-time
npm run dev            # http://localhost:4321 — live reload
npm run build          # outputs site/dist/
npm run preview        # serves site/dist/ locally
```

## Verify a production deploy

```bash
curl -s -L https://studyroom-project-site.pages.dev/glasgow | grep -c "lp-chat-fab"
# Expected: 2 (one CSS rule + one HTML element) → new design active
```

Sample URLs:
- https://studyroom-project-site.pages.dev/ — catalog
- https://studyroom-project-site.pages.dev/glasgow/ — University of Glasgow
- https://studyroom-project-site.pages.dev/liverpool/ — University of Liverpool

## Rollback

Wrangler keeps every prior deploy as a permanent `<hash>.studyroom-project-site.pages.dev` URL. To roll back:

1. **Dashboard:** Cloudflare → Workers & Pages → `studyroom-project-site` → Deployments → pick a previous deploy → **Rollback**.
2. **CLI:** rebuild from a previous git commit and redeploy.
   ```bash
   git checkout <prev-sha> -- "site/src/pages/[slug].astro"
   cd site && rm -rf .astro && npm run build && cd ..
   npx wrangler pages deploy site/dist --project-name=studyroom-project-site --branch=main --commit-dirty=true
   git checkout HEAD -- "site/src/pages/[slug].astro"   # restore current
   ```

Local backups of overwritten templates also land in `.backup/<ISO-timestamp>/` when rolling out new landing designs (see `new-landing/TODO.md` workflow).

## Why no GitHub auto-deploy?

`wrangler pages project list` shows `Git Provider: No` for this project — Cloudflare's GitHub integration was never enabled (or was disconnected). Pros: deploys only when explicitly triggered (no surprise pushes from scraper PRs). Cons: every deploy is a manual step.

To switch to auto-deploy on `git push main`, connect the project at Cloudflare dashboard → Pages → `studyroom-project-site` → Settings → Builds & deployments → Configure Git → select `kovylin1/studyroom-project-site`, branch `main`, build command `cd site && npm ci && npm run build`, output dir `site/dist`, Node 20.
