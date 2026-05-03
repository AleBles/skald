# Contributing to Skald

Thanks for considering a contribution. This is a small project; the bar for changes is "does it make Skald better for users without breaking anyone else." Here's how to land work cleanly.

## Setup

```bash
git clone https://github.com/alebles/skald
cd skald
bun install
cp config.example.yaml skald.yaml   # then fill in your tokens
bun start
```

## Branches

- `main` is protected and always shippable, never commit directly.
- Branch off main with `feat/<short-name>`, `fix/<short-name>`, `chore/<short-name>`, or `docs/<short-name>`.
- Open a PR against main. Squash-merge once CI is green.

## Before you push

```bash
bun test
bun run lint
bun run typecheck
bun start            # smoke test the CLI with your config
```

CI runs the same checks; a green local run almost always means a green PR.

## Style

- TypeScript strict mode. No `any`.
- Biome formats and lints (`bun run lint:fix`). Match the existing style.
- No comments unless the *why* is non-obvious; well-named identifiers explain the *what*.
- No emoji in source. No em dashes.
- Imports: builtins first, deps next, local last; one blank line between groups.

## Commits and PRs

- Small, focused commits. One logical change per commit.
- Commit messages and PR titles are public - write them like release notes.
- Don't add `Co-Authored-By` lines.
- PR descriptions should explain *why* and link issues. The diff covers *what*.

## Adding a new provider

Skald has three pluggable surfaces: feed, chat, speech. To add one:

1. Define a config interface in the relevant `types.ts` (feed/types.ts or providers/types.ts).
2. Implement the corresponding interface (`FeedProvider`, `ChatProvider`, `SpeechProvider`).
3. Wire it into the factory in `index.ts`.
4. Update `parseFeed` / `parseChatProvider` / `parseSpeechProvider` in `src/config/loader.ts`.
5. Document it in `config.example.yaml` and the README.
6. Add tests.

## Reporting issues

Open an issue with reproduction steps, your config (redacted), and Skald version. Stack traces beat prose.
