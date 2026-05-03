import type { Config } from "../config/types.ts";
import type { FeedEvent } from "../feed/types.ts";
import type { ChatMessage, ChatProvider } from "../providers/types.ts";
import type { NarrationResult } from "./types.ts";

export class Narrator {
    private chat: ChatProvider;
    private personality: string;
    private config: Config;
    private history: string[] = [];

    constructor(config: Config, chat: ChatProvider) {
        this.chat = chat;
        this.personality = config.narrator.personality;
        this.config = config;
    }

    async narrate(events: FeedEvent[]): Promise<NarrationResult> {
        if (events.length === 0) return { text: "", events: [] };

        const eventSummary = describeEvents(events);
        const context = this.buildContext(events);

        const historyHint =
            this.history.length > 0
                ? `\n\nIMPORTANT - you said these recently. Do NOT repeat similar phrasing, sentence structures, or openers. Vary your style, vocabulary, and rhythm:\n${this.history.map((h, i) => `[${i + 1}] "${h}"`).join("\n")}`
                : "";

        const systemPrompt = `You are a ${this.personality} narrating developer activity on a code repository in real-time.

Your job:
- Narrate the events as if you're a live commentator
- Keep it concise - 1-3 sentences per batch of events
- Reference developers by their display name
- Be entertaining but informative
- Never use markdown, emojis, or formatting - this will be read aloud
- Never use possessive apostrophes like "John's" - say "the work of John" or "from John" instead, because the TTS engine mispronounces them
- Speak naturally as if talking to an audience

CRITICAL style rules - your narrations are becoming repetitive. You MUST:
- NEVER start with a person name or title. Start with the action, an observation, a metaphor, or a reaction
- NEVER use the pattern "X has just done Y" - find completely different framings
- Mix up sentence lengths wildly - sometimes one punchy sentence, sometimes a flowing observation
- Use metaphors, analogies, dramatic pauses, understatement, or dry humor
- Occasionally address the audience directly, react emotionally, or editorialize
- Think like a nature documentary, sports commentary, or radio DJ - not a git log
- Each narration must feel like it could NOT have been written by the same prompt as the previous one${context}${historyHint}`;

        const messages: ChatMessage[] = [
            { role: "system", content: systemPrompt },
        ];
        for (const past of this.history) {
            messages.push({ role: "assistant", content: past });
            messages.push({
                role: "user",
                content:
                    "New events just came in. Narrate them differently from what you said before.",
            });
        }
        messages.push({
            role: "user",
            content: `Narrate these recent repository events:\n\n${eventSummary}`,
        });

        const text = await this.chat.chat({
            messages,
            maxTokens: 300,
            temperature: 1.0,
            presencePenalty: 0.6,
            frequencyPenalty: 0.4,
        });

        if (text) {
            this.history.push(text);
            if (this.history.length > 6) this.history.shift();
        }

        return { text, events };
    }

    async summarize(
        events: FeedEvent[],
        downtime: string,
    ): Promise<NarrationResult> {
        if (events.length === 0) return { text: "", events: [] };

        const eventSummary = describeEvents(events);
        const context = this.buildContext(events);

        const systemPrompt = `You are a ${this.personality} giving a catch-up summary of what happened while you were away.

Your job:
- Summarize what happened during the downtime (${downtime})
- Group activity by person or project - don't list every event individually
- Highlight the most notable activity
- Keep it to 3-5 sentences max
- Reference developers by their display name
- Be entertaining but informative
- Never use markdown, emojis, or formatting - this will be read aloud
- Never use possessive apostrophes like "John's" - say "the work of John" or "from John" instead, because the TTS engine mispronounces them
- Speak naturally as if welcoming the audience back${context}`;

        const messages: ChatMessage[] = [
            { role: "system", content: systemPrompt },
            {
                role: "user",
                content: `Here's what happened while we were offline (${events.length} events over ${downtime}):\n\n${eventSummary}`,
            },
        ];

        const text = await this.chat.chat({
            messages,
            maxTokens: 500,
            temperature: 0.9,
            presencePenalty: 0.6,
            frequencyPenalty: 0.4,
        });
        return { text, events };
    }

    private buildContext(events: FeedEvent[]): string {
        const lines: string[] = [];

        const authors = new Set(events.map((e) => e.author));
        for (const username of authors) {
            const info = this.config.authors[username];
            if (info) {
                const parts = [`${info.name} (username: ${username})`];
                if (info.job_title) parts.push(`job: ${info.job_title}`);
                lines.push(`- Author: ${parts.join(", ")}`);
            }
        }

        const projects = new Set(events.map((e) => e.project).filter(Boolean));
        for (const path of projects) {
            const info = this.config.projects[path];
            if (info) {
                const parts = [`${info.name} (${path})`];
                if (info.description) parts.push(info.description);
                lines.push(`- Project: ${parts.join(" - ")}`);
            }
        }

        return lines.length > 0
            ? `\n\nContext about the people and projects:\n${lines.join("\n")}`
            : "";
    }
}

/**
 * Describe a batch of events, collapsing consecutive pushes from the same
 * author to the same branch into a single line with summed commit counts.
 * Other events fall through to describeEvent() unchanged.
 */
export function describeEvents(events: FeedEvent[]): string {
    const lines: string[] = [];
    let i = 0;
    while (i < events.length) {
        const head = events[i];
        if (!head) break;
        if (!head.push_data) {
            lines.push(describeEvent(head));
            i++;
            continue;
        }

        const author = head.author;
        const branch = head.push_data.ref;
        let j = i + 1;
        while (j < events.length) {
            const next = events[j];
            if (
                !next?.push_data ||
                next.author !== author ||
                next.push_data.ref !== branch
            ) {
                break;
            }
            j++;
        }

        if (j === i + 1) {
            lines.push(describeEvent(head));
        } else {
            const group = events.slice(i, j);
            const total = group.reduce(
                (sum, e) => sum + (e.push_data?.commit_count ?? 0),
                0,
            );
            const titles = group
                .map((e) => `"${e.push_data?.commit_title ?? "no message"}"`)
                .join(", ");
            lines.push(
                `${author} pushed ${total} commit(s) to ${branch}: ${titles}`,
            );
        }
        i = j;
    }
    return lines.join("\n");
}

export function describeEvent(e: FeedEvent): string {
    if (e.push_data) {
        const commits = e.push_data.commit_count;
        const branch = e.push_data.ref;
        const title = e.push_data.commit_title ?? "no message";
        return `${e.author} pushed ${commits} commit(s) to ${branch}: "${title}"`;
    }

    if (e.note) {
        return `${e.author} commented on ${e.note.noteable_type}: "${e.note.body.slice(0, 100)}"`;
    }

    if (e.target_type === "MergeRequest") {
        return `${e.author} ${e.action} merge request: "${e.target_title}"`;
    }

    if (e.target_type === "Issue") {
        return `${e.author} ${e.action} issue: "${e.target_title}"`;
    }

    return `${e.author} ${e.action} ${e.target_type ?? "something"}: "${e.target_title ?? ""}"`;
}
