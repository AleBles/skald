import { GitHubFeedProvider } from "./github.ts";
import { GitLabFeedProvider } from "./gitlab.ts";
import type { FeedConfig, FeedProvider } from "./types.ts";

export function createFeedProvider(config: FeedConfig): FeedProvider {
    switch (config.type) {
        case "gitlab":
            return new GitLabFeedProvider(config);
        case "github":
            return new GitHubFeedProvider(config);
    }
}

export { GitHubFeedProvider } from "./github.ts";
export { GitLabFeedProvider } from "./gitlab.ts";
export type {
    AtomEntry,
    FeedConfig,
    FeedEvent,
    FeedProvider,
    GitHubFeedConfig,
    GitLabFeedConfig,
} from "./types.ts";
