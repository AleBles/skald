#!/usr/bin/env bun

import { render } from "ink";
import React from "react";
import { loadConfig } from "./config/loader.ts";
import { createFeedProvider } from "./feed/index.ts";
import { Narrator } from "./narrator/narrator.ts";
import { createChatProvider, createSpeechProvider } from "./providers/index.ts";
import { App } from "./ui/App.tsx";
import { Voice } from "./voice/voice.ts";

function printBanner() {
    console.log(`
   _____ _         _     _
  / ____| |       | |   | |
 | (___ | | ____ _| | __| |
  \\___ \\| |/ / _\` | |/ _\` |
  ____) |   < (_| | | (_| |
 |_____/|_|\\_\\__,_|_|\\__,_|

  AI voice narrator for repo activity
`);
}

function parseArgs(): { config?: string; dryRun: boolean; textOnly: boolean } {
    const args = process.argv.slice(2);
    let config: string | undefined;
    let dryRun = false;
    let textOnly = false;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if ((arg === "--config" || arg === "-c") && args[i + 1]) {
            config = args[++i];
        } else if (arg === "--dry-run") {
            dryRun = true;
        } else if (arg === "--text-only") {
            textOnly = true;
        } else if (arg === "--help" || arg === "-h") {
            printHelp();
            process.exit(0);
        }
    }

    return { config, dryRun, textOnly };
}

function printHelp() {
    console.log(`Usage: skald [options]

Options:
  -c, --config <path>  Path to config file (default: ./skald.yaml)
  --dry-run            Fetch events but skip narration and voice
  --text-only          Narrate but skip voice synthesis (print text only)
  -h, --help           Show this help message

Config file locations (checked in order):
  ./config.yaml
  ./config.yml
  ./skald.yaml
  ./skald.yml
  ~/.config/skald/config.yaml

Environment variables (override config file):
  GITLAB_FEED_TOKEN     GitLab feed token (User Settings > Feed token)
  GITHUB_TOKEN          GitHub Personal Access Token (optional, raises rate limit)
  CHAT_API_KEY          API key for the chat provider
  SPEECH_API_KEY        API key for the speech provider
`);
}

async function main() {
    printBanner();

    const { config: configPath, dryRun, textOnly } = parseArgs();

    const config = await loadConfig(configPath);
    const feed = createFeedProvider(config.feed);
    const narrator = new Narrator(
        config,
        createChatProvider(config.providers.chat),
    );
    const voice = textOnly
        ? null
        : new Voice(config, createSpeechProvider(config.providers.speech));

    render(React.createElement(App, { config, feed, narrator, voice, dryRun }));
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
