type IconProps = {
  className?: string;
};

const baseProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export function SnowflakeIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M12 2v20M4.2 6.5l15.6 11M19.8 6.5l-15.6 11" />
      <path d="M9 4.5 12 7l3-2.5M9 19.5 12 17l3 2.5M4.5 11l3.5.8L7 15.3M19.5 13l-3.5-.8.9-3.5M4.5 13l3.5-.8-.9-3.5M19.5 11l-3.5.8.9 3.5" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function MapIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M9 4 3 7v13l6-3 6 3 6-3V4l-6 3-6-3Z" />
      <path d="M9 4v13M15 7v13" />
    </svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function RouteIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <circle cx="5" cy="18" r="2" />
      <circle cx="19" cy="6" r="2" />
      <path d="M7 18h6a4 4 0 0 0 0-8H9a4 4 0 0 1 0-8h8" />
    </svg>
  );
}

export function LogOutIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </svg>
  );
}

export function TruckIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M10 17h4V5H2v12h3" />
      <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1" />
      <circle cx="7.5" cy="17.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  );
}

export function PlayIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="m7 4 13 8-13 8V4Z" />
    </svg>
  );
}

export function ThermometerIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0Z" />
    </svg>
  );
}

export function AlertIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}
