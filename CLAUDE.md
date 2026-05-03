# CLAUDE.md

Behavioral guidelines and project conventions. The behavioral rules bias toward caution over speed; for trivial tasks, use judgment.

## Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them. Don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- Three similar lines is better than a premature helper function.
- No magic numbers. Extract layout offsets, column widths, thresholds, timeouts, and any value used in a calculation into a named `const` at module scope. Inline literals are only OK for universally understood constants (0, 1, 100 for percent).
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it. Don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

## Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" becomes "Write tests for invalid inputs, then make them pass"
- "Fix the bug" becomes "Write a test that reproduces it, then make it pass"
- "Refactor X" becomes "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [step] -> verify: [check]
2. [step] -> verify: [check]
3. [step] -> verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## Verification

- NEVER commit without running the app locally first and confirming it works.
- Run `bun test` and `bun run src/index.ts` (or the relevant entrypoint) before any commit.
- For UI/TUI changes: run the app and visually confirm rendering.
- For new features: test the happy path AND edge cases (empty data, missing config, pipe mode, network failures).

## Accuracy

- Every user-facing value (numbers, labels, identifiers, API shapes) must be verified against real data. No guessing model IDs, endpoint paths, or response formats.
- Date and range calculations must be tested with edge cases (month boundaries, leap days, timezone shifts).

## Code Quality

- Clean, minimal code. No dead code, no commented-out blocks, no TODO placeholders.
- No emoji anywhere in the codebase.
- No em dashes. Use hyphens, commas, or rewrite the sentence.
- No AI slop: avoid "streamline", "leverage", "robust", "seamless" in user-facing text and commit messages.
- No unnecessary abstractions. Three similar lines beats a premature helper.

## Style

- TypeScript strict mode. No `any` types.
- No comments unless the WHY is non-obvious. Well-named identifiers already explain WHAT.
- Imports: node/bun builtins first, then deps, then local (separated by blank line).
- Follow existing formatter config; run `bunx biome check --fix` before commit.

## Git

### Branching (strict)

- NEVER commit directly to main. All work happens on branches.
- Branch naming: `feat/<name>`, `fix/<name>`, `chore/<name>`, `docs/<name>`.
- Merge to main ONLY after: tests pass, app runs locally, manual testing done.
- Tag releases: `git tag v0.X.0` after merge.

### Creating a branch

```bash
git checkout main && git pull origin main
git checkout -b feat/my-feature
# work, test, iterate
bun test
bun run src/index.ts
# when ready:
git checkout main && git merge feat/my-feature
git push origin main
```

### Handling external PRs

- NEVER rewrite a contributor's changes on your own branch. Always merge THEIR branch.
- Add your improvements as separate commits on top of their branch, not as replacements.
- This preserves their authorship in git history.

```bash
gh pr checkout <number>
bun test
bun run src/index.ts
# apply patches if needed, commit on their branch
git checkout main
git merge <branch>
git push origin main
gh pr comment <number> --body "Merged, thanks!"
```

### What gets committed

- Source code, config, docs, assets.
- NEVER commit: `.env`, secrets, keys, API tokens, planning docs, IDE config, logs, `.DS_Store`.
- Check `git status` before every commit. Stage specific files; never `git add -A` or `git add .`.

### Commit rules

- NEVER add `Co-Authored-By` lines.
- NEVER include personal names or usernames in commits.
- Small, focused commits. One feature per commit.
- Test locally before every commit.

### Public-facing language (commits, PRs, release notes, README)

- Commits and release notes are public. Write like you'd publish them.
- NEVER use words like "steal", "stealing", "copy", "rip off", "inspired by" in commit messages.
- Describe what the code does, not where ideas came from.
- If you must credit prior art, do it in code comments or docs, not commit messages.
- No snark, no filler, no self-deprecation. Treat each commit as a product statement.

## Runtime: Bun

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads `.env`, so don't use dotenv.

### APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s `readFile`/`writeFile`.
- ``Bun.$`ls` `` instead of `execa`.

### Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

### Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import `.tsx`, `.jsx` or `.js` files directly and Bun's bundler will transpile and bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then run `index.ts`:

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

---

**These guidelines are working if:** diffs have fewer unnecessary changes, code rarely needs to be rewritten because it was overcomplicated, and clarifying questions come before implementation rather than after mistakes.
