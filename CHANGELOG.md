# Changelog

## [0.5.0] - 2026-05-02

### Added
- **GitHub feed support** - new `feed.type: github` polls `api.github.com` events for users, orgs, and repos. Maps `PushEvent`, `PullRequestEvent`, `IssuesEvent`, `IssueCommentEvent`, `PullRequestReviewCommentEvent`, `CreateEvent`, `DeleteEvent`, and `ReleaseEvent` to the normalized `FeedEvent` shape. Optional `GITHUB_TOKEN` raises rate limit from 60/h to 5000/h.
- **Feed provider abstraction** - new `FeedProvider` interface alongside `ChatProvider`/`SpeechProvider`; `createFeedProvider()` factory switches on `feed.type`. `GitLabFeedProvider` (Atom) and `GitHubFeedProvider` (REST) both implement it.
- **MIT license** - first public release. `LICENSE` file added at root.
- **GitHub Actions** - `ci.yml` runs install / test / biome / tsc on every push and PR. `release.yml` cuts cross-platform binaries (linux x64/arm64, darwin x64/arm64, windows x64) on tag push.
- **Security workflows** - `security.yml` runs Semgrep (OWASP Top 10 + javascript/typescript/security-audit/secrets rulesets), Gitleaks secret scanning, and `dependency-review-action` on PRs. `codeql.yml` runs GitHub's semantic SAST with `security-extended` and `security-and-quality` query suites. SARIF results upload to GitHub code scanning. Both run on push, PR, and weekly cron.
- **Dependabot** - `.github/dependabot.yml` opens weekly grouped PRs for npm and github-actions ecosystems.
- **CONTRIBUTING.md** - branch conventions, style rules, and provider extension guide.

### Changed
- **Project renamed** to **Skald** (was `git-narrator`). Binary is now `skald`. Config file precedence updated to `skald.yaml` / `~/.config/skald/config.yaml` (legacy `git-narrator.yaml` paths removed).
- **Config schema**: top-level `gitlab:` block replaced by generic `feed:` block with `type: gitlab | github` discriminator. Old `gitlab:` block still parsed as a `feed.type: gitlab` alias for compatibility.
- **`FeedEvent`** replaces `GitLabEvent` as the normalized event shape across narrator and UI. `id` field is now `string` (was `number`) to fit GitHub's identifier format.
- **Defaults removed**: `providers.chat` and `providers.speech` of type `openai` no longer default to internal endpoints; `base_url`, `api_key`, `model` (and `voice` for speech) are required and surfaced with clearer errors.
- **TitleBar** shows feed `Source:` (gitlab/github) alongside feeds, poll, and filter.
- **Banner / branding** updated to Skald.

### Removed
- All references to internal infrastructure in defaults, examples, and docs.

## [0.4.0] - 2026-04-17

### Added
- **Provider abstraction** - new `src/providers/` layer with `ChatProvider` / `SpeechProvider` interfaces and a factory that switches on a `type:` discriminator
- **OpenAI-compatible provider** - any `/v1/chat/completions` + `/v1/audio/speech` endpoint (Azerion AI, OpenAI, OpenRouter, Ollama) via `type: openai` with configurable `base_url`
- **Claude Code chat provider** - `type: claude-code` shells out to the local `claude` CLI in headless mode (`-p`) for narration generation; uses OAuth/keychain auth, runs with `--permission-mode dontAsk` and `stdin: ignore` to avoid hangs, 120s timeout
- **Google Gemini TTS provider** - `type: gemini` calls `generativelanguage.googleapis.com` with `responseModalities: ["AUDIO"]` and wraps the returned 24kHz PCM in a WAV container locally; speed emulated via natural-language style hints
- **Arrow-key navigation in Updates panel** - `↑`/`↓` selects narrations (skips plain log lines); `c` copies the full unwrapped narration text; selection auto-resets and snaps to bottom when a new log arrives
- **Narration grouping** - wrapped narration lines now share a `narrationId` and carry the full original text; the whole block highlights together when selected
- **ScrollPanel component** - reusable scroll-viewport primitive at `src/ui/components/ScrollPanel.tsx`
- **Combined CLAUDE.md** - merged behavioral guidelines (think before coding, simplicity, surgical changes, goal-driven execution), engineering rules (verification, code quality, style), and git workflow alongside the existing Bun tooling guidance

### Changed
- **Config schema**: top-level `azerion:` replaced by `providers.chat` / `providers.speech`, each with a `type:` field. `SpeechProvider.synthesize()` now returns `{ data: Buffer; format: "mp3" | "wav" }` so the audio player uses the correct temp-file extension
- **Environment variables**: `AZERION_API_KEY` split into `CHAT_API_KEY` / `SPEECH_API_KEY` (per-provider); each type requires only what it needs (claude-code requires nothing, gemini only `api_key`)
- **`Narrator` and `Voice`** accept a provider instance via constructor injection instead of pulling credentials from `Config`
- **Narrations stored as groups**: `LogEntry` gained optional `narrationId` and `narrationText`; new `createNarrationLines()` / `listNarrationIds()` helpers. Updates panel title shows `[narration N/M]` when a narration is selected
- **Codebase style**: all em dashes replaced with hyphens across source, YAML, README, and CHANGELOG

### Fixed
- App no longer exits when GitLab connection or AI summarization fails during boot; errors are logged and the poll loop still starts
- `narrator.summarize()` failures (e.g., AI provider budget exceeded) are isolated so boot completes and `last_message` still advances
- Claude Code chat provider: error output from the CLI (`"Not logged in"`, etc.) goes to stdout, not stderr - error messages now include both streams; `--bare` flag dropped since it disables OAuth/keychain auth; added `--permission-mode dontAsk` to prevent hangs on tool-permission prompts

### Removed
- `useMouseScroll` hook and SGR mouse tracking from the Updates panel (caused stdin conflicts with ink)
- Dead `ctrl+c` handler in `App.tsx` (ink handles it by default)
- `stripAnsi` helper in `App.tsx` (no longer needed now that narrations copy from stored `narrationText`)

## [0.3.0] - 2026-04-04

### Added
- **Bordered panels with titles** - reusable `BorderBox` component renders panel titles ("Authors", "Projects", "Updates") inline in the top border
- **Title bar config info** - title bar now shows feeds, poll interval, filter, personality, and mode
- **Biome linting** - `bun run lint` / `bun run format` for consistent code style
- **Unit tests** - 54 tests covering Atom parser, GitLab title parsing, event filtering, config parsing, and event description

### Changed
- Modular architecture: `config/`, `feed/`, `narrator/`, `voice/`, `ui/` with co-located types and tests
- Extracted pure functions from classes for testability (`parseFeedTitle`, `extractBranch`, `matchesEventFilter`, `describeEvent`)
- Uses `Bun.file`/`Bun.write` instead of `node:fs` where possible
- Chat panel renamed to "Updates"

### Security
- API error bodies truncated to 500 chars before logging
- HTTPS enforced for `gitlab.url`
- `saveConfig` serialized through async write lock to prevent race conditions
- Atom XML tag parser restricted to known tag names (prevents regex injection)
- Temp audio files use `crypto.randomUUID()` instead of predictable `Date.now()`
- `resolveHome` throws when `HOME` is unset instead of resolving to filesystem root

## [0.2.0] - 2026-04-02

### Added
- **Author & project registry** - authors (name, job title) and projects (name, description) are now tracked in `config.yaml` and passed as context to the narrator
- **Interactive setup** - on first boot (blocking), scans feed history and prompts for each unknown author and project; new unknowns during polling are prompted non-blocking while narration continues
- **Catch-up summaries** - records `last_message` timestamp (from event times, not wall clock) after every narration; on next boot, fetches missed events and generates a spoken recap
- **Narration variety** - stores the last 6 narrations as history context, uses presence/frequency penalties, and enforces strict anti-repetition rules in the system prompt
- **Ink terminal UI** - four-panel layout (title, author/project stats, chat log, help bar) that auto-resizes to terminal dimensions
- **Activity bar charts** - author and project stats panels with proportional bar charts, auto-truncating long names
- **Test mode** - press `t` to fetch the latest event from the feed, narrate it, and play audio
- **Mute toggle** - press `m` to mute/unmute voice; stops current playback when muting
- **Scrolling chat log** - narration text wraps within the chat panel, event lines truncate; old messages scroll off the top
- **Clickable GitLab links** - event log lines show display names from config and `[see on gitlab]` hyperlinks (ANSI OSC 8)
- **TTS-safe output** - narrator avoids possessive apostrophes (`'s`) which cause TTS mispronunciation

### Changed
- Narrator system prompt now includes author display names, job titles, and project descriptions for richer narrations
- `last_message` now tracks the latest event timestamp rather than wall clock time
- Bumped to ink 6 / React 19 for the terminal interface

### Removed
- `--test` CLI flag (replaced by `t` key in the interactive UI)
- Old raw console output, replaced by ink components

## [0.1.0] - 2026-03-31

### Added
- Initial release
- GitLab Atom feed polling with configurable interval and event filters
- AI narration via Azerion AI chat API with configurable personality
- Voice synthesis via Azerion AI speech API
- Keyboard controls: replay (r), stop (p), quit (ctrl+c)
- Dry-run and text-only modes
- User exclusion list for bots
