import type { FeedConfig } from "../feed/types.ts";
import type {
    ChatProviderConfig,
    SpeechProviderConfig,
} from "../providers/types.ts";

export interface AuthorInfo {
    name: string;
    job_title: string;
}

export interface ProjectInfo {
    name: string;
    description: string;
}

export interface Config {
    configPath: string;
    feed: FeedConfig;
    providers: {
        chat: ChatProviderConfig;
        speech: SpeechProviderConfig;
    };
    narrator: {
        personality: string;
    };
    authors: Record<string, AuthorInfo>;
    projects: Record<string, ProjectInfo>;
    last_message: string | null;
}
