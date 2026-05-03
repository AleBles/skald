import type { AtomEntry } from "./types.ts";

/**
 * Generic Atom feed parser.
 * Not tied to GitLab - reusable for any Atom source.
 */
export function parseAtomFeed(xml: string): AtomEntry[] {
    const entries: AtomEntry[] = [];
    for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
        const entry = parseEntry(match[1] ?? "");
        if (entry) entries.push(entry);
    }
    return entries;
}

function parseEntry(raw: string): AtomEntry | null {
    const title = tag(raw, "title");
    const updated = tag(raw, "updated");
    if (!title || !updated) return null;

    const linkMatch = raw.match(/<link[^>]+href="([^"]+)"/);
    const summaryMatch = raw.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);
    const summary =
        summaryMatch?.[1]
            ?.replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim() ?? "";

    return {
        id: tag(raw, "id"),
        title,
        updated,
        author: {
            name: tag(raw, "name"),
            username: tag(raw, "username"),
        },
        link: linkMatch?.[1] ?? "",
        summary,
        rawXml: raw,
    };
}

type AtomTag = "id" | "title" | "updated" | "name" | "username" | "summary";

function tag(xml: string, name: AtomTag): string {
    const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`));
    return m?.[1]?.trim() ?? "";
}
