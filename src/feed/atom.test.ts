import { describe, expect, test } from "bun:test";
import { parseAtomFeed } from "./atom.ts";

const SAMPLE_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Activity</title>
  <entry>
    <id>tag:gitlab.example.com,2026-04-01:123</id>
    <title>John Doe pushed new branch feature-x at my-org/my-project</title>
    <updated>2026-04-01T10:30:00Z</updated>
    <author><name>John Doe</name><username>john.doe</username></author>
    <link href="https://gitlab.example.com/my-org/my-project/-/commits/feature-x"/>
    <summary>Some commit summary</summary>
  </entry>
  <entry>
    <id>tag:gitlab.example.com,2026-04-01:124</id>
    <title>Jane Smith accepted merge request !42: Fix login bug at my-org/my-project</title>
    <updated>2026-04-01T11:00:00Z</updated>
    <author><name>Jane Smith</name><username>jane.smith</username></author>
    <link href="https://gitlab.example.com/my-org/my-project/-/merge_requests/42"/>
  </entry>
</feed>`;

describe("parseAtomFeed", () => {
    test("parses entries from valid Atom XML", () => {
        const entries = parseAtomFeed(SAMPLE_FEED);
        expect(entries).toHaveLength(2);
    });

    test("extracts entry fields correctly", () => {
        const entries = parseAtomFeed(SAMPLE_FEED);
        const first = entries[0];

        expect(first.id).toBe("tag:gitlab.example.com,2026-04-01:123");
        expect(first.title).toBe(
            "John Doe pushed new branch feature-x at my-org/my-project",
        );
        expect(first.updated).toBe("2026-04-01T10:30:00Z");
        expect(first.author.name).toBe("John Doe");
        expect(first.author.username).toBe("john.doe");
        expect(first.link).toBe(
            "https://gitlab.example.com/my-org/my-project/-/commits/feature-x",
        );
        expect(first.summary).toBe("Some commit summary");
    });

    test("extracts link from href attribute", () => {
        const entries = parseAtomFeed(SAMPLE_FEED);
        expect(entries[1].link).toBe(
            "https://gitlab.example.com/my-org/my-project/-/merge_requests/42",
        );
    });

    test("handles empty summary", () => {
        const entries = parseAtomFeed(SAMPLE_FEED);
        expect(entries[1].summary).toBe("");
    });

    test("returns empty array for XML with no entries", () => {
        const xml = `<?xml version="1.0"?><feed></feed>`;
        expect(parseAtomFeed(xml)).toHaveLength(0);
    });

    test("returns empty array for empty string", () => {
        expect(parseAtomFeed("")).toHaveLength(0);
    });

    test("skips entries without title or updated", () => {
        const xml = `<feed>
            <entry><id>1</id></entry>
            <entry><title>Has title</title><updated>2026-01-01T00:00:00Z</updated><author><name>X</name><username>x</username></author></entry>
        </feed>`;
        const entries = parseAtomFeed(xml);
        expect(entries).toHaveLength(1);
        expect(entries[0].title).toBe("Has title");
    });

    test("strips HTML from summary", () => {
        const xml = `<feed><entry>
            <id>1</id>
            <title>Test</title>
            <updated>2026-01-01T00:00:00Z</updated>
            <author><name>X</name><username>x</username></author>
            <summary type="html"><p>Hello <strong>world</strong></p></summary>
        </entry></feed>`;
        const entries = parseAtomFeed(xml);
        expect(entries[0].summary).toBe("Hello world");
    });
});
