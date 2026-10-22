"use client";

import { useLayoutEffect, useRef, type KeyboardEvent } from "react";
import type { MediaItem } from "@/lib/manifest";
import { MEDIA_ORIGINS } from "@/lib/media-urls";
import { MediaDetail } from "./MediaDetail";

/** Arrow keys inside these already mean something (moving a cursor, seeking a video). */
const OWN_KEYS = "input, textarea, select, video, [contenteditable]";

export interface DetailOverlayProps {
  item: MediaItem;
  /** Place in the feed's current (filtered) order, from 1, and the number of matching items. */
  position: number;
  total: number;
  previous: MediaItem | null;
  next: MediaItem | null;
  lowSrc?: string;
  autoPlay: boolean;
  transitionName: string;
  onStep: (item: MediaItem) => void;
  onClose: () => void;
}

/**
 * The detail view over the feed (spec 4.8): a native modal <dialog>, so the browser traps focus
 * inside it, makes the page behind it inert and turns Esc into a "cancel" event. The feed stays
 * mounted underneath. Loaded as its own chunk when the page is idle.
 */
export function DetailOverlay({
  item,
  position,
  total,
  previous,
  next,
  lowSrc,
  autoPlay,
  transitionName,
  onStep,
  onClose,
}: DetailOverlayProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // A layout effect, so the dialog is open in the same frame as the view transition's new state.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    dialog.showModal();
    // Phones and wide screens each have their own Close button; focus the one that shows.
    const closeButtons = [...dialog.querySelectorAll<HTMLElement>("[data-close]")];
    closeButtons.find((button) => button.checkVisibility())?.focus();
    return () => dialog.close();
  }, []);

  function onKeyDown(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.target instanceof Element && event.target.closest(OWN_KEYS) !== null) return;
    const target = event.key === "ArrowLeft" ? previous : event.key === "ArrowRight" ? next : null;
    if (target === null) return;
    event.preventDefault();
    onStep(target);
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label={item.kind === "video" ? "Video details" : "Image details"}
      // Esc (and Android's back gesture) ask to close: the feed closes through history.back(),
      // so the address and the history stay in step.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={onKeyDown}
      // Phones scroll the text over the page, so the backdrop there is solid.
      className="m-0 size-full max-h-none max-w-none overflow-hidden border-0 bg-backdrop p-0 text-fg backdrop:bg-transparent max-lg:bg-bg"
    >
      <MediaDetail
        item={item}
        mediaOrigins={MEDIA_ORIGINS}
        position={position}
        total={total}
        previousHref={previous === null ? null : `/m/${previous.id}`}
        nextHref={next === null ? null : `/m/${next.id}`}
        onPrevious={previous === null ? undefined : () => onStep(previous)}
        onNext={next === null ? undefined : () => onStep(next)}
        onClose={onClose}
        lowSrc={lowSrc}
        autoPlay={autoPlay}
        transitionName={transitionName}
      />
    </dialog>
  );
}
