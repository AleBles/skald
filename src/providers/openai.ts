import type {
    ChatOptions,
    ChatProvider,
    OpenAIChatProviderConfig,
    OpenAISpeechProviderConfig,
    SpeechOptions,
    SpeechProvider,
    SpeechResult,
} from "./types.ts";

function joinUrl(base: string, path: string): string {
    return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export class OpenAIChatProvider implements ChatProvider {
    private baseUrl: string;
    private apiKey: string;
    private model: string;

    constructor(config: OpenAIChatProviderConfig) {
        if (!config.base_url)
            throw new Error("openai chat provider: base_url is required");
        if (!config.api_key)
            throw new Error("openai chat provider: api_key is required");
        this.baseUrl = config.base_url;
        this.apiKey = config.api_key;
        this.model = config.model;
    }

    async chat(opts: ChatOptions): Promise<string> {
        const res = await fetch(joinUrl(this.baseUrl, "chat/completions"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                messages: opts.messages,
                max_tokens: opts.maxTokens,
                temperature: opts.temperature,
                presence_penalty: opts.presencePenalty,
                frequency_penalty: opts.frequencyPenalty,
            }),
        });

        if (!res.ok) {
            const body = (await res.text()).slice(0, 500);
            throw new Error(`openai chat ${res.status}: ${body}`);
        }

        const data = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
        };
        return (data.choices?.[0]?.message?.content ?? "").trim();
    }
}

export class OpenAISpeechProvider implements SpeechProvider {
    private baseUrl: string;
    private apiKey: string;
    private model: string;

    constructor(config: OpenAISpeechProviderConfig) {
        if (!config.base_url)
            throw new Error("openai speech provider: base_url is required");
        if (!config.api_key)
            throw new Error("openai speech provider: api_key is required");
        this.baseUrl = config.base_url;
        this.apiKey = config.api_key;
        this.model = config.model;
    }

    async synthesize(opts: SpeechOptions): Promise<SpeechResult> {
        const res = await fetch(joinUrl(this.baseUrl, "audio/speech"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                input: opts.text,
                voice: opts.voice,
                response_format: "mp3",
                speed: opts.speed,
            }),
        });

        if (!res.ok) {
            const body = (await res.text()).slice(0, 500);
            throw new Error(`openai speech ${res.status}: ${body}`);
        }

        return {
            data: Buffer.from(await res.arrayBuffer()),
            format: "mp3",
        };
    }
}
