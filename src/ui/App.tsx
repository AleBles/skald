import { Box, useInput } from "ink";
import { useCallback, useEffect, useRef, useState } from "react";
import pkg from "../../package.json";
import { saveConfig } from "../config/loader.ts";
import type { Config } from "../config/types.ts";
import type { FeedEvent, FeedProvider } from "../feed/types.ts";
import type { Narrator } from "../narrator/narrator.ts";
import type { Voice } from "../voice/voice.ts";
import {
    ChatLog,
    createLogEntry,
    createNarrationLines,
    type LogEntry,
    listNarrationIds,
    wrapText,
} from "./components/ChatLog.tsx";
import { HelpBar } from "./components/HelpBar.tsx";
import { Setup } from "./components/Setup.tsx";
import { StatsPanel } from "./components/StatsPanel.tsx";
import { TitleBar } from "./components/TitleBar.tsx";
import { useTerminalSize } from "./useTerminalSize.ts";

interface AppProps {
    config: Config;
    feed: FeedProvider;
    narrator: Narrator;
    voice: Voice | null;
    dryRun: boolean;
}

export interface PromptItem {
    kind: "author" | "project";
    key: string;
}

interface StatEntry {
    name: string;
    events: number;
    lastAction: string;
}

function latestTimestamp(events: FeedEvent[]): string {
    return events.reduce(
        (max, e) => (e.created_at > max ? e.created_at : max),
        events[0]?.created_at,
    );
}

function timestamp(): string {
    return new Date().toLocaleTimeString();
}

const CLIPBOARD_CANDIDATES: Array<[string, string[]]> = [
    ["wl-copy", []],
    ["xclip", ["-selection", "clipboard"]],
    ["xsel", ["-b", "-i"]],
    ["pbcopy", []],
    ["clip.exe", []],
];

/** Try each known clipboard tool in order. Returns the name used, or null. */
async function copyToClipboard(text: string): Promise<string | null> {
    for (const [cmd, args] of CLIPBOARD_CANDIDATES) {
        try {
            const proc = Bun.spawn([cmd, ...args], {
                stdin: "pipe",
                stdout: "ignore",
                stderr: "ignore",
            });
            proc.stdin.write(text);
            proc.stdin.end();
            const exitCode = await proc.exited;
            if (exitCode === 0) return cmd;
        } catch {
            // binary not found or spawn failed - try next
        }
    }
    return null;
}

function formatDowntime(since: string): string {
    const ms = Date.now() - new Date(since).getTime();
    const minutes = Math.floor(ms / 60_000);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""}`;
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? "s" : ""}`;
}

export function App({ config, feed, narrator, voice, dryRun }: AppProps) {
    const { columns, rows } = useTerminalSize();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [started, setStarted] = useState(false);
    const [promptQueue, setPromptQueue] = useState<PromptItem[]>([]);
    const [isInitialSetup, setIsInitialSetup] = useState(false);
    const [authorStats, setAuthorStats] = useState<Record<string, StatEntry>>(
        {},
    );
    const [projectStats, setProjectStats] = useState<Record<string, StatEntry>>(
        {},
    );
    const [muted, setMuted] = useState(false);
    const [activeNarrationId, setActiveNarrationId] = useState<number | null>(
        null,
    );
    const mutedRef = useRef(false);
    const pendingKeys = useRef(new Set<string>());
    const booted = useRef(false);
    const lastNarration = useRef<string>("");

    // New incoming log → reset selection and snap back to the bottom
    const lastLogId = logs.at(-1)?.id ?? -1;
    useEffect(() => {
        setActiveNarrationId(null);
    }, [lastLogId]);

    const narrationIds = listNarrationIds(logs);
    const effectiveNarrationId =
        activeNarrationId !== null && narrationIds.includes(activeNarrationId)
            ? activeNarrationId
            : null;

    const addLog = useCallback(
        (text: string, dim = false, truncate = false) => {
            const lines = text
                .split("\n")
                .map((line) => createLogEntry(line, dim, truncate));
            setLogs((prev) => [...prev, ...lines].slice(-200));
        },
        [],
    );

    const addNarration = useCallback(
        (text: string) => {
            lastNarration.current = text;
            // padding (2 border + 2 paddingX) = 4 chars
            const chatWidth = columns - 4;
            const wrapped = wrapText(`  "${text}"`, chatWidth);
            const lines = [
                createLogEntry("", false, false, false),
                ...createNarrationLines(text, wrapped),
                createLogEntry("", false, false, false),
            ];
            setLogs((prev) => [...prev, ...lines].slice(-200));
        },
        [columns],
    );

    const trackStats = useCallback(
        (events: FeedEvent[]) => {
            setAuthorStats((prev) => {
                const next = { ...prev };
                for (const e of events) {
                    const name = config.authors[e.author]?.name ?? e.author;
                    const existing = next[e.author];
                    next[e.author] = {
                        name,
                        events: (existing?.events ?? 0) + 1,
                        lastAction: e.action,
                    };
                }
                return next;
            });
            setProjectStats((prev) => {
                const next = { ...prev };
                for (const e of events) {
                    if (!e.project) continue;
                    const name = config.projects[e.project]?.name ?? e.project;
                    const existing = next[e.project];
                    next[e.project] = {
                        name,
                        events: (existing?.events ?? 0) + 1,
                        lastAction: e.action,
                    };
                }
                return next;
            });
        },

        [],
    );

    const enqueueUnknowns = useCallback(
        (events: FeedEvent[]) => {
            const items: PromptItem[] = [];
            for (const e of events) {
                if (
                    e.author &&
                    !config.authors[e.author] &&
                    !pendingKeys.current.has(`author:${e.author}`)
                ) {
                    pendingKeys.current.add(`author:${e.author}`);
                    items.push({ kind: "author", key: e.author });
                }
                if (
                    e.project &&
                    !config.projects[e.project] &&
                    !pendingKeys.current.has(`project:${e.project}`)
                ) {
                    pendingKeys.current.add(`project:${e.project}`);
                    items.push({ kind: "project", key: e.project });
                }
            }
            if (items.length > 0) setPromptQueue((prev) => [...prev, ...items]);
        },

        [],
    );

    const narrateAndSpeak = useCallback(
        async (events: FeedEvent[]) => {
            const narration = await narrator.narrate(events);
            if (!narration.text) return;
            addNarration(narration.text);
            if (voice && !mutedRef.current) await voice.speak(narration.text);
            config.last_message = latestTimestamp(events);
            await saveConfig(config);
        },

        [addLog],
    );

    // Initial boot - must only run once
    useEffect(() => {
        if (booted.current) return;
        booted.current = true;

        (async () => {
            const isFirstBoot =
                Object.keys(config.authors).length === 0 &&
                Object.keys(config.projects).length === 0;

            try {
                if (isFirstBoot) {
                    addLog(
                        "First run - fetching feed history for initial setup...",
                    );
                    const history = await feed.fetchAllEntries();
                    addLog(`Scanned ${history.length} event(s) from feed.`);
                    trackStats(history);

                    const items: PromptItem[] = [];
                    for (const e of history) {
                        if (
                            e.author &&
                            !config.authors[e.author] &&
                            !pendingKeys.current.has(`author:${e.author}`)
                        ) {
                            pendingKeys.current.add(`author:${e.author}`);
                            items.push({ kind: "author", key: e.author });
                        }
                        if (
                            e.project &&
                            !config.projects[e.project] &&
                            !pendingKeys.current.has(`project:${e.project}`)
                        ) {
                            pendingKeys.current.add(`project:${e.project}`);
                            items.push({ kind: "project", key: e.project });
                        }
                    }

                    if (items.length > 0) {
                        setPromptQueue(items);
                        setIsInitialSetup(true);
                        return;
                    }
                } else if (config.last_message) {
                    addLog("Checking what happened since last session...");
                    const missed = await feed.fetchEventsSince(
                        config.last_message,
                    );

                    if (missed.length > 0) {
                        const downtime = formatDowntime(config.last_message);
                        addLog(
                            `${missed.length} event(s) happened during ${downtime} since last narration.`,
                        );
                        trackStats(missed);
                        enqueueUnknowns(missed);

                        addLog("Generating catch-up summary...");
                        try {
                            const summary = await narrator.summarize(
                                missed,
                                downtime,
                            );
                            if (summary.text) {
                                addNarration(summary.text);
                                if (voice && !mutedRef.current)
                                    await voice.speak(summary.text);
                            }
                        } catch (err) {
                            addLog(
                                `Catch-up summary failed: ${err instanceof Error ? err.message : err}`,
                                true,
                            );
                        }
                        config.last_message = latestTimestamp(missed);
                        await saveConfig(config);
                    } else {
                        addLog("Nothing happened while we were away.");
                    }
                } else {
                    const baseline = await feed.fetchEvents();
                    if (baseline.length > 0) {
                        config.last_message = latestTimestamp(baseline);
                        await saveConfig(config);
                    }
                }

                addLog("Baseline set. Waiting for new events...");
                setStarted(true);
            } catch (err) {
                addLog(
                    `Boot failed: ${err instanceof Error ? err.message : err}`,
                );
            }
        })();
    }, []);

    // Poll loop
    useEffect(() => {
        if (!started) return;

        const interval = setInterval(async () => {
            try {
                const events = await feed.fetchEvents();
                if (events.length === 0) return;

                addLog(
                    `[${timestamp()}] ${events.length} new event(s) detected`,
                );
                for (const e of events) {
                    const authorName =
                        config.authors[e.author]?.name ?? e.author;
                    const projectName =
                        config.projects[e.project]?.name ?? e.project;
                    const link = e.link
                        ? `\x1b]8;;${e.link}\x1b\\[link]\x1b]8;;\x1b\\`
                        : "";
                    addLog(
                        `  ${authorName} - ${projectName} ${link}`,
                        true,
                        true,
                    );
                }
                trackStats(events);
                enqueueUnknowns(events);

                if (dryRun) {
                    for (const e of events) {
                        addLog(
                            `  - ${e.author} ${e.action} ${e.target_type ?? ""} ${e.target_title ?? ""}`,
                        );
                    }
                    return;
                }

                await narrateAndSpeak(events);
            } catch (err) {
                addLog(
                    `[${timestamp()}] Error: ${err instanceof Error ? err.message : err}`,
                );
            }
        }, config.feed.poll_interval * 1000);

        return () => clearInterval(interval);
    }, [started]);

    const handlePromptDone = useCallback(async () => {
        await saveConfig(config);
        pendingKeys.current.clear();

        if (isInitialSetup) {
            addLog("Setup complete. Config saved.");
            addLog("Baseline set. Waiting for new events...");
            setIsInitialSetup(false);
            setStarted(true);
        } else {
            addLog("Config updated.", true);
        }

        setPromptQueue([]);
    }, [isInitialSetup, addLog]);

    useInput(
        (input, key) => {
            if (promptQueue.length > 0) return;

            if (key.upArrow) {
                if (narrationIds.length === 0) return;
                setActiveNarrationId((prev) => {
                    if (prev === null)
                        return narrationIds[narrationIds.length - 1];
                    const idx = narrationIds.indexOf(prev);
                    if (idx <= 0) return narrationIds[0];
                    return narrationIds[idx - 1];
                });
                return;
            }

            if (key.downArrow) {
                setActiveNarrationId((prev) => {
                    if (prev === null) return null;
                    const idx = narrationIds.indexOf(prev);
                    if (idx === -1 || idx >= narrationIds.length - 1)
                        return null;
                    return narrationIds[idx + 1];
                });
                return;
            }

            if (input === "m" || input === "M") {
                const next = !mutedRef.current;
                mutedRef.current = next;
                setMuted(next);
                if (next && voice) voice.stop();
                addLog(next ? "Muted" : "Unmuted", true);
            } else if (input === "t" || input === "T") {
                (async () => {
                    addLog("Test: fetching latest event...", true);
                    try {
                        const all = await feed.fetchAllEntries();
                        if (all.length === 0) {
                            addLog("Test: no events found in feed.", true);
                            return;
                        }
                        const event = all.at(-1);
                        if (!event) {
                            addLog("Test: no events found in feed.", true);
                            return;
                        }
                        const authorName =
                            config.authors[event.author]?.name ?? event.author;
                        const projectName =
                            config.projects[event.project]?.name ??
                            event.project;
                        addLog(
                            `Test: ${authorName} - ${projectName} - ${event.action}`,
                            true,
                        );
                        const narration = await narrator.narrate([event]);
                        if (!narration.text) {
                            addLog("Test: narrator returned empty text.", true);
                            return;
                        }
                        addNarration(narration.text);
                        if (voice && !mutedRef.current)
                            await voice.speak(narration.text);
                        addLog("Test complete.", true);
                    } catch (err) {
                        addLog(
                            `Test error: ${err instanceof Error ? err.message : err}`,
                            true,
                        );
                    }
                })();
            } else if (input === "c" || input === "C") {
                const activeEntry =
                    effectiveNarrationId !== null
                        ? logs.find(
                              (l) => l.narrationId === effectiveNarrationId,
                          )
                        : null;
                const toCopy =
                    activeEntry?.narrationText ?? lastNarration.current;
                if (!toCopy) {
                    addLog("Nothing to copy.", true);
                } else {
                    (async () => {
                        const used = await copyToClipboard(toCopy);
                        if (!used) {
                            addLog(
                                "No clipboard tool found. Install one of: wl-clipboard, xclip, xsel.",
                                true,
                            );
                            return;
                        }
                        addLog(
                            activeEntry
                                ? `Copied narration to clipboard (${used}).`
                                : `Copied last narration to clipboard (${used}).`,
                            true,
                        );
                    })();
                }
            } else if (input === "r" || input === "R") {
                voice?.replay();
            } else if (input === "p" || input === "P") {
                voice?.stop();
            }
        },
        { isActive: promptQueue.length === 0 },
    );

    const showingPrompt = promptQueue.length > 0;
    const authorEntries = Object.values(authorStats).sort(
        (a, b) => b.events - a.events,
    );
    const projectEntries = Object.values(projectStats).sort(
        (a, b) => b.events - a.events,
    );

    // Layout
    const panelBoxOverhead = 4;
    const halfWidth = Math.floor(columns / 2);
    const barWidth = Math.max(5, halfWidth - panelBoxOverhead - 20);
    const statsMaxRows = Math.max(3, Math.min(8, Math.floor((rows - 8) * 0.3)));
    const chatHeight = Math.max(5, rows - statsMaxRows - 8);
    const chatLogLines = Math.max(3, chatHeight - 2);

    return (
        <Box
            flexDirection="column"
            width={columns}
            height={rows}
            overflow="hidden"
        >
            <TitleBar
                width={columns}
                config={config}
                mode={dryRun ? "dry-run" : voice ? "full" : "text-only"}
                version={pkg.version}
            />

            <Box width={columns} height={statsMaxRows + 2} flexShrink={0}>
                <StatsPanel
                    title="Authors"
                    color="yellow"
                    entries={authorEntries}
                    width={halfWidth}
                    maxRows={statsMaxRows}
                    barWidth={barWidth}
                />
                <StatsPanel
                    title="Projects"
                    color="red"
                    entries={projectEntries}
                    width={columns - halfWidth}
                    maxRows={statsMaxRows}
                    barWidth={barWidth}
                />
            </Box>

            <ChatLog
                logs={logs}
                width={columns}
                height={chatHeight}
                visibleLines={chatLogLines}
                activeNarrationId={effectiveNarrationId}
            />

            {showingPrompt ? (
                <Setup
                    config={config}
                    queue={promptQueue}
                    onDone={handlePromptDone}
                    isInitial={isInitialSetup}
                />
            ) : (
                <HelpBar
                    width={columns}
                    muted={muted}
                    started={started}
                    pollInterval={config.feed.poll_interval}
                />
            )}
        </Box>
    );
}
