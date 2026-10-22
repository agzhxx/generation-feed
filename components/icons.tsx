import type { ReactNode } from "react";

/** A 16 px line icon in the current text color. Decorative: the control around it has the name. */
function Icon({ size = 16, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export const FilterIcon = () => (
  <Icon>
    <path d="M2.5 3.5h11L9.25 8.5v3.75l-2.5 1.25v-5z" />
  </Icon>
);

export const CloseIcon = () => (
  <Icon>
    <path d="M4 4l8 8M12 4l-8 8" />
  </Icon>
);

export const ArrowLeftIcon = () => (
  <Icon>
    <path d="M13 8H3.5M7.5 4L3.5 8l4 4" />
  </Icon>
);

export const ArrowRightIcon = () => (
  <Icon>
    <path d="M3 8h9.5M8.5 4l4 4-4 4" />
  </Icon>
);

export const CopyIcon = () => (
  <Icon>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
    <path d="M10.5 3.5v-.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.5" />
  </Icon>
);

export const CheckIcon = () => (
  <Icon>
    <path d="M3 8.5l3.25 3.25L13 5" />
  </Icon>
);

export const SearchIcon = () => (
  <Icon>
    <circle cx="7" cy="7" r="4.25" />
    <path d="M10.25 10.25L13.5 13.5" />
  </Icon>
);

export const ChevronDownIcon = () => (
  <Icon>
    <path d="M4.5 6.25L8 9.75l3.5-3.5" />
  </Icon>
);

export const WifiOffIcon = () => (
  <Icon>
    <path d="M2.5 2.5l11 11M8 12.75h.01M5.9 10.6a3 3 0 0 1 3.5-.4M3.75 8.4a6 6 0 0 1 2.4-1.4M12.25 8.4a6 6 0 0 0-1.6-1.15M1.5 6a9.25 9.25 0 0 1 2.6-1.6M14.5 6A9.25 9.25 0 0 0 7 3.6" />
  </Icon>
);
