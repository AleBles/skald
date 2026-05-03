export interface AtomEntry {
    id: string;
    title: string;
    updated: string;
    author: { name: string; username: string };
    link: string;
    summary: string;
    rawXml: string;
}

export interface FeedEvent {
    id: string;
    action: string;
    author: string;
    project: string;
    link: string;
    target_type: string | null;
    target_title: string | null;
    created_at: string;
    push_data?: {
        ref: string;
        commit_title: string | null;
        commit_count: number;
    };
    note?: {
        body: string;
        noteable_type: string;
    };
}

export interface FeedProvider {
    fetchEvents(): Promise<FeedEvent[]>;
    fetchAllEntries(): Promise<FeedEvent[]>;
    fetchEventsSince(since: string): Promise<FeedEvent[]>;
}

interface BaseFeedConfig {
    feeds: string[];
    exclude_users: string[];
    poll_interval: number;
    events: string[];
}

export interface GitLabFeedConfig extends BaseFeedConfig {
    type: "gitlab";
    url: string;
    feed_token: string;
}

export interface GitHubFeedConfig extends BaseFeedConfig {
    type: "github";
    token: string;
}

export type FeedConfig = GitLabFeedConfig | GitHubFeedConfig;
