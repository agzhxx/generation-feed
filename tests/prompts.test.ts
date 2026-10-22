import { describe, expect, test } from "vitest";
import { IMAGE_MODELS, VIDEO_MODELS } from "@/scripts/higgsfield-models";
import { ALMATY_TOPICS, STORY_HERO, WORLD_THEMES } from "@/scripts/prompt-lists";
import { PICKED_VIDEOS } from "@/scripts/picks";
import { buildMediaPlan, COLLECTIONS, pickedVideoPrompt, PICKS, RATIO_MIX, USED_BY, type ImageJob } from "@/scripts/prompts";

const plan = buildMediaPlan();
const ofCollection = (collection: string) => plan.images.filter((job) => job.collection === collection);
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Words that would break the content rules: children, nudity, real brands and studios, imitation. */
const FORBIDDEN =
  /\b(child|children|kids?|boys?|girls?|teens?|teenagers?|bab(y|ies)|toddlers?|nude|naked|sexy|lingerie|nike|adidas|puma|coca-cola|pepsi|starbucks|iphone|tesla|porsche|ferrari|bmw|mercedes|harley|vespa|disney|pixar|ghibli|marvel|pokemon|lego|star wars|in the style of)\b/i;

describe("the M5 media plan", () => {
  test("makes 1,000 images and 100 videos, split as the media plan says", () => {
    const counts = Object.fromEntries(COLLECTIONS.map((collection) => [collection, ofCollection(collection).length]));
    expect(counts).toEqual({
      worlds: 680,
      "camera-moves": 4,
      story: 16,
      pairs: 60,
      ratios: 40,
      almaty: 120,
      textures: 20,
      ads: 60,
    });
    const picked = plan.picks.reduce((sum, pick) => sum + pick.count, 0);
    expect(plan.videos.length + picked).toBe(100);
  });

  test("is the same on every build, so re-runs skip finished jobs", () => {
    expect(buildMediaPlan()).toEqual(plan);
  });

  test("every job has its own key", () => {
    const keys = [...plan.images, ...plan.videos].map((job) => job.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("prompts repeat only inside a ratio group", () => {
    const byPrompt = new Map<string, ImageJob[]>();
    for (const job of plan.images) byPrompt.set(job.prompt, [...(byPrompt.get(job.prompt) ?? []), job]);
    for (const jobs of byPrompt.values()) {
      if (jobs.length === 1) continue;
      const groups = new Set(jobs.map((job) => job.ratioGroup));
      expect(groups.size, jobs.map((job) => job.key).join(", ")).toBe(1);
      expect(groups.has(undefined)).toBe(false);
    }
  });

  test("follows the content rules and keeps ratios out of the prompt text", () => {
    for (const prompt of [...plan.images, ...plan.videos].map((job) => job.prompt)) {
      expect(prompt).not.toMatch(FORBIDDEN);
      expect(prompt).not.toMatch(/\b\d{1,2}:\d{1,2}\b/);
      expect(prompt.length).toBeGreaterThan(40);
      expect(prompt.length).toBeLessThan(500);
    }
  });

  test("never names text, signs or logos, not even to forbid them: naming them tends to draw them", () => {
    for (const job of [...plan.images, ...plan.videos]) {
      expect(job.prompt, job.key).not.toMatch(/\b(text|lettering|labels?|logos?|badges?|signs?|signage|writing|(un)?readable)\b/i);
    }
  });

  test("every image uses a ratio its model accepts and the number of input images it needs", () => {
    for (const job of plan.images) {
      const model = IMAGE_MODELS[job.model];
      expect(model.ratios, job.key).toContain(job.aspectRatio);
      const [min, max] = model.references;
      const count = job.references?.length ?? 0;
      expect(count, job.key).toBeGreaterThanOrEqual(min);
      expect(count, job.key).toBeLessThanOrEqual(max);
    }
  });

  test("an image is made after every image it starts from", () => {
    const position = new Map(plan.images.map((job, i) => [job.key, i]));
    plan.images.forEach((job, i) => {
      for (const reference of job.references ?? []) {
        expect(position.get(reference), `${job.key} → ${reference}`).toBeLessThan(i);
      }
    });
  });

  test("people in portraits are always adults", () => {
    const portraits = WORLD_THEMES.find((theme) => theme.slug === "portraits");
    for (const subject of portraits?.subjects ?? []) {
      expect(subject).toMatch(/\b(in (his|her) (twenties|thirties|forties|fifties|sixties)|older|adult)\b/);
    }
  });

  test("worlds uses each subject once or twice and follows the shape mix", () => {
    const worlds = ofCollection("worlds");
    const subjects = WORLD_THEMES.flatMap((theme) => theme.subjects);
    expect(new Set(subjects).size).toBe(subjects.length);
    for (const subject of subjects) {
      const uses = worlds.filter((job) => job.prompt.startsWith(`${capitalize(subject)},`));
      expect(uses.length, subject).toBeGreaterThanOrEqual(1);
      expect(uses.length, subject).toBeLessThanOrEqual(2);
    }
    for (const [ratio, percent] of RATIO_MIX) {
      expect(worlds.filter((job) => job.aspectRatio === ratio).length).toBe((680 * percent) / 100);
    }
  });

  test("worlds prompts don't contradict themselves", () => {
    for (const theme of WORLD_THEMES) {
      // The studio look only where every subject could sit in a studio.
      if (theme.styles.includes("studio")) expect(theme.slug).toBe("food-drink");
    }
    for (const { prompt } of ofCollection("worlds")) {
      expect(prompt).not.toMatch(/flat lay/);
      if (/\b(night|midnight|blue hour|moon|moons|dusk)\b/.test(prompt)) expect(prompt).not.toMatch(/bleached|high-key/);
    }
    const bigScenes = ["underwater", "surreal"].flatMap((slug) => ofCollection("worlds").filter((job) => WORLD_THEMES.find((t) => t.slug === slug)?.subjects.some((s) => job.prompt.startsWith(`${capitalize(s)},`))));
    for (const { prompt } of bigScenes) expect(prompt).not.toMatch(/close-up/);
  });

  test("almaty: 35 topics, 3 or 4 images each", () => {
    const almaty = ofCollection("almaty");
    expect(ALMATY_TOPICS).toHaveLength(35);
    for (const topic of ALMATY_TOPICS) {
      const uses = almaty.filter((job) => job.prompt.startsWith(`${capitalize(topic.text)},`)).length;
      expect(uses, topic.text).toBeGreaterThanOrEqual(3);
      expect(uses, topic.text).toBeLessThanOrEqual(4);
    }
  });

  test("every video animates an image of its own collection", () => {
    const images = new Map(plan.images.map((job) => [job.key, job]));
    for (const video of plan.videos) {
      expect(images.get(video.source)?.collection, video.key).toBe(video.collection);
    }
  });

  test("camera moves: the preset scene shows all 8 moves, the 3 Kling scenes the 4 Kling showed", () => {
    const videos = plan.videos.filter((job) => job.collection === "camera-moves");
    const allMoves = ["dolly-in", "dolly-out", "orbit", "crane-up", "crash-zoom", "whip-pan", "dolly-zoom", "bullet-time"];
    const presetOnly = ["orbit", "crash-zoom", "dolly-zoom", "bullet-time"];
    expect(videos).toHaveLength(8 + 3 * 4);
    const presetScenes = new Set<string>();
    for (const scene of ofCollection("camera-moves")) {
      const clips = videos.filter((job) => job.source === scene.key);
      const moves = clips.map((job) => job.cameraMove);
      expect(scene.aspectRatio).toBe("16:9");
      const models = new Set(clips.map((job) => job.model));
      expect(models.size, scene.key).toBe(1);
      if (models.has("cinema-studio-4-480p")) {
        presetScenes.add(scene.key);
        expect(moves).toEqual(allMoves);
        for (const clip of clips) {
          expect(clip.cameraPreset, clip.key).toBeDefined();
          expect(clip.prompt).toContain("<<<image_1>>>");
        }
      } else {
        expect(models).toEqual(new Set(["kling-2.5-standard"]));
        expect(moves).toEqual(allMoves.filter((move) => !presetOnly.includes(move)));
        expect(clips.every((job) => job.cameraPreset === undefined)).toBe(true);
      }
    }
    expect(presetScenes.size).toBe(1);
    for (const { prompt } of videos) expect(prompt).not.toMatch(/full circle|FPV|lands on/);
  });

  test("story: a hero sheet and 15 shots in order, the robot made from the hero every time", () => {
    const shots = ofCollection("story");
    expect(shots.map((job) => job.shot)).toEqual([
      "00-hero",
      ...Array.from({ length: 15 }, (_, i) => expect.stringMatching(new RegExp(`^${String(i + 1).padStart(2, "0")}-`))),
    ]);
    expect(shots.every((job) => job.model === "grok-imagine-2-2k")).toBe(true);
    expect(shots[0].references).toBeUndefined();
    for (const shot of shots.slice(1)) {
      expect(shot.aspectRatio).toBe("16:9");
      // Time and weather in every shot, so the cut stays continuous.
      expect(shot.prompt).toMatch(/\b(at dusk|night)\b/);
      if (shot.prompt.includes("the robot")) {
        expect(shot.prompt).toContain(`The robot is ${STORY_HERO}`);
        expect(shot.references).toEqual(["story-00-hero"]);
      } else {
        expect(shot.references).toBeUndefined();
      }
    }
    expect(plan.videos.filter((job) => job.collection === "story").every((job) => job.model === "kling-2.5-pro")).toBe(true);
  });

  test("pairs: Grok redraws each draft as its final and re-lights each day image as its night image", () => {
    const pairs = ofCollection("pairs");
    const variants = (variant: string) => pairs.filter((job) => job.variant === variant);
    expect(variants("draft")).toHaveLength(25);
    expect(variants("final")).toHaveLength(25);
    expect(variants("day")).toHaveLength(5);
    expect(variants("night")).toHaveLength(5);
    expect(variants("draft").every((job) => job.model === "soul-2-720p")).toBe(true);
    expect(variants("day").every((job) => job.model === "soul-2-1080p")).toBe(true);
    for (const [variant, from] of [
      ["final", "draft"],
      ["night", "day"],
    ] as const) {
      for (const job of variants(variant)) {
        expect(job.model).toBe("grok-imagine-2-2k");
        expect(job.prompt).toMatch(/Keep the composition, framing and every object of the reference image exactly where they are$/);
        expect(job.references).toEqual([`pairs-${job.pairId}-${from}`]);
      }
    }
    expect(new Set(pairs.map((job) => job.pairId)).size).toBe(30);
  });

  test("ratios: 10 scenes, each in 1:1, 3:4, 9:16 and 16:9", () => {
    const ratios = ofCollection("ratios");
    const groups = new Set(ratios.map((job) => job.ratioGroup));
    expect(groups.size).toBe(10);
    for (const group of groups) {
      expect(ratios.filter((job) => job.ratioGroup === group).map((job) => job.aspectRatio)).toEqual(["1:1", "3:4", "9:16", "16:9"]);
    }
  });

  test("ads: every image starts from its product's hero packshot; group shots from all four", () => {
    const ads = ofCollection("ads");
    const heroes = ads.filter((job) => job.key.endsWith("-hero"));
    expect(heroes).toHaveLength(4);
    for (const hero of heroes) expect(hero.references).toBeUndefined();
    for (const job of ads.filter((job) => !job.key.endsWith("-hero"))) {
      if (job.key.startsWith("ads-group-")) {
        expect(job.references).toEqual(heroes.map((hero) => hero.key));
      } else {
        const product = job.key.split("-")[1];
        expect(job.references, job.key).toEqual([`ads-${product}-hero`]);
      }
    }
    expect(ads.filter((job) => job.key.startsWith("ads-group-"))).toHaveLength(8);
  });

  test("picked videos: every count met; worlds and almaty motion written after picking, textures and ads as planned", () => {
    expect(plan.picks).toEqual([]);
    expect(new Set(PICKED_VIDEOS.map((pick) => pick.key)).size).toBe(PICKED_VIDEOS.length);
    const images = new Map(plan.images.map((job) => [job.key, job]));
    for (const target of PICKS) {
      const clips = plan.videos.filter((job) => job.collection === target.collection && job.key === `${job.source}-clip`);
      expect(clips, target.collection).toHaveLength(target.count);
      for (const clip of clips) {
        const image = images.get(clip.source)!;
        expect(clip.model).toBe(target.model);
        if (target.collection === "worlds" || target.collection === "almaty") {
          expect(image.motion, clip.key).toBeUndefined();
          expect(PICKED_VIDEOS.find((pick) => pick.key === image.key)?.motion, clip.key).toBeDefined();
        } else {
          expect(clip.prompt).toBe(pickedVideoPrompt(image));
        }
      }
    }
    // Ads videos are 16:9, and most move sideways across the frame (Batch Reframe needs it).
    const setups = ofCollection("ads").filter((job) => job.motion !== undefined);
    expect(setups.every((job) => job.aspectRatio === "16:9")).toBe(true);
    const sideways = setups.filter((job) => /left to right|right to left|left edge/.test(job.motion ?? ""));
    expect(sideways.length * 2).toBeGreaterThanOrEqual(setups.length);
    for (const job of ofCollection("textures")) expect(job.motion).not.toMatch(/seamless loop/);
  });

  test("every model has a price, and every collection lists the projects that use it", () => {
    for (const job of plan.images) expect(IMAGE_MODELS[job.model].sale).toBeGreaterThan(0);
    for (const job of plan.videos) expect(VIDEO_MODELS[job.model].sale).toBeGreaterThan(0);
    for (const collection of COLLECTIONS) expect(USED_BY[collection].length).toBeGreaterThan(0);
  });
});
