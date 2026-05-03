import type {
    ChatMessage,
    ChatOptions,
    ChatProvider,
    ClaudeCodeProviderConfig,
} from "./types.ts";

/**
 * Uses the local `claude` CLI in headless (-p) mode to generate chat responses.
 * Ignores temperature / max_tokens / penalties - those are API-level params
 * the CLI doesn't expose. Good enough for narration.
 */
export class ClaudeCodeChatProvider implements ChatProvider {
    private model?: string;

    constructor(config: ClaudeCodeProviderConfig) {
        this.model = config.model;
    }

    async chat(opts: ChatOptions): Promise<string> {
        const systemPrompt = opts.messages
            .filter((m) => m.role === "system")
            .map((m) => m.content)
            .join("\n\n");

        const turns = opts.messages.filter((m) => m.role !== "system");
        const prompt = flattenTurns(turns);

        // Note: no --bare. --bare disables OAuth/keychain auth (only reads
        // ANTHROPIC_API_KEY). Passing --system-prompt already replaces the
        // default system prompt so CLAUDE.md/memory/env-info don't leak in.
        // --permission-mode dontAsk prevents the CLI from hanging on
        // interactive tool-permission prompts when there's no TTY.
        const args = [
            "-p",
            prompt,
            "--output-format",
            "text",
            "--permission-mode",
            "dontAsk",
            "--disable-slash-commands",
        ];
        if (systemPrompt) args.push("--system-prompt", systemPrompt);
        if (this.model) args.push("--model", this.model);

        const proc = Bun.spawn(["claude", ...args], {
            stdin: "ignore",
            stdout: "pipe",
            stderr: "pipe",
        });

        const timeoutMs = 120_000;
        const timer = setTimeout(() => proc.kill(), timeoutMs);

        try {
            const [stdout, stderr, exitCode] = await Promise.all([
                new Response(proc.stdout).text(),
                new Response(proc.stderr).text(),
                proc.exited,
            ]);

            if (exitCode !== 0) {
                const detail = [stderr.trim(), stdout.trim()]
                    .filter(Boolean)
                    .join(" | ")
                    .slice(0, 500);
                throw new Error(
                    `claude-code chat failed (exit ${exitCode}): ${detail || `no output (timed out after ${timeoutMs / 1000}s?)`}`,
                );
            }

            return stdout.trim();
        } finally {
            clearTimeout(timer);
        }
    }
}

function flattenTurns(turns: ChatMessage[]): string {
    if (turns.length === 0) return "";
    if (turns.length === 1) return turns[0]?.content ?? "";

    const formatted = turns.map(
        (m) => `[${m.role.toUpperCase()}]\n${m.content}`,
    );
    const history = formatted.slice(0, -1).join("\n\n");
    const last = formatted.at(-1) ?? "";
    return `Previous conversation:\n\n${history}\n\n${last}`;
}
