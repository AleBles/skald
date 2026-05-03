import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig } from "../src/config/loader.ts";
import { createSpeechProvider } from "../src/providers/index.ts";

const LINES = [
    "A modest push lands on the audio-playback branch. Three commits, no fuss, no announcement.",
    "And here, surfacing at last from weeks of patient work — pull request forty-two. The voice synthesis fix, finally up for review.",
    "An issue surfaces. Memory, it transpires, leaks from the narrator on long runs. A familiar pattern. Now, a tracked one.",
    "Quietly, forty-two slips into main. The fix takes its place. The voice is whole again.",
    "Version one point two zero — released into the wild. A few stones on the cairn. Onward.",
];

async function main(): Promise<void> {
    const config = await loadConfig();
    const provider = createSpeechProvider(config.providers.speech);
    const outDir = resolve(import.meta.dir, "..", "site", "audio");
    await mkdir(outDir, { recursive: true });

    for (let i = 0; i < LINES.length; i++) {
        const text = LINES[i] as string;
        const filename = `${String(i + 1).padStart(2, "0")}.mp3`;
        const out = resolve(outDir, filename);
        process.stdout.write(`[${i + 1}/${LINES.length}] ${filename} ... `);
        const result = await provider.synthesize({
            text,
            voice: config.providers.speech.voice,
            speed: config.providers.speech.speed,
        });
        await Bun.write(out, result.data);
        process.stdout.write(`${result.data.byteLength} bytes\n`);
    }
    console.log(`Wrote ${LINES.length} files to ${outDir}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
