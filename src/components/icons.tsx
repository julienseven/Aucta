import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, strokeWidth = 1.6, ...rest }: P) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest,
  };
}

export const IconHeart = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 20s-7.5-4.3-9.7-9C.9 7.9 2.3 4.8 5.4 4.4c1.9-.2 3.5.8 4.6 2.3h2c1.1-1.5 2.7-2.5 4.6-2.3 3.1.4 4.5 3.5 3.1 6.6-2.2 4.7-9.7 9-9.7 9z" />
  </svg>
);

export const IconEye = (p: P) => (
  <svg {...base(p)}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const IconTarget = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
  </svg>
);

export const IconUsers = (p: P) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.4" />
    <path d="M3.5 20c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5" />
    <path d="M16 5.2a3.3 3.3 0 0 1 0 6.1M17.5 15.2c1.9.7 3 2.4 3.3 4.8" />
  </svg>
);

export const IconBulb = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.3 1 2.1h5c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
  </svg>
);

export const IconSparkle = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3z" />
    <path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" />
  </svg>
);

export const IconShield = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3l7 2.5v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V5.5L12 3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const IconGavel = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 4l6 6-3 3-6-6 3-3zM11 7l-7 7 3 3 7-7" />
    <path d="M3 21h8M14 13l4 4M6 18h6" />
  </svg>
);

export const IconSearch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

export const IconArrow = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 12h16M13 6l6 6-6 6" />
  </svg>
);

export const IconArrowDown = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4v16M6 14l6 6 6-6" />
  </svg>
);

export const IconCheck = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 12.5l5 5L20 6.5" />
  </svg>
);

export const IconClose = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconMenu = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);

export const IconClock = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </svg>
);

export const IconTag = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 12V4h8l10 10-8 8L3 12z" />
    <circle cx="7.5" cy="8.5" r="1.3" fill="currentColor" />
  </svg>
);

export const IconSliders = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="8" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </svg>
);

export const IconWatch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="5.5" />
    <path d="M9 3h6l-1 4h-4L9 3zM9 21h6l-1-4h-4l1 4zM12 9v3l2 2" />
  </svg>
);

export const IconCamera = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 8h4l2-2.5h6L17 8h4v11H3V8z" />
    <circle cx="12" cy="13.5" r="3.4" />
  </svg>
);

export const IconCard = (p: P) => (
  <svg {...base(p)}>
    <rect x="4" y="4" width="16" height="16" rx="2.5" />
    <path d="M4 13h16M9 8h4" />
  </svg>
);

export const IconSneaker = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 15v-3l5-1 3-4h2l2 4 6 2v2H3z" />
    <path d="M3 15v2.5h18V15M8 14v2M12 14v2" />
  </svg>
);

export const IconChair = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 3v8M7 11h10l1 4H6l1-4zM6 15l-1 6M18 15l1 6M9 11V7M12 11V5M15 11V7" />
  </svg>
);

export const IconGamepad = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 9h10a4 4 0 0 1 4 4v.5a2.5 2.5 0 0 1-4.6 1.3L15 14H9l-1.4.8A2.5 2.5 0 0 1 3 13.5V13a4 4 0 0 1 4-4z" />
    <path d="M7 11v3M5.5 12.5h3M15 12h.01M17.5 13.5h.01" />
  </svg>
);

export const IconRadio = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="9" width="18" height="11" rx="2" />
    <path d="M4 9l13-5M7 14h3v3H7zM14.5 13h.01M17 15.5h.01" />
  </svg>
);

export const IconArt = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="15" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M3 16l5-4 4 3 3-2 6 4" />
  </svg>
);

export const IconCompass = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
  </svg>
);

export const IconHammer = IconGavel;

export const IconUser = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20c.8-3.6 3.6-5.5 7.5-5.5s6.7 1.9 7.5 5.5" />
  </svg>
);

export const IconGoogle = (p: P) => (
  <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6z"
    />
    <path
      fill="#34A853"
      d="M12 23c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.4 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3A11 11 0 0 0 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.6 13.7a6.6 6.6 0 0 1 0-4.2v-3H1.8a11 11 0 0 0 0 10.2l3.8-3z"
    />
    <path
      fill="#EA4335"
      d="M12 5.6c1.7 0 3.2.6 4.3 1.7l3.2-3.2A11 11 0 0 0 1.8 6.5l3.8 3C6.5 6.8 8.9 5.6 12 5.6z"
    />
  </svg>
);

export const IconFilter = IconSliders;

export const IconFlag = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 21V4M5 4h11l-2 3.5L16 11H5" />
  </svg>
);

export const IconList = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </svg>
);

export const IconChart = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20V4M4 20h16" />
    <path d="M8 16v-4M12 16V8M16 16v-7M20 16v-2" />
  </svg>
);

export const IconBell = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
    <path d="M10 20a2 2 2 0 0 0 4 0" />
  </svg>
);

export const IconStore = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 9l1-4h14l1 4M4 9h16M4 9v10h16V9M9 19v-5h6v5" />
  </svg>
);

export const IconShieldCheck = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3l7 2.5v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V5.5L12 3z" />
    <path d="M8.5 12l2.5 2.5L16 9.5" />
  </svg>
);

export const IconUpload = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 16V4M8 8l4-4 4 4" />
    <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </svg>
);

export const IconChevronLeft = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const IconChevronRight = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 5l7 7-7 7" />
  </svg>
);

export const IconTruck = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 6h11v9H3zM14 9h4l3 3v3h-7" />
    <circle cx="7" cy="18" r="1.6" />
    <circle cx="17" cy="18" r="1.6" />
  </svg>
);

export const categoryIcon: Record<string, (p: P) => React.ReactElement> = {
  watches: IconWatch,
  cameras: IconCamera,
  cards: IconCard,
  sneakers: IconSneaker,
  design: IconChair,
  gaming: IconGamepad,
  electronics: IconRadio,
  art: IconArt,
};
