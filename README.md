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

> _"Then began I to thrive, and wisdom to get; a word from a word gave words to me, a deed from a deed gave deeds to me."_
> — Hávamál, of the winning of the poet's art

## Features

- **GitHub or GitLab** - polls the REST events API (GitHub) or Atom feeds (GitLab). No webhooks, no inbound network.
- **Event coverage** - pushes, merges, PRs opened/closed, comments, releases, issues, pipelines, packages.
- **Narration backends** - any OpenAI-compatible chat API (OpenAI, OpenRouter, Ollama, LM Studio) or the local `claude` CLI.
- **Speech backends** - any OpenAI-compatible TTS endpoint, cloud or local (Kokoro, Qwen3-TTS), or Google Gemini TTS. Bring your own voice.
- **Terminal dashboard** - Ink-based five-panel UI with author leaderboard, project distribution, live narration feed, and chat history.
- **Catch-up on boot** - fetches everything since the last run and speaks a summary before going live.
- **First-run learning** - scans feed history and prompts you to name each author and project; saved back to config for richer narration context.
- **Keyboard control** - replay, mute, copy narration to clipboard, manual test fetch.
- **Run modes** - `--text-only` (no audio), `--dry-run` (no narration), `--config <path>` for explicit config.
- **Personality** - tune verbosity, tone, and a free-form personality prompt to make it dry, dramatic, or anywhere between.

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
- A **speech provider** for voice - any OpenAI-compatible TTS endpoint (cloud, or a local Kokoro server), or Google Gemini

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

### Recipe 4: Fully local (Ollama + Kokoro, no API keys)

Run [Kokoro-FastAPI](https://github.com/remsky/Kokoro-FastAPI) as a local OpenAI-compatible TTS server. The CPU image is fast enough for live narration; use the `-gpu` image if you have an NVIDIA card.

```bash
docker run -d -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest
```

```yaml
providers:
  chat:
    type: openai
    base_url: http://localhost:11434/v1
    api_key: ollama
    model: llama3.2
  speech:
    type: openai
    base_url: http://localhost:8880/v1
    api_key: not-needed
    model: kokoro
    voice: af_heart
```

List voices with `curl localhost:8880/v1/audio/voices`.

Prefer Qwen3-TTS? [qwen3-tts-server](https://github.com/malaiwah/qwen3-tts-server) exposes the same API on port 8001 with `model: tts-1` and voices such as `ryan`, `serena`, and `vivian`. It needs an NVIDIA GPU with at least 6 GB of VRAM for live narration; on CPU a single line takes around 25 seconds to synthesize.

```bash
docker run -d --gpus all -p 8001:8001 -v qwen3-hf-cache:/root/.cache/huggingface ghcr.io/malaiwah/qwen3-tts-server:latest
```

Any other OpenAI-compatible TTS server works the same way; only `base_url`, `model`, and `voice` change.

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
