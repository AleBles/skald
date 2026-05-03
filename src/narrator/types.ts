import type { FeedEvent } from "../feed/types.ts";

export interface NarrationResult {
    text: string;
    events: FeedEvent[];
}
