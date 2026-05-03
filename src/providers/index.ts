import { ClaudeCodeChatProvider } from "./claude-code.ts";
import { GeminiSpeechProvider } from "./gemini.ts";
import { OpenAIChatProvider, OpenAISpeechProvider } from "./openai.ts";
import type {
    ChatProvider,
    ChatProviderConfig,
    SpeechProvider,
    SpeechProviderConfig,
} from "./types.ts";

export function createChatProvider(config: ChatProviderConfig): ChatProvider {
    switch (config.type) {
        case "openai":
            return new OpenAIChatProvider(config);
        case "claude-code":
            return new ClaudeCodeChatProvider(config);
    }
}

export function createSpeechProvider(
    config: SpeechProviderConfig,
): SpeechProvider {
    switch (config.type) {
        case "openai":
            return new OpenAISpeechProvider(config);
        case "gemini":
            return new GeminiSpeechProvider(config);
    }
}

export { ClaudeCodeChatProvider } from "./claude-code.ts";
export { GeminiSpeechProvider } from "./gemini.ts";
export { OpenAIChatProvider, OpenAISpeechProvider } from "./openai.ts";
export type {
    AudioFormat,
    ChatMessage,
    ChatOptions,
    ChatProvider,
    ChatProviderConfig,
    ClaudeCodeProviderConfig,
    GeminiSpeechProviderConfig,
    OpenAIChatProviderConfig,
    OpenAISpeechProviderConfig,
    SpeechOptions,
    SpeechProvider,
    SpeechProviderConfig,
    SpeechResult,
} from "./types.ts";
