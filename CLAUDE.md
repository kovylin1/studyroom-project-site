# studyroom-project-site — Project Rules

> Project-scoped overrides for the StudyRoom university-catalog parser.
> The root `Claude/CLAUDE.md` rules still apply; these add catalog-specific token-saving guidance.

## Token-saving rules (catalog work)

1. **Disable GateGuard for routine catalog writes:**
   set `ECC_GATEGUARD=off` in shell, OR add `pre:edit-write:gateguard-fact-force`
   and `pre:bash:gateguard-fact-force` to `ECC_DISABLED_HOOKS` in `.claude/settings.json`.
   Re-enable for schema/architecture changes or destructive ops.
   Saves ~30–50% tokens on bulk catalog sessions; dup-check + Zod validation
   already cover the safety net it provides.

2. **Agent output pattern: agents WRITE directly to disk**
   (`scraper/src/sources/<slug>.ts` or `site/src/content/universities/<slug>.json`).
   Don't return JSON in the chat. Return a one-line OK/GAP report.

3. **Per-uni agent model for aggregators:**
   1 Explore agent → 1 university. Spawn N in parallel, each returns
   `OK: wrote <slug>.json (N programs)` or `GAP: <reason>`.

4. **Subject expansion via script, not by hand:**
   `scraper/src/expand-cats-programs.mjs` is the template — copy for next aggregator.

5. **Schema-valid in one shot:** prompt agents with the EXACT Zod constraints
   (`amount` must be STRING not number, `null` fields must be omitted, etc.).
   Avoids post-fix scripts.

6. **No staging files for raw agent output.** Write straight into
   `site/src/content/universities/` once the schema is known.

7. **Existing pipeline shortcut:** register slug in `USES_OFFICIAL_DEGREE_SCRAPER`
   in `scraper/src/cli.ts`, write `scraper/src/sources/<slug>-degrees.ts`,
   run `npm run scrape`. Adelaide/Murdoch/Newcastle/Massey use this pattern.

8. **Terse status:** tables only in the final summary; intermediate updates 1–2 lines.

**Skill `quiet_mode`** — for long pipelines see [QUIET_MODE.md](./QUIET_MODE.md). Trigger phrases: «use skill quiet_mode», «работай тихо», «overnight pipeline», «autonomous bg». Codewords (ПАУК/ПЧЕЛА/БОБР/МУХА/ОРЁЛ/РЕВИЗОР) are part of this skill.

9. **Silent-mode for background tasks (CRITICAL token rule):**
   When running a long background job (Bash `run_in_background:true`, Agent in background,
   or a parallel Claude session), **stay silent until completion**.
   - DO NOT send progress updates ("30% done", "downloading...", "still working").
   - DO answer the user if they explicitly ask "как там?" / "статус?" / "что по ПАУКу?".
   - DO report immediately if blocked by: auto-mode classifier rejection, missing creds,
     schema error that needs human input, or a fatal script crash.
   - DO send the final summary as a single message when the background job completes.
   Reason: each chat turn costs ~$0.05–0.30 in LLM tokens; useless progress chatter
   on a 2-hour scraper run adds up fast. The background script itself costs $0 — keep it that way.
   How to apply: when you launch a background Bash/Agent, end the response with the
   launch confirmation. Don't poll or narrate. Wait for the system completion notification.
