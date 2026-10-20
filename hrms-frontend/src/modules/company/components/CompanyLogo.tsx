"use client";

import { useEffect, useState } from "react";

import { companyInitials, companyInitialsHue } from "../companyInitials";

export type CompanyLogoSize = "small" | "medium" | "large";
export type CompanyLogoTile = "contrast" | "plain";
export type CompanyLogoEmptyDisplay = "mark" | "empty";

export interface CompanyLogoProps {
  readonly logoUrl?: string | null;
  readonly companyName: string;
  readonly companyId?: string | null;
  readonly size?: CompanyLogoSize;
  /** Square collapsed-rail / favicon slot: initials instead of full name. */
  readonly compact?: boolean;
  /** Light plate under a real logo image. Never used for the name wordmark. */
  readonly tile?: CompanyLogoTile;
  /** No/broken logo: sidebar wordmark, or an empty field dash. */
  readonly emptyDisplay?: CompanyLogoEmptyDisplay;
  /** Let the mark use the full container width (sidebar brand slot). */
  readonly fullWidth?: boolean;
  readonly className?: string;
}

const SIZE_HEIGHT: Record<CompanyLogoSize, string> = {
  small: "h-[32px]",
  medium: "h-[48px]",
  large: "h-[80px]",
};

const SIZE_MAX_WIDTH: Record<CompanyLogoSize, string> = {
  small: "max-w-[min(200px,100%)]",
  medium: "max-w-[min(200px,100%)] [@media(max-width:640px)]:max-w-[min(120px,100%)]",
  large: "max-w-[min(200px,100%)] [@media(max-width:640px)]:max-w-[min(120px,100%)]",
};

const NAME_FONT_SIZE: Record<CompanyLogoSize, string> = {
  small: "text-[1.05rem]",
  medium: "text-[1.35rem]",
  large: "text-[2rem]",
};

export function CompanyLogo({
  logoUrl,
  companyName,
  companyId,
  size = "medium",
  compact = false,
  tile = "contrast",
  emptyDisplay = "mark",
  fullWidth = false,
  className,
}: CompanyLogoProps) {
  const [broken, setBroken] = useState(false);
  const name = companyName.trim() || "Company";
  const src = logoUrl?.trim() || "";
  const showImage = Boolean(src) && !broken;
  const showEmpty = !showImage && !compact && emptyDisplay === "empty";
  const tileContrast = showImage && tile === "contrast";

  useEffect(() => {
    setBroken(false);
  }, [src]);

  let height = SIZE_HEIGHT[size];
  let maxWidth = SIZE_MAX_WIDTH[size];
  if (compact) {
    height = "h-[32px]";
    maxWidth = "max-w-[32px]";
  } else if (!showImage) {
    height = "h-auto";
  }
  if (showEmpty) {
    maxWidth = "max-w-full";
  }
  if (fullWidth) {
    maxWidth = "max-w-full";
  }

  const rootClass = [
    "box-border inline-flex min-w-0 items-center overflow-hidden align-middle",
    showEmpty ? "justify-start" : "justify-center",
    height,
    maxWidth,
    compact ? "w-[32px] shrink-0" : "",
    tileContrast
      ? cxTile(compact)
      : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={rootClass}
      title={showEmpty ? undefined : name}
      data-slot="company-logo"
      data-tile={tileContrast ? "contrast" : undefined}
    >
      {showImage ? (
        <img
          className="block h-full max-h-full w-auto max-w-full object-contain"
          src={src}
          alt={name}
          title={name}
          onError={() => setBroken(true)}
        />
      ) : compact ? (
        <span
          className="grid h-full w-full place-items-center rounded-[999px] text-[0.72rem] leading-none font-extrabold text-white"
          data-slot="company-logo-initials"
          aria-label={name}
          style={{
            background: `hsl(${companyInitialsHue(companyId?.trim() || name)} 42% 38%)`,
          }}
        >
          {companyInitials(name)}
        </span>
      ) : showEmpty ? (
        <span
          className="text-[0.95rem] leading-[1.35] font-medium text-[color:var(--emp-muted,var(--app-text-muted))]"
          data-slot="company-logo-empty"
        >
          —
        </span>
      ) : (
        <span
          className={`block max-w-full truncate leading-[1.15] font-extrabold tracking-[-0.02em] ${NAME_FONT_SIZE[size]}`}
          data-slot="company-logo-name"
        >
          {name}
        </span>
      )}
    </span>
  );
}

function cxTile(compact: boolean): string {
  const padding = compact ? "p-[0.15rem]" : "px-[0.3rem] py-[0.15rem]";
  return `${padding} rounded-[0.45rem] bg-[#fff] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)]`;
}
