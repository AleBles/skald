import type {
    GeminiSpeechProviderConfig,
    SpeechOptions,
    SpeechProvider,
    SpeechResult,
} from "./types.ts";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Gemini TTS via generateContent with AUDIO response modality.
 * Returns 24kHz mono 16-bit PCM (audio/L16), wrapped in a WAV container.
 *
 * Gemini TTS has no `speed` param - the model is steered by natural-language
 * style hints in the input text. We prepend a style instruction when speed != 1.
 */
export class GeminiSpeechProvider implements SpeechProvider {
    private apiKey: string;
    private model: string;

    constructor(config: GeminiSpeechProviderConfig) {
        if (!config.api_key)
            throw new Error("gemini speech provider: api_key is required");
        this.apiKey = config.api_key;
        this.model = config.model;
    }

    async synthesize(opts: SpeechOptions): Promise<SpeechResult> {
        const url = `${GEMINI_BASE}/models/${this.model}:generateContent`;
        const text = styleHint(opts.speed)
            ? `${styleHint(opts.speed)}: ${opts.text}`
            : opts.text;

        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": this.apiKey,
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text }] }],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: opts.voice },
                        },
                    },
                },
            }),
        });

        if (!res.ok) {
            const body = (await res.text()).slice(0, 500);
            throw new Error(`gemini speech ${res.status}: ${body}`);
        }

        const data = (await res.json()) as {
            candidates?: {
                content?: {
                    parts?: {
                        inlineData?: { mimeType?: string; data?: string };
                    }[];
                };
            }[];
        };

        const part = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        if (!part?.data) {
            throw new Error("gemini speech: no audio data in response");
        }

        const pcm = Buffer.from(part.data, "base64");
        const sampleRate = parseSampleRate(part.mimeType) ?? 24000;
        return {
            data: wrapPcmAsWav(pcm, sampleRate),
            format: "wav",
        };
    }
}

function styleHint(speed: number): string | null {
    if (speed >= 1.25) return "Say the following quickly";
    if (speed <= 0.8) return "Say the following slowly";
    return null;
}

function parseSampleRate(mime: string | undefined): number | null {
    if (!mime) return null;
    const match = mime.match(/rate=(\d+)/);
    return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

/** Wrap raw signed 16-bit little-endian mono PCM in a standard WAV container. */
function wrapPcmAsWav(pcm: Buffer, sampleRate: number): Buffer {
    const channels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * channels * bitsPerSample) / 8;
    const blockAlign = (channels * bitsPerSample) / 8;
    const header = Buffer.alloc(44);

    header.write("RIFF", 0);
    header.writeUInt32LE(36 + pcm.length, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write("data", 36);
    header.writeUInt32LE(pcm.length, 40);

    return Buffer.concat([header, pcm]);
}
