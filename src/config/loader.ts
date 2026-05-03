import { parse, stringify } from "yaml";
import type { FeedConfig } from "../feed/types.ts";
import type {
    ChatProviderConfig,
    SpeechProviderConfig,
} from "../providers/types.ts";
import type { AuthorInfo, Config, ProjectInfo } from "./types.ts";

const DEFAULT_CONFIG_PATHS = [
    "./config.yaml",
    "./config.yml",
    "./skald.yaml",
    "./skald.yml",
    "~/.config/skald/config.yaml",
];

const DEFAULT_PERSONALITY = "monotone british nature documentary narrator";

export function resolveHome(path: string): string {
    if (path.startsWith("~/")) {
        const home = process.env.HOME;
        if (!home) throw new Error("HOME is not set, cannot resolve ~/");
        return path.replace("~", home);
    }
    return path;
}

export function parseInterval(value: string | number): number {
    if (typeof value === "number") return value;
    const match = value.match(/^(\d+)(s|m|h)?$/);
    if (!match) return 30;
    const num = parseInt(match[1] ?? "30", 10);
    switch (match[2]) {
        case "m":
            return num * 60;
        case "h":
            return num * 3600;
        default:
            return num;
    }
}

function env(key: string): string {
    return process.env[key] ?? "";
}

export function normalizeList(raw: unknown): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(String);
    return [String(raw)];
}

function parseMap<T>(
    raw: unknown,
    transform: (key: string, val: unknown) => T,
): Record<string, T> {
    const result: Record<string, T> = {};
    if (raw && typeof raw === "object") {
        for (const [key, val] of Object.entries(
            raw as Record<string, unknown>,
        )) {
            result[key] = transform(key, val);
        }
    }
    return result;
}

function parseFeed(raw: unknown): FeedConfig {
    const r = (raw ?? {}) as Record<string, unknown>;
    const type = (r.type as string) ?? "gitlab";
    const feeds = normalizeList(r.feeds ?? r.feed);
    const exclude_users = normalizeList(r.exclude_users);
    const events = normalizeList(r.events);
    const poll_interval = parseInterval((r.poll_interval as string) ?? 30);

    if (type === "github") {
        return {
            type: "github",
            token: (r.token as string) ?? env("GITHUB_TOKEN"),
            feeds,
            exclude_users,
            events,
            poll_interval,
        };
    }

    if (type === "gitlab") {
        return {
            type: "gitlab",
            url: (r.url as string) ?? "https://gitlab.com",
            feed_token:
                (r["feed-token"] as string) ??
                (r.feed_token as string) ??
                env("GITLAB_FEED_TOKEN"),
            feeds,
            exclude_users,
            events,
            poll_interval,
        };
    }

    throw new Error(
        `Unknown feed.type "${type}" (expected "gitlab" or "github")`,
    );
}

function parseChatProvider(raw: unknown): ChatProviderConfig {
    const r = (raw ?? {}) as Record<string, unknown>;
    const type = (r.type as string) ?? "openai";

    if (type === "claude-code") {
        return {
            type: "claude-code",
            model: r.model as string | undefined,
        };
    }

    return {
        type: "openai",
        base_url: (r.base_url as string) ?? "",
        api_key: (r.api_key as string) ?? env("CHAT_API_KEY"),
        model: (r.model as string) ?? "",
    };
}

function parseSpeechProvider(raw: unknown): SpeechProviderConfig {
    const r = (raw ?? {}) as Record<string, unknown>;
    const type = (r.type as string) ?? "openai";

    if (type === "gemini") {
        return {
            type: "gemini",
            api_key: (r.api_key as string) ?? env("SPEECH_API_KEY"),
            model: (r.model as string) ?? "gemini-2.5-flash-preview-tts",
            voice: (r.voice as string) ?? "Kore",
            speed: (r.speed as number) ?? 1.0,
        };
    }

    return {
        type: "openai",
        base_url: (r.base_url as string) ?? "",
        api_key: (r.api_key as string) ?? env("SPEECH_API_KEY"),
        model: (r.model as string) ?? "",
        voice: (r.voice as string) ?? "",
        speed: (r.speed as number) ?? 1.0,
    };
}

export async function loadConfig(configPath?: string): Promise<Config> {
    let filePath: string | undefined;

    if (configPath) {
        filePath = resolveHome(configPath);
    } else {
        for (const p of DEFAULT_CONFIG_PATHS) {
            const resolved = resolveHome(p);
            if (await Bun.file(resolved).exists()) {
                filePath = resolved;
                break;
            }
        }
    }

    if (!filePath) {
        throw new Error(
            "No config file found. Create skald.yaml or pass --config <path>",
        );
    }

    const raw = await Bun.file(filePath).text();
    const parsed = parse(raw);

    const config: Config = {
        configPath: filePath,
        feed: parseFeed(parsed.feed ?? parsed.gitlab),
        providers: {
            chat: parseChatProvider(parsed.providers?.chat),
            speech: parseSpeechProvider(parsed.providers?.speech),
        },
        narrator: {
            personality: parsed.narrator?.personality ?? DEFAULT_PERSONALITY,
        },
        authors: parseMap<AuthorInfo>(parsed.authors, (key, val) => {
            const v = val as Record<string, string> | null;
            return { name: v?.name ?? key, job_title: v?.job_title ?? "" };
        }),
        projects: parseMap<ProjectInfo>(parsed.projects, (key, val) => {
            const v = val as Record<string, string> | null;
            return { name: v?.name ?? key, description: v?.description ?? "" };
        }),
        last_message: parsed.last_message ?? null,
    };

    validate(config);
    return config;
}

let writeLock: Promise<void> = Promise.resolve();

export function saveConfig(config: Config): Promise<void> {
    writeLock = writeLock.then(() => doSaveConfig(config)).catch(() => {});
    return writeLock;
}

async function doSaveConfig(config: Config): Promise<void> {
    const raw = await Bun.file(config.configPath).text();
    const parsed = parse(raw) ?? {};

    if (Object.keys(config.authors).length > 0) {
        parsed.authors = {};
        for (const [key, val] of Object.entries(config.authors)) {
            parsed.authors[key] = { name: val.name, job_title: val.job_title };
        }
    }

    if (Object.keys(config.projects).length > 0) {
        parsed.projects = {};
        for (const [key, val] of Object.entries(config.projects)) {
            parsed.projects[key] = {
                name: val.name,
                description: val.description,
            };
        }
    }

    if (config.last_message) {
        parsed.last_message = config.last_message;
    }

    await Bun.write(config.configPath, stringify(parsed, { lineWidth: 0 }));
}

function validate(config: Config): void {
    const { feed, providers } = config;

    if (feed.feeds.length === 0)
        throw new Error("feed.feeds is required (at least one feed path)");

    if (feed.type === "gitlab") {
        const isLocal =
            feed.url.startsWith("http://localhost") ||
            feed.url.startsWith("http://127.0.0.1");
        if (!feed.url.startsWith("https://") && !isLocal)
            throw new Error(
                "feed.url must use HTTPS (or http://localhost for local dev)",
            );
        if (!feed.feed_token)
            throw new Error(
                "feed.feed-token is required for type: gitlab (or set GITLAB_FEED_TOKEN)",
            );
    }

    if (providers.chat.type === "openai") {
        if (!providers.chat.base_url)
            throw new Error(
                "providers.chat.base_url is required for type: openai",
            );
        if (!providers.chat.api_key)
            throw new Error(
                "providers.chat.api_key is required for type: openai (or set CHAT_API_KEY)",
            );
        if (!providers.chat.model)
            throw new Error(
                "providers.chat.model is required for type: openai",
            );
    }

    if (providers.speech.type === "openai") {
        if (!providers.speech.base_url)
            throw new Error(
                "providers.speech.base_url is required for type: openai",
            );
        if (!providers.speech.api_key)
            throw new Error(
                "providers.speech.api_key is required for type: openai (or set SPEECH_API_KEY)",
            );
        if (!providers.speech.model)
            throw new Error(
                "providers.speech.model is required for type: openai",
            );
        if (!providers.speech.voice)
            throw new Error(
                "providers.speech.voice is required for type: openai",
            );
    }

    if (providers.speech.type === "gemini" && !providers.speech.api_key) {
        throw new Error(
            "providers.speech.api_key is required for type: gemini (or set SPEECH_API_KEY)",
        );
    }
}
