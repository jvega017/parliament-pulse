import type { SVGProps } from "react";

export type IconName =
  | "overview"
  | "signal"
  | "sources"
  | "committee"
  | "bill"
  | "parliament"
  | "brief"
  | "watch"
  | "radar"
  | "pattern"
  | "search"
  | "close"
  | "link"
  | "bell"
  | "check"
  | "plus"
  | "chevron"
  | "filter"
  | "refresh"
  | "download"
  | "ext"
  | "clock"
  | "flag"
  | "book"
  | "print";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name" | "size"> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}

export function Icon({
  name,
  size = 16,
  stroke = "currentColor",
  strokeWidth = 1.6,
  ...rest
}: IconProps): JSX.Element {
  const props: SVGProps<SVGSVGElement> = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: false,
    ...rest,
  };

  switch (name) {
    case "overview":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="9" />
          <rect x="14" y="3" width="7" height="5" />
          <rect x="14" y="12" width="7" height="9" />
          <rect x="3" y="16" width="7" height="5" />
        </svg>
      );
    case "signal":
      return (
        <svg {...props}>
          <path d="M4 12h3l3-8 4 16 3-8h3" />
        </svg>
      );
    case "sources":
      return (
        <svg {...props}>
          <circle cx="6" cy="18" r="2" />
          <path d="M4 4c8 0 14 6 14 14" />
          <path d="M4 10c4 0 8 4 8 8" />
        </svg>
      );
    case "committee":
      return (
        <svg {...props}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V4h8v3" />
          <path d="M3 13h18" />
        </svg>
      );
    case "bill":
      return (
        <svg {...props}>
          <path d="M6 3h9l4 4v14H6z" />
          <path d="M14 3v5h5" />
          <path d="M9 13h7M9 17h7" />
        </svg>
      );
    case "parliament":
      return (
        <svg {...props}>
          <path d="M3 10l9-6 9 6" />
          <path d="M5 10v8M9 10v8M13 10v8M17 10v8" />
          <path d="M3 20h18" />
        </svg>
      );
    case "brief":
      return (
        <svg {...props}>
          <rect x="3" y="6" width="18" height="14" rx="2" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M8 12h8" />
        </svg>
      );
    case "watch":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        </svg>
      );
    case "radar":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.5" />
          <path d="M12 3v9l6 3" />
        </svg>
      );
    case "pattern":
      return (
        <svg {...props}>
          <circle cx="5" cy="6" r="2" />
          <circle cx="19" cy="6" r="2" />
          <circle cx="12" cy="18" r="2" />
          <path d="M7 7l4 9M17 7l-4 9" />
        </svg>
      );
    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case "close":
      return (
        <svg {...props}>
          <path d="M6 6l12 12M6 18L18 6" />
        </svg>
      );
    case "link":
      return (
        <svg {...props}>
          <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
          <path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
        </svg>
      );
    case "bell":
      return (
        <svg {...props}>
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8z" />
          <path d="M10 21a2 2 0 0 0 4 0" />
        </svg>
      );
    case "check":
      return (
        <svg {...props}>
          <path d="M5 12l5 5L20 7" />
        </svg>
      );
    case "plus":
      return (
        <svg {...props}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...props}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      );
    case "filter":
      return (
        <svg {...props}>
          <path d="M3 5h18M6 12h12M10 19h4" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...props}>
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 3v6h-6" />
        </svg>
      );
    case "download":
      return (
        <svg {...props}>
          <path d="M12 3v13" />
          <path d="M7 12l5 5 5-5" />
          <path d="M4 21h16" />
        </svg>
      );
    case "ext":
      return (
        <svg {...props}>
          <path d="M14 4h6v6" />
          <path d="M20 4L10 14" />
          <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
        </svg>
      );
    case "clock":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "flag":
      return (
        <svg {...props}>
          <path d="M4 21V4" />
          <path d="M4 4h13l-2 4 2 4H4" />
        </svg>
      );
    case "book":
      return (
        <svg {...props}>
          <path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z" />
          <path d="M4 19V5" />
        </svg>
      );
    case "print":
      return (
        <svg {...props}>
          <path d="M6 9V3h12v6" />
          <rect x="6" y="14" width="12" height="7" />
          <path d="M6 17H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}
