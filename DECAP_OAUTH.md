# Decap CMS — GitHub OAuth Setup

Decap CMS uses GitHub as its backend (commits go straight to git). It needs an OAuth proxy because GitHub OAuth cannot redirect to a static site directly.

## One-time setup (5–10 minutes)

### Step 1. Create a GitHub OAuth App

Go to https://github.com/settings/developers → "New OAuth App":

- Application name: `StudyRoom Decap CMS`
- Homepage URL: `https://studyroom.kz` (or your Cloudflare Pages URL)
- Authorization callback URL: `https://decap-oauth.studyroom.kz/callback` (URL of the Worker you will deploy in step 2)

Save the Client ID. Generate a Client Secret and copy it somewhere safe — you will not see it again.

### Step 2. Deploy a Cloudflare Worker as the OAuth proxy

We use the open-source `decap-proxy` worker:

```bash
npm install -g wrangler
git clone https://github.com/sterlingwes/decap-proxy
cd decap-proxy
wrangler login
wrangler deploy
```

Then in the Cloudflare dashboard for that Worker:

- Settings → Variables → add:
  - `OAUTH_CLIENT_ID` = your GitHub Client ID
  - `OAUTH_CLIENT_SECRET` = your GitHub Client Secret
  - `OAUTH_AUTHORIZED_ORIGINS` = `https://studyroom.kz,https://*.pages.dev`
- Custom domain → add `decap-oauth.studyroom.kz` (or any subdomain you control).

### Step 3. Update site/public/admin/config.yml

Set `base_url:` to match your Worker's URL (e.g. `https://decap-oauth.studyroom.kz`).

### Step 4. Test

Open `https://studyroom.kz/admin/` (or your Pages URL + `/admin/`). Click "Login with GitHub". Authorize. You should land in the Decap UI showing the universities collection.

## What managers can do in /admin

- Browse all 16 universities, see editorial-workflow status (Draft / In Review / Ready).
- Edit any field (name, programs, tuition, deadlines, requirements, scholarships).
- Save → opens a PR automatically. Review the PR on GitHub, merge → Cloudflare auto-deploys in ~60 seconds.
- The same flow handles the monthly-cron PRs from the scraper.
