import { parseAtomFeed } from "./atom.ts";
import type {
    AtomEntry,
    FeedEvent,
    FeedProvider,
    GitLabFeedConfig,
} from "./types.ts";

interface FetchOptions {
    since?: string | null;
    applyEventFilter?: boolean;
}

export class GitLabFeedProvider implements FeedProvider {
    private baseUrl: string;
    private feedToken: string;
    private feeds: string[];
    private excludeUsers: Set<string>;
    private eventFilter: Set<string>;
    private lastEventTime: string | null = null;

    constructor(config: GitLabFeedConfig) {
        this.baseUrl = config.url.replace(/\/$/, "");
        this.feedToken = config.feed_token;
        this.feeds = config.feeds;
        this.excludeUsers = new Set(
            config.exclude_users.map((u) => u.toLowerCase()),
        );
        this.eventFilter = new Set(config.events.map((e) => e.toLowerCase()));
    }

    async fetchEvents(): Promise<FeedEvent[]> {
        return this.fetch({ since: this.lastEventTime });
    }

    async fetchAllEntries(): Promise<FeedEvent[]> {
        return this.fetch({ applyEventFilter: false });
    }

    async fetchEventsSince(since: string): Promise<FeedEvent[]> {
        return this.fetch({ since });
    }

    private async fetch(opts: FetchOptions = {}): Promise<FeedEvent[]> {
        const { since = null, applyEventFilter = true } = opts;
        const sinceTime = since ? new Date(since).getTime() : 0;
        const allEvents: FeedEvent[] = [];

        for (const feed of this.feeds) {
            const url = `${this.baseUrl}/${feed}.atom?feed_token=${this.feedToken}`;
            const res = await global.fetch(url);

            if (!res.ok) {
                const body = await res.text();
                throw new Error(`GitLab feed ${res.status} (${feed}): ${body}`);
            }

            const xml = await res.text();
            const entries = parseAtomFeed(xml);

            for (const entry of entries) {
                if (sinceTime && new Date(entry.updated).getTime() <= sinceTime)
                    continue;
                if (
                    this.excludeUsers.has(
                        (
                            entry.author.username || entry.author.name
                        ).toLowerCase(),
                    )
                )
                    continue;

                const event = toEvent(entry);
                if (
                    applyEventFilter &&
                    this.eventFilter.size > 0 &&
                    !matchesEventFilter(event, this.eventFilter)
                )
                    continue;

                allEvents.push(event);
            }
        }

        allEvents.sort(
            (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime(),
        );

        if (allEvents.length > 0) {
            const newest = allEvents[allEvents.length - 1]?.created_at;
            if (
                newest &&
                (!this.lastEventTime ||
                    new Date(newest).getTime() >
                        new Date(this.lastEventTime).getTime())
            ) {
                this.lastEventTime = newest;
            }
        }

        return allEvents;
    }
}

function toEvent(entry: AtomEntry): FeedEvent {
    const id = entry.id.split(":").pop() ?? entry.id;
    const authorName = entry.author.name;
    const { action, project, targetType, targetTitle } = parseFeedTitle(
        entry.title,
        authorName,
    );

    return {
        id,
        action,
        author: entry.author.username || authorName,
        project,
        link: entry.link,
        target_type: targetType,
        target_title: targetTitle,
        created_at: entry.updated,
        push_data: action.includes("pushed")
            ? {
                  ref: extractBranch(entry.title),
                  commit_title: extractCommitTitle(entry.rawXml),
                  commit_count: 1,
              }
            : undefined,
        note: action.includes("commented")
            ? {
                  body: entry.summary,
                  noteable_type: targetType ?? "",
              }
            : undefined,
    };
}

export function parseFeedTitle(
    title: string,
    authorName: string,
): {
    action: string;
    project: string;
    targetType: string | null;
    targetTitle: string | null;
} {
    let rest = title;
    if (authorName && rest.startsWith(authorName)) {
        rest = rest.slice(authorName.length).trim();
    }

    const atIdx = rest.lastIndexOf(" at ");
    let action = rest;
    let project = "";

    if (atIdx > 0) {
        action = rest.slice(0, atIdx).trim();
        project = rest.slice(atIdx + 4).trim();
    }

    let targetType: string | null = null;
    let targetTitle: string | null = null;

    if (action.includes("merge request")) {
        targetType = "MergeRequest";
        const mrMatch = action.match(/merge request !?\d+:\s*(.+)/);
        targetTitle = mrMatch?.[1] ?? null;
    } else if (action.includes("issue")) {
        targetType = "Issue";
        const issueMatch = action.match(/issue #?\d+:\s*(.+)/);
        targetTitle = issueMatch?.[1] ?? null;
    }

    return { action, project, targetType, targetTitle };
}

export function extractBranch(title: string): string {
    const match = title.match(/branch (\S+)/);
    return match?.[1] ?? "";
}

export function extractCommitTitle(rawXml: string): string | null {
    const match = rawXml.match(
        /<div class="blockquote"><p[^>]*>(.*?)<\/p><\/div>/,
    );
    return match?.[1]?.trim() ?? null;
}

export function matchesEventFilter(
    e: FeedEvent,
    eventFilter: Set<string>,
): boolean {
    const action = e.action.toLowerCase();

    for (const filter of eventFilter) {
        if (action.includes(filter)) return true;
        if (filter === "pushed" && e.push_data) return true;
        if (filter === "commits" && e.push_data) return true;
        if (filter === "commented" && e.note) return true;
        if (filter === "merged" && action.includes("merge")) return true;
        if (filter === "opened" && action.includes("opened")) return true;
        if (filter === "closed" && action.includes("closed")) return true;
        if (
            filter === "pipelines" &&
            (e.target_type === "Pipeline" || action.includes("pipeline"))
        )
            return true;
        if (filter === "issues" && e.target_type === "Issue") return true;
        if (filter === "merge_requests" && e.target_type === "MergeRequest")
            return true;
        if (
            (filter === "packages" || filter === "registry") &&
            (e.target_type === "Package" || action.includes("publish"))
        )
            return true;
    }

    return false;
}
