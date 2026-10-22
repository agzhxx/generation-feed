// The Higgsfield API as M5 uses it: the endpoint each model calls, the JSON body each job sends,
// and a small client (submit, status, download). Endpoints and fields are from the model pages
// and API references on open.higgsfield.ai, checked on 2026-10-16.
import { z } from "zod";
import { IMAGE_MODELS, type AspectRatio, type ImageModel, type VideoModel } from "./higgsfield-models.ts";
import type { ImageJob, VideoJob } from "./prompts.ts";

export const API_ORIGIN = "https://api.higgsfield.ai";

export const ENDPOINTS: Record<ImageModel | VideoModel, string> = {
  "soul-2-1080p": "higgsfield-ai/soul/v2/standard",
  "soul-2-720p": "higgsfield-ai/soul/v2/standard",
  "grok-imagine-2-2k": "xai/grok-imagine-image-2.0",
  "kling-2.5-standard": "kling-video/v2.5-turbo/standard/image-to-video",
  "kling-2.5-pro": "kling-video/v2.5-turbo/pro/image-to-video",
  "cinema-studio-4-480p": "higgsfield/cinema-studio/4.0",
};

/** The body for an image job. `inputs` are the URLs of its reference images, in order. */
export function imageRequest(job: ImageJob, inputs: readonly string[]): Record<string, unknown> {
  switch (job.model) {
    case "soul-2-1080p":
    case "soul-2-720p":
      // The API rewrites prompts by default; ours go out as written, because the Feed shows
      // each prompt as what made its image.
      return {
        prompt: job.prompt,
        aspect_ratio: job.aspectRatio,
        resolution: IMAGE_MODELS[job.model].resolution,
        batch_size: 1,
        enhance_prompt: false,
        ...(job.seed === undefined ? {} : { seed: job.seed }),
      };
    case "grok-imagine-2-2k": {
      const body: Record<string, unknown> = { prompt: job.prompt, aspect_ratio: job.aspectRatio, quality: "medium", resolution: "2k" };
      if (inputs.length > 0) body.image_urls = [...inputs];
      return body;
    }
    default:
      return job.model satisfies never;
  }
}

/** The body for a video job; `input` is the URL of the image it starts from. */
export function videoRequest(job: VideoJob, input: string, sourceRatio: AspectRatio): Record<string, unknown> {
  switch (job.model) {
    case "kling-2.5-standard":
    case "kling-2.5-pro":
      // Kling takes the frame's shape from the image.
      return { prompt: job.prompt, image_url: input, duration: job.durationSec };
    case "cinema-studio-4-480p":
      // The preset performs the move; `<<<image_1>>>` in the prompt is image_urls[0]. Audio is
      // on by default and the Feed's previews are muted, so it is switched off.
      return {
        prompt: job.prompt,
        image_urls: [input],
        camera_movement: job.cameraPreset,
        pacing: "single-shot",
        generate_audio: false,
        duration: job.durationSec,
        resolution: "480p",
        aspect_ratio: sourceRatio,
      };
    default:
      return job.model satisfies never;
  }
}

const requestStatusSchema = z.object({
  status: z.enum(["queued", "in_progress", "nsfw", "failed", "completed", "canceled"]),
  request_id: z.string(),
  error: z.string().nullish(),
  images: z.array(z.object({ url: z.string() })).optional(),
  video: z.object({ url: z.string() }).optional(),
});

export type RequestStatus = z.infer<typeof requestStatusSchema>;
export type RequestState = RequestStatus["status"];

export const FINAL_STATES: ReadonlySet<RequestState> = new Set(["nsfw", "failed", "completed", "canceled"]);

/** An HTTP error from the API. `retry`: worth trying again later (busy, rate limited, down). */
export class HiggsfieldError extends Error {
  // Plain fields, not constructor parameter properties: Node's type stripping can't run those.
  readonly httpStatus: number;
  readonly retry: boolean;

  constructor(message: string, httpStatus: number, retry: boolean) {
    super(message);
    this.name = "HiggsfieldError";
    this.httpStatus = httpStatus;
    this.retry = retry;
  }
}

export interface Download {
  bytes: Uint8Array;
  contentType: string;
}

export interface HiggsfieldApi {
  submit(endpoint: string, body: Record<string, unknown>, idempotencyKey: string): Promise<RequestStatus>;
  status(requestId: string): Promise<RequestStatus>;
  download(url: string): Promise<Download>;
}

/** `credentials` is the "key id:key secret" pair from the Higgsfield console. */
export function createApi(credentials: string): HiggsfieldApi {
  const auth = { Authorization: `Key ${credentials}` };

  async function call(url: string, init: RequestInit): Promise<RequestStatus> {
    const response = await fetch(url, init);
    if (response.ok) return requestStatusSchema.parse(await response.json());
    const text = await response.text();
    // "Maximum number of concurrent requests" comes back as a 400: wait for a slot.
    const busy = response.status === 400 && /concurrent/i.test(text);
    const retry = busy || response.status === 429 || response.status >= 500;
    throw new HiggsfieldError(`HTTP ${response.status}: ${text.slice(0, 300)}`, response.status, retry);
  }

  return {
    submit: (endpoint, body, idempotencyKey) =>
      call(`${API_ORIGIN}/${endpoint}`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(body),
      }),
    status: (requestId) => call(`${API_ORIGIN}/requests/${requestId}/status`, { headers: auth }),
    async download(url) {
      const response = await fetch(url);
      if (!response.ok) throw new HiggsfieldError(`Download failed: HTTP ${response.status}`, response.status, response.status >= 500);
      return { bytes: new Uint8Array(await response.arrayBuffer()), contentType: response.headers.get("content-type") ?? "" };
    },
  };
}
