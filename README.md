<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="site/logo-dark.svg">
    <img src="site/logo.svg" alt="skald" width="320">
  </picture>
</p>

<p align="center">
  <a href="https://github.com/alebles/skald/actions/workflows/ci.yml"><img src="https://github.com/alebles/skald/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/runtime-bun-black.svg" alt="Bun"></a>
  <a href="https://skald.bles.nu"><img src="https://img.shields.io/badge/site-skald.bles.nu-d97706.svg" alt="Site"></a>
</p>

AI voice narrator for repo activity. Polls GitHub or GitLab feeds and narrates events like a live commentator over your speakers.

> _Skald (Old Norse): a poet who composed and recited verse at the courts of Scandinavian kings - the original release-notes engine._

## Install

Download a prebuilt binary for your platform from the [latest release](https://github.com/alebles/skald/releases/latest), or run from source:

```bash
git clone https://github.com/alebles/skald
cd skald
bun install
```

## Setup

Copy the example config and edit it:

```bash
cp config.example.yaml skald.yaml
```

You'll need:
- A **feed source** - GitHub (optional Personal Access Token) or GitLab (Feed token from User Settings)
- A **chat provider** for narration - any OpenAI-compatible API (OpenAI, OpenRouter, Ollama, ...) or the local `claude` CLI
- A **speech provider** for voice - any OpenAI-compatible TTS endpoint, or Google Gemini

### Recipe 1: GitHub + OpenAI

```yaml
feed:
  type: github
  feeds:
    - users/octocat
    - repos/oven-sh/bun
  events: [pushed, merged]

providers:
  chat:
    type: openai
    base_url: https://api.openai.com/v1
    api_key: sk-...
    model: gpt-4o-mini
  speech:
    type: openai
    base_url: https://api.openai.com/v1
    api_key: sk-...
    model: gpt-4o-mini-tts
    voice: alloy
```

### Recipe 2: GitLab + local Ollama (no API keys)

```yaml
feed:
  type: gitlab
  url: https://gitlab.com/
  feed-token: glft-...
  feeds:
    - my-group

providers:
  chat:
    type: openai
    base_url: http://localhost:11434/v1
    api_key: ollama
    model: llama3.2
  speech:
    type: openai
    base_url: ...      # any OpenAI-compatible TTS endpoint
    api_key: ...
    model: ...
    voice: ...
```

### Recipe 3: Claude Code + Gemini TTS

```yaml
providers:
  chat:
    type: claude-code
    model: sonnet
  speech:
    type: gemini
    api_key: ...
    model: gemini-2.5-flash-preview-tts
    voice: Kore
```

## Usage

```bash
# Start monitoring
bun start

# Narrate without audio
bun run src/index.ts --text-only

# Fetch events without narrating
bun run src/index.ts --dry-run
```

### Keyboard shortcuts

- `↑` / `↓` - select past narrations
- `c` - copy selected (or last) narration to clipboard
- `t` - test: fetch latest event, narrate, play audio
- `r` - replay last audio
- `p` - stop current audio
- `m` - mute / unmute voice
- `Ctrl+C` - quit

### Terminal UI

Five-panel Ink interface:

```
╭─────────────────────────────────────────────────╮
│                Skald v0.5.0                      │
│ Source: github  Feeds: oven-sh/bun  Poll: 30s    │
│ Personality: monotone british...  Mode: full     │
╰─────────────────────────────────────────────────╯
╭─ Authors ──────────────╮╭─ Projects ─────────────╮
│ Ale  ████████████████ 6 ││ Console █████████████ 9 │
│ Ragib ████████▍       3 ││ Android ██████▊       4 │
╰────────────────────────╯╰────────────────────────╯
╭─ Updates ───────────────────────────────────────╮
│ [2:06 PM] 3 new event(s) detected               │
│   Ale - Console [link]                           │
│   "Right then, a flurry of activity..."          │
╰─────────────────────────────────────────────────╯
╭─────────────────────────────────────────────────╮
│ [t] test [r] replay [p] stop [m] mute [ctrl+c]  │
╰─────────────────────────────────────────────────╯
```

### First run

On first boot Skald scans the feed history and prompts you to name each author and project it finds. These are saved back to `skald.yaml` and used to give the narrator richer context (display names, job titles, project descriptions).

### Catch-up on boot

If `last_message` is set in config, Skald fetches everything that happened since and generates a spoken summary before resuming live monitoring.

## Configuration

See [`config.example.yaml`](config.example.yaml) for every option.

### Environment variables (override config)

| Variable | Purpose |
|---|---|
| `GITLAB_FEED_TOKEN` | GitLab feed token |
| `GITHUB_TOKEN` | GitHub PAT (optional, raises rate limit from 60/h to 5000/h) |
| `CHAT_API_KEY` | API key for the chat provider |
| `SPEECH_API_KEY` | API key for the speech provider |

### Config file locations (checked in order)

1. `./config.yaml`
2. `./config.yml`
3. `./skald.yaml`
4. `./skald.yml`
5. `~/.config/skald/config.yaml`

Or pass `--config <path>` explicitly.

## Project structure

```
src/
├── index.ts                - entry point, CLI args, bootstrap
├── config/
│   ├── types.ts            - Config, AuthorInfo, ProjectInfo
│   └── loader.ts           - loadConfig, saveConfig, validation
├── feed/
│   ├── types.ts            - FeedEvent, FeedProvider, FeedConfig
│   ├── atom.ts             - generic Atom XML parser
│   ├── gitlab.ts           - GitLabFeedProvider (Atom)
│   ├── github.ts           - GitHubFeedProvider (REST events API)
│   └── index.ts            - createFeedProvider factory
├── narrator/
│   ├── types.ts            - NarrationResult
│   └── narrator.ts         - prompt building, chat API, history tracking
├── providers/
│   ├── types.ts            - ChatProvider, SpeechProvider, configs
│   ├── openai.ts           - OpenAI-compatible chat + TTS
│   ├── claude-code.ts      - shells out to local `claude` CLI
│   ├── gemini.ts           - Google Gemini TTS
│   └── index.ts            - createChatProvider, createSpeechProvider
├── voice/
│   └── voice.ts            - TTS playback (mp3/wav)
└── ui/
    ├── App.tsx             - orchestration, state, effects
    └── components/         - BarChart, BorderBox, ChatLog, HelpBar, ...
```

## Development

```bash
bun run dev        # hot reload
bun test           # unit tests
bun run lint       # biome check
bun run lint:fix   # biome auto-fix
bun run typecheck  # tsc --noEmit
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch conventions and PR rules.

## License

MIT - see [LICENSE](LICENSE).
