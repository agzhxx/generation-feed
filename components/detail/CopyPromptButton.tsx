"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/icons";

/** How long "Copied" shows before the button reads "Copy prompt" again. */
const RESET_MS = 2000;

type CopyState = "idle" | "copied" | "failed";

const LABELS: Record<CopyState, string> = { idle: "Copy prompt", copied: "Copied", failed: "Couldn't copy" };
const ANNOUNCEMENTS: Record<CopyState, string> = {
  idle: "",
  copied: "Prompt copied",
  failed: "Couldn't copy the prompt",
};

/** Copies the prompt to the clipboard and says so, on screen and to screen readers. */
export function CopyPromptButton({ prompt }: { prompt: string }) {
  const [state, setState] = useState<CopyState>("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), RESET_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setState("copied");
    } catch {
      // No clipboard access (an old browser, or permission denied).
      setState("failed");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void copy()}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-control bg-accent px-3 text-sm font-medium text-on-accent outline-focus transition-colors duration-(--dur-fast) hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 lg:h-control lg:w-auto lg:self-start"
      >
        {state === "copied" ? <CheckIcon /> : <CopyIcon />}
        {LABELS[state]}
      </button>
      <span role="status" className="sr-only">
        {ANNOUNCEMENTS[state]}
      </span>
    </>
  );
}
