import type { FeedEvent, FeedProvider, GitHubFeedConfig } from "./types.ts";

const API_BASE = "https://api.github.com";
const API_VERSION = "2022-11-28";
const PAGE_SIZE = 100;

interface FetchOptions {
    since?: string | null;
    applyEventFilter?: boolean;
}

interface RawGitHubEvent {
    id: string;
    type: string;
    actor: { login: string; display_login?: string };
    repo: { name: string };
    payload: Record<string, unknown>;
    public: boolean;
    created_at: string;
}

export class GitHubFeedProvider implements FeedProvider {
    private token: string;
    private feeds: string[];
    private excludeUsers: Set<string>;
    private eventFilter: Set<string>;
    private lastEventTime: string | null = null;

    constructor(config: GitHubFeedConfig) {
        this.token = config.token;
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
            const url = `${API_BASE}/${normalizeFeedPath(feed)}?per_page=${PAGE_SIZE}`;
            const res = await global.fetch(url, { headers: this.headers() });

            if (!res.ok) {
                const body = (await res.text()).slice(0, 500);
                throw new Error(`GitHub feed ${res.status} (${feed}): ${body}`);
            }

            const raw = (await res.json()) as RawGitHubEvent[];
            for (const item of raw) {
                if (
                    sinceTime &&
                    new Date(item.created_at).getTime() <= sinceTime
                )
                    continue;
                const login = item.actor.login.toLowerCase();
                if (this.excludeUsers.has(login)) continue;

                const event = toEvent(item);
                if (!event) continue;
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

    private headers(): Record<string, string> {
        const h: Record<string, string> = {
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": API_VERSION,
            "User-Agent": "skald",
        };
        if (this.token) h.Authorization = `Bearer ${this.token}`;
        return h;
    }
}

/**
 * Accept feed paths in either short form (`octocat`, `anthropics/claude-code`)
 * or fully qualified (`users/octocat`, `repos/owner/repo`, `orgs/anthropics`).
 * Two segments → repo, one segment → user.
 */
function normalizeFeedPath(feed: string): string {
    if (
        feed.startsWith("users/") ||
        feed.startsWith("orgs/") ||
        feed.startsWith("repos/")
    ) {
        return `${feed}/events`;
    }
    const segments = feed.split("/").filter(Boolean);
    if (segments.length === 2) return `repos/${feed}/events`;
    return `users/${feed}/events`;
}

export function toEvent(raw: RawGitHubEvent): FeedEvent | null {
    const author = raw.actor.display_login ?? raw.actor.login;
    const project = raw.repo.name;
    const link = `https://github.com/${project}`;
    const base = {
        id: raw.id,
        author,
        project,
        link,
        created_at: raw.created_at,
    };

    switch (raw.type) {
        case "PushEvent": {
            const p = raw.payload as {
                ref?: string;
                commits?: { message: string }[];
                size?: number;
            };
            const branch = (p.ref ?? "").replace(/^refs\/heads\//, "");
            const firstCommit = p.commits?.[0]?.message?.split("\n")[0] ?? null;
            return {
                ...base,
                action: `pushed to branch ${branch}`,
                target_type: null,
                target_title: null,
                push_data: {
                    ref: branch,
                    commit_title: firstCommit,
                    commit_count: p.size ?? p.commits?.length ?? 0,
                },
            };
        }
        case "PullRequestEvent": {
            const p = raw.payload as {
                action: string;
                pull_request: {
                    title: string;
                    number: number;
                    merged?: boolean;
                    html_url?: string;
                };
            };
            const verb =
                p.action === "closed" && p.pull_request.merged
                    ? "merged"
                    : p.action;
            return {
                ...base,
                action: `${verb} merge request !${p.pull_request.number}: ${p.pull_request.title}`,
                target_type: "MergeRequest",
                target_title: p.pull_request.title,
                link: p.pull_request.html_url ?? link,
            };
        }
        case "IssuesEvent": {
            const p = raw.payload as {
                action: string;
                issue: { title: string; number: number; html_url?: string };
            };
            return {
                ...base,
                action: `${p.action} issue #${p.issue.number}: ${p.issue.title}`,
                target_type: "Issue",
                target_title: p.issue.title,
                link: p.issue.html_url ?? link,
            };
        }
        case "IssueCommentEvent":
        case "PullRequestReviewCommentEvent": {
            const p = raw.payload as {
                comment: { body: string; html_url?: string };
                issue?: { title: string; number: number };
                pull_request?: { title: string; number: number };
            };
            const target = p.issue ?? p.pull_request;
            const noteableType = p.issue ? "Issue" : "MergeRequest";
            return {
                ...base,
                action: `commented on ${noteableType.toLowerCase()}`,
                target_type: noteableType,
                target_title: target?.title ?? null,
                link: p.comment.html_url ?? link,
                note: {
                    body: p.comment.body ?? "",
                    noteable_type: noteableType,
                },
            };
        }
        case "CreateEvent": {
            const p = raw.payload as {
                ref_type: string;
                ref?: string | null;
            };
            return {
                ...base,
                action:
                    p.ref_type === "repository"
                        ? "created repository"
                        : `created ${p.ref_type} ${p.ref ?? ""}`.trim(),
                target_type: null,
                target_title: null,
            };
        }
        case "DeleteEvent": {
            const p = raw.payload as { ref_type: string; ref: string };
            return {
                ...base,
                action: `deleted ${p.ref_type} ${p.ref}`,
                target_type: null,
                target_title: null,
            };
        }
        case "ReleaseEvent": {
            const p = raw.payload as {
                action: string;
                release: { tag_name: string; name?: string; html_url?: string };
            };
            const title = p.release.name || p.release.tag_name;
            return {
                ...base,
                action: `${p.action} release ${title}`,
                target_type: "Release",
                target_title: title,
                link: p.release.html_url ?? link,
            };
        }
        default:
            return null;
    }
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
        if (filter === "issues" && e.target_type === "Issue") return true;
        if (filter === "merge_requests" && e.target_type === "MergeRequest")
            return true;
        if (filter === "released" && e.target_type === "Release") return true;
    }
    return false;
}
