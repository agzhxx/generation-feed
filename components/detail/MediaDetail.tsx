import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { ArrowLeftIcon, ArrowRightIcon, CloseIcon } from "@/components/icons";
import { thumbHashColor, useThumbHash } from "@/hooks/use-thumbhash";
import { aspectLabel, formatCreated, kindLabel } from "@/lib/detail";
import type { MediaItem } from "@/lib/manifest";
import { formatCount } from "@/lib/format";
import { posterSrcSet, posterUrl, videoUrl, type MediaOrigins } from "@/lib/media-urls";
import { timelineHref } from "@/lib/timeline";
import { CopyPromptButton } from "./CopyPromptButton";

/** `sizes` for the large poster: the media area beside the panel and its padding, or the full width. */
const DETAIL_SIZES = "(min-width: 1024px) calc(100vw - 548px), 100vw";
/** Width of the plain <img> fallback when the browser takes neither <source>. */
const FALLBACK_WIDTH = 1280;

export interface MediaDetailProps {
  item: MediaItem;
  mediaOrigins: MediaOrigins;
  /** Place in the current order (from 1) and its length: "12 of 1,284". */
  position: number;
  total: number;
  previousHref: string | null;
  nextHref: string | null;
  /** The overlay steps in place on plain clicks; without these, the links load the pages. */
  onPrevious?: () => void;
  onNext?: () => void;
  /** The overlay's Close button. Without it, Close is a link back to the feed. */
  onClose?: () => void;
  /** The grid poster already on screen, shown until the large one has loaded. */
  lowSrc?: string;
  /** Start the full video on its own, muted. Off with reduced motion or Save-Data. */
  autoPlay?: boolean;
  /** Names the figure for a view transition, so the card's media morphs into it. */
  transitionName?: string;
}

/**
 * Everything about one item: the large media, the prompt with a copy button, and the facts
 * (spec 3.2). The static page /m/[id] and the feed's overlay both render it. Phones get a top
 * bar with the controls; wide screens get arrows beside the media and a side panel. Each
 * layout's controls are hidden on the other (display: none also hides them from screen
 * readers and the Tab key).
 */
export function MediaDetail({
  item,
  mediaOrigins,
  position,
  total,
  previousHref,
  nextHref,
  onPrevious,
  onNext,
  onClose,
  lowSrc,
  autoPlay = false,
  transitionName,
}: MediaDetailProps) {
  const ratio = item.width / item.height;
  const placeholder = useThumbHash(item.thumbhash);
  const place = `${formatCount(position)} of ${formatCount(total)}`;
  const timeline = timelineHref(item);
  const figureStyle = {
    "--ratio": ratio,
    backgroundColor: thumbHashColor(item.thumbhash),
    viewTransitionName: transitionName,
  } as CSSProperties;

  return (
    <div className="flex h-full flex-col overflow-y-auto overscroll-contain lg:flex-row lg:overflow-hidden">
      <div className="sticky top-0 z-1 grid h-13 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-line bg-bg px-2 lg:hidden">
        <CloseControl onClose={onClose} className={`${SMALL_CONTROL} justify-self-start`} />
        <p className="text-sm text-fg-muted tabular-nums">{place}</p>
        <div className="flex justify-self-end">
          <StepLink href={previousHref} onStep={onPrevious} label="Previous item" className={SMALL_CONTROL}>
            <ArrowLeftIcon />
          </StepLink>
          <StepLink href={nextHref} onStep={onNext} label="Next item" className={SMALL_CONTROL}>
            <ArrowRightIcon />
          </StepLink>
        </div>
      </div>

      <div className="relative flex shrink-0 items-center justify-center lg:min-w-0 lg:flex-1 lg:px-21 lg:py-6 lg:[container-type:size]">
        <StepLink href={previousHref} onStep={onPrevious} label="Previous item" className={`${ROUND_CONTROL} left-6`}>
          <ArrowLeftIcon />
        </StepLink>
        <figure
          key={item.id}
          style={figureStyle}
          className="relative aspect-(--ratio) w-[min(100%,70svh*var(--ratio))] overflow-hidden lg:w-[min(100cqw,100cqh*var(--ratio))] lg:rounded-card"
        >
          <img
            src={placeholder}
            alt=""
            aria-hidden="true"
            data-placeholder=""
            className="absolute inset-0 size-full"
          />
          {lowSrc !== undefined && (
            <img
              src={lowSrc}
              alt=""
              aria-hidden="true"
              data-placeholder=""
              className="absolute inset-0 size-full object-cover"
            />
          )}
          <Media item={item} mediaOrigins={mediaOrigins} lowSrc={lowSrc} autoPlay={autoPlay} />
        </figure>
        <StepLink href={nextHref} onStep={onNext} label="Next item" className={`${ROUND_CONTROL} right-6`}>
          <ArrowRightIcon />
        </StepLink>
      </div>

      <aside className="flex flex-col gap-5 p-4 lg:w-panel lg:shrink-0 lg:gap-6 lg:overflow-y-auto lg:border-l lg:border-line lg:bg-surface lg:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="rounded-badge bg-line px-1.5 text-2xs leading-5 font-semibold tracking-label uppercase">
              AI
            </span>
            AI-generated
          </p>
          <CloseControl onClose={onClose} className={`${PANEL_CONTROL} max-lg:hidden`} />
        </div>

        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-medium text-fg-muted">Prompt</h2>
          <p className="text-md break-words">{item.prompt}</p>
          <div className="mt-2 flex flex-col">
            <CopyPromptButton key={item.id} prompt={item.prompt} />
          </div>
        </section>

        <hr className="border-line" />

        <dl className="grid grid-cols-[112px_1fr] gap-x-4 gap-y-3">
          <Fact name="Model">{item.model}</Fact>
          <Fact name="Type">{kindLabel(item)}</Fact>
          <Fact name="Aspect ratio">{aspectLabel(item.width, item.height)}</Fact>
          <Fact name="Size">
            {item.width} × {item.height}
          </Fact>
          <Fact name="Created">
            <time dateTime={item.createdAt}>{formatCreated(item.createdAt)}</time>
          </Fact>
        </dl>

        {timeline !== null && (
          <a href={timeline} className={TIMELINE_LINK}>
            Open in Timeline
          </a>
        )}

        <footer className="mt-auto flex items-center gap-4 pt-2 text-xs text-fg-subtle max-lg:hidden">
          <span className="flex items-center gap-1.5">
            <Kbd>←</Kbd>
            <Kbd>→</Kbd>
            Browse
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Esc</Kbd>
            Close
          </span>
          <span className="ml-auto text-fg-muted tabular-nums">{place}</span>
        </footer>
      </aside>
    </div>
  );
}

const CONTROL =
  "flex items-center justify-center text-fg outline-focus transition-colors duration-(--dur-fast) focus-visible:outline-2 focus-visible:outline-offset-2";
/** Phone top bar: 36 px icon buttons. */
const SMALL_CONTROL = `${CONTROL} size-control rounded-control hover:bg-surface-raised`;
/** Wide screens: 44 px round arrows over the media area's edges. */
const ROUND_CONTROL = `${CONTROL} absolute top-1/2 size-11 -translate-y-1/2 rounded-pill border border-line bg-surface-raised hover:bg-line max-lg:hidden`;
/** Wide screens: the panel's bordered Close button. */
const PANEL_CONTROL = `${CONTROL} size-control rounded-control border border-line hover:bg-surface-raised`;
/** A story clip's link to the Timeline: a bordered button, quieter than Copy prompt. */
const TIMELINE_LINK = `${CONTROL} h-11 rounded-control border border-line px-3 text-sm font-medium hover:bg-surface-raised lg:h-control lg:self-start`;

function Media({ item, mediaOrigins, lowSrc, autoPlay }: Pick<MediaDetailProps, "item" | "mediaOrigins" | "lowSrc" | "autoPlay">) {
  const { posters, videos } = mediaOrigins;
  const video = videoUrl(videos, item);
  if (video !== undefined) {
    return (
      <video
        src={video}
        poster={lowSrc ?? posterUrl(posters, item, 960, "webp")}
        controls
        playsInline
        preload="metadata"
        autoPlay={autoPlay}
        muted={autoPlay}
        loop={autoPlay}
        className="absolute inset-0 size-full object-cover"
      />
    );
  }
  return (
    <picture>
      <source type="image/avif" srcSet={posterSrcSet(posters, item, "avif")} sizes={DETAIL_SIZES} />
      <source type="image/webp" srcSet={posterSrcSet(posters, item, "webp")} sizes={DETAIL_SIZES} />
      <img
        src={posterUrl(posters, item, FALLBACK_WIDTH, "webp")}
        alt={item.prompt}
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 size-full object-cover"
      />
    </picture>
  );
}

/** A left click with no modifier keys: other clicks keep their usual meaning (new tab, window). */
function isPlainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function StepLink({
  href,
  onStep,
  label,
  className,
  children,
}: {
  href: string | null;
  onStep?: () => void;
  label: string;
  className: string;
  children: ReactNode;
}) {
  // Nothing before the first item or after the last: the arrow stays, dimmed, for a steady layout.
  if (href === null) {
    return (
      <span aria-hidden="true" className={`${className} opacity-40`}>
        {children}
      </span>
    );
  }
  const onClick =
    onStep &&
    ((event: MouseEvent) => {
      if (!isPlainClick(event)) return;
      event.preventDefault();
      onStep();
    });
  return (
    <a href={href} aria-label={label} onClick={onClick} className={className}>
      {children}
    </a>
  );
}

function CloseControl({ onClose, className }: { onClose?: () => void; className: string }) {
  if (onClose === undefined) {
    return (
      // A plain link, like the arrows: the static page is plain HTML pages linked together, and
      // next/link would put its code in the overlay's chunk too.
      // eslint-disable-next-line @next/next/no-html-link-for-pages
      <a href="/" aria-label="Back to feed" data-close="" className={className}>
        <CloseIcon />
      </a>
    );
  }
  return (
    <button type="button" aria-label="Close" data-close="" onClick={onClose} className={className}>
      <CloseIcon />
    </button>
  );
}

function Fact({ name, children }: { name: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-fg-muted">{name}</dt>
      <dd className="tabular-nums">{children}</dd>
    </>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-badge border border-line px-1 font-sans text-2xs text-fg-muted">
      {children}
    </kbd>
  );
}
