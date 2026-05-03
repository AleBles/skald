import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Config } from "../config/types.ts";
import type { SpeechProvider, SpeechResult } from "../providers/types.ts";

export class Voice {
    private speech: SpeechProvider;
    private voice: string;
    private speed: number;
    private lastAudio: SpeechResult | null = null;
    private currentProc: ReturnType<typeof Bun.spawn> | null = null;

    constructor(config: Config, speech: SpeechProvider) {
        this.speech = speech;
        this.voice = config.providers.speech.voice;
        this.speed = config.providers.speech.speed;
    }

    async speak(text: string): Promise<void> {
        if (!text) return;

        const result = await this.speech.synthesize({
            text,
            voice: this.voice,
            speed: this.speed,
        });
        this.lastAudio = result;
        await this.play(result);
    }

    async replay(): Promise<void> {
        if (!this.lastAudio) return;
        await this.play(this.lastAudio);
    }

    stop(): void {
        if (this.currentProc) {
            this.currentProc.kill();
            this.currentProc = null;
        }
    }

    private async play(audio: SpeechResult): Promise<void> {
        const tmpFile = join(
            tmpdir(),
            `git-narrator-${crypto.randomUUID()}.${audio.format}`,
        );

        try {
            await Bun.write(tmpFile, audio.data);

            const player = await this.findPlayer();
            this.currentProc = Bun.spawn(
                [player, ...this.playerArgs(player, tmpFile)],
                {
                    stdout: "ignore",
                    stderr: "ignore",
                },
            );
            await this.currentProc.exited;
            this.currentProc = null;
        } finally {
            await unlink(tmpFile).catch(() => {});
        }
    }

    private async findPlayer(): Promise<string> {
        const players = ["mpv", "ffplay", "play", "aplay", "afplay"];

        for (const player of players) {
            const proc = Bun.spawn(["which", player], {
                stdout: "ignore",
                stderr: "ignore",
            });
            const code = await proc.exited;
            if (code === 0) return player;
        }

        throw new Error(
            "No audio player found. Install one of: mpv, ffplay, sox (play), aplay",
        );
    }

    private playerArgs(player: string, file: string): string[] {
        switch (player) {
            case "mpv":
                return ["--no-video", "--really-quiet", file];
            case "ffplay":
                return ["-nodisp", "-autoexit", "-loglevel", "quiet", file];
            default:
                return [file];
        }
    }
}
