export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface ChatOptions {
    messages: ChatMessage[];
    maxTokens?: number;
    temperature?: number;
    presencePenalty?: number;
    frequencyPenalty?: number;
}

export interface ChatProvider {
    chat(opts: ChatOptions): Promise<string>;
}

export interface SpeechOptions {
    text: string;
    voice: string;
    speed: number;
}

export type AudioFormat = "mp3" | "wav";

export interface SpeechResult {
    data: Buffer;
    format: AudioFormat;
}

export interface SpeechProvider {
    synthesize(opts: SpeechOptions): Promise<SpeechResult>;
}

// -- Chat provider configs --

export interface OpenAIChatProviderConfig {
    type: "openai";
    base_url: string;
    api_key: string;
    model: string;
}

export interface ClaudeCodeProviderConfig {
    type: "claude-code";
    model?: string;
}

export type ChatProviderConfig =
    | OpenAIChatProviderConfig
    | ClaudeCodeProviderConfig;

// -- Speech provider configs --

export interface OpenAISpeechProviderConfig {
    type: "openai";
    base_url: string;
    api_key: string;
    model: string;
    voice: string;
    speed: number;
}

export interface GeminiSpeechProviderConfig {
    type: "gemini";
    api_key: string;
    model: string;
    voice: string;
    speed: number;
}

export type SpeechProviderConfig =
    | OpenAISpeechProviderConfig
    | GeminiSpeechProviderConfig;
