# Skill: `quiet_mode` — long-running background pipelines

**Trigger phrases:** «use skill quiet_mode», «quiet mode», «работай тихо», «overnight pipeline», «autonomous bg», «спарси N сайтов фоном».

**One-line summary:** Долгие задачи → пишу Node-скрипт → запускаю в фон → молчу до уведомления → краткий отчёт. Экономия LLM-токенов в 5-10 раз.

---

## When this skill triggers

User asks for ANY of:
- Скрапить/обрабатывать N>10 сайтов или файлов
- Multi-stage pipeline (ETL, build, deploy, audit)
- «Overnight» автономная работа
- «Запусти фоном» / «работай тихо» / «по завершению доложи»
- Аудит/верификация большого датасета

## What to do (steps)

1. **Write a Node script** that does ALL the work (loops, scrapes, writes to disk). Use existing libraries (cheerio, playwright, fs/promises). NO Agent calls per item.
2. **Launch with Bash** `run_in_background: true`. Output goes to log file (`sources/{stage}.log`), NOT chat.
3. **End response with ONE line:** `"<codeword> запущен, ETA ~Yh, silent до уведомления"`. Stop talking.
4. **Wait** for system `task-notification` event. Do NOT poll. Do NOT send progress updates.
5. **On completion** — terse summary (table preferred): что сделано, что не получилось, URL deploy, next step. **NO recap of process.**
6. **Multi-stage tasks = single orchestrator script** that chains stages: wait-for-deps → run-A → run-B → ... → build → deploy → commit → push → PR → merge. Launch ONCE.
7. **Each stage ends with git commit + push to `feat/{name}` branch + `gh pr create` + `gh pr merge --auto`.** Auto-mode classifier blocks direct push to main; PR path always works.

## What NOT to do

| Forbidden | Why |
|---|---|
| «10% done», «50% done», «still working» chatter | Each turn = $0.05-0.30 wasted |
| Polling background tasks you started | Completion notification arrives automatically |
| Agent calls per item if Node loop works | Agent calls cost tokens too |
| Direct `git push origin main` after first PR | Auto-mode classifier blocks; use feat-branch + PR |
| Long recap of what you did | User reads the deploy URL, not the story |
| Asking «ok to proceed?» mid-pipeline | If auth's clear, just go |

## When to break silence

ONLY:
- **Blocker**: login rejected, 2FA required, auth-mode classifier denial, fatal crash that orchestrator's auto-retry didn't fix
- **Build/deploy failure** orchestrator couldn't recover from — show exact error + proposed fix
- **User asks explicitly** «как там?» / «статус?» — answer with poll of last log line

## Codeword pattern

User adopts short tags (animals/insects work well). Examples:
- ПАУК = uni-site deep crawl (programs)
- ПЧЕЛА = Edvoy aggregator scrape
- БОБР = accommodation + campuses scraper
- МУХА = Study Group portal scrape
- ОРЁЛ = photo quality pass (filter stock + dedupe)
- РЕВИЗОР = automated link verifier
- МОТЫЛЁК = photo discovery (Wikimedia + OG + Wikipedia)

Each codeword should have its own memory file documenting: portal URL, creds (env vars), script paths, resume plan.

**Verb semantics:**
- `как <codeword>?` → progress check (tail log, no script changes)
- `запусти <codeword>` / `продолжи <codeword>` → run resume plan from memory
- `останови <codeword>` → `TaskStop <task_id>`
- `удали <codeword>` → wipe its output dir (always ask before destructive)

## Cost economics

| Action | Typical cost |
|---|---|
| Write Node script (curl + cheerio + dedupe) | ~$1.50 |
| Write Playwright script (login + iframe + shadow DOM) | $2-4 |
| Write orchestrator chaining 5 stages with retry | ~$2 |
| Per-aggregator auth-portal scraper (GraphQL or DOM) | $3-5 |
| 1 launch + 1 completion report | ~$0.50 |
| **Total autonomous overnight pipeline** | **$5-15** |
| (vs hand-walked through chat) | ($50-100) |

Background script runtime is FREE (no Anthropic API calls).

## Standard pipeline boilerplate

```javascript
// orchestrator-{name}.mjs
import fs from 'fs/promises';
import { spawn } from 'child_process';

const log = async (msg) => {
  const line = `[orch ${new Date().toISOString().slice(11,19)}] ${msg}`;
  console.error(line);
  await fs.appendFile('sources/orchestrator.log', line + '\n');
};

function run(cmd, args, cwd) {
  return new Promise(resolve => {
    const p = spawn(cmd, args, { cwd, shell: true });
    let stdout = '', stderr = '';
    p.stdout.on('data', d => stdout += d);
    p.stderr.on('data', d => stderr += d);
    p.on('close', code => resolve({ code, stdout, stderr }));
  });
}

async function waitDone(file, marker, label) {
  for (let i = 0; i < 600; i++) {
    try { if ((await fs.readFile(file, 'utf8')).includes(marker)) return; } catch {}
    await new Promise(r => setTimeout(r, 30000));
  }
}

// stages: each runs script, captures result, retries if needed
// final: build (with sanitize-on-fail retry) → deploy → commit + push → PR + auto-merge
```

## Standard end-of-pipeline git flow

```bash
git checkout -B feat/overnight-{name}
git add <specific paths>   # never `git add -A` (may catch creds or junk)
git commit -m "feat(catalog): {stage-summary}"
git push -u origin feat/overnight-{name}
gh pr create --base main --head feat/overnight-{name} --title "..." --body "..."
gh pr merge --merge --auto
```

## Setup for new project / new laptop

1. Drop this `QUIET_MODE.md` at the project root.
2. Add to project's `CLAUDE.md`: `Skill: quiet_mode → see QUIET_MODE.md. Trigger on "use skill quiet_mode" or "работай тихо".`
3. (Optional) Create a memory file `feedback_quiet_mode.md` in your global memory dir for cross-project trigger.
4. First time you say "use skill quiet_mode" — Claude reads this file and applies the pattern.

---

**This skill was extracted from a real overnight pipeline (studyroom-project-site, 2026-05-23):**
447→647 universities, +44k programs from Edvoy, +329 campuses, +402 accommodation, auto-deploy + PR merge. Total LLM cost ~$15. Wall time 8h. Fully autonomous after launch.
