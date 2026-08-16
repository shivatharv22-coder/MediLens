/**
 * Inline SVG icons.
 *
 * Bundled rather than pulled from an icon package: the set is small, and every
 * icon here is decorative (`aria-hidden`) with the meaning carried by adjacent
 * text, which is what keeps alerts readable without colour or iconography.
 */
type IconProps = { className?: string };

const base = (className?: string) => ({
  className: className ?? 'size-5',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
});

export const HomeIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.8V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.8" />
  </svg>
);

export const ScanIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
    <path d="M8 12h8" />
  </svg>
);

export const SearchIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const HistoryIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 4v4h4" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const UserIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

export const CameraIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </svg>
);

export const UploadIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 16V4" />
    <path d="m7 9 5-5 5 5" />
    <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </svg>
);

export const WarningIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 4.5 2.8 20a1 1 0 0 0 .87 1.5h16.66A1 1 0 0 0 21.2 20L12 4.5Z" />
    <path d="M12 10v4.5" />
    <path d="M12 18h.01" />
  </svg>
);

export const InfoIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <path d="M12 8h.01" />
  </svg>
);

export const CheckIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="m5 13 4 4L19 7" />
  </svg>
);

export const CloseIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M6 6 18 18M18 6 6 18" />
  </svg>
);

export const SpeakerIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
    <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" />
    <path d="M18 7a7 7 0 0 1 0 10" />
  </svg>
);

export const PauseIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M9 5v14M15 5v14" />
  </svg>
);

export const StopIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
  </svg>
);

export const GlobeIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z" />
  </svg>
);

export const PrescriptionIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M14 3v5h5" />
    <path d="M8 11h4a2 2 0 0 1 0 4H8v-4Zm0 4v4m4 0 3-3" />
  </svg>
);

export const TrashIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M4 7h16" />
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6 7v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

export const ChevronRightIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="m9 5 7 7-7 7" />
  </svg>
);

export const EyeIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const EyeOffIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M9.9 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 4" />
    <path d="M6.5 7.4A16.8 16.8 0 0 0 2.5 12S6 18.5 12 18.5a9.5 9.5 0 0 0 4-.86" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="m3 3 18 18" />
  </svg>
);

export const MailIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 6.5 8.5 6 8.5-6" />
  </svg>
);

export const KeyIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <circle cx="8" cy="12" r="4" />
    <path d="M12 12h9" />
    <path d="M17 12v3M20 12v2" />
  </svg>
);

export const ShieldIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 3 5 6v5.5c0 4.3 2.9 8.2 7 9.5 4.1-1.3 7-5.2 7-9.5V6l-7-3Z" />
  </svg>
);
