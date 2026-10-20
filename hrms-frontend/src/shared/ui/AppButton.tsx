"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type AppButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type AppButtonSize = "default" | "compact" | "icon";

const BASE_CLASS =
  "inline-flex cursor-pointer items-center justify-center gap-[0.35rem] rounded-[0.4rem] disabled:cursor-not-allowed disabled:opacity-55";

const SIZE_CLASS: Record<AppButtonSize, string> = {
  default: "min-h-[2.15rem] px-[0.9rem] py-[0.4rem] text-[0.85rem]",
  compact: "min-h-[1.85rem] px-[0.65rem] py-[0.28rem] text-[0.85rem]",
  icon: "h-[2.15rem] w-[2.15rem] min-h-[2.15rem] px-0 py-0",
};

const VARIANT_CLASS: Record<AppButtonVariant, string> = {
  primary:
    "border border-emp-accent bg-emp-accent text-emp-on-accent hover:brightness-[1.04]",
  secondary:
    "border border-emp-line bg-emp-surface text-emp-text hover:border-emp-accent hover:bg-emp-accent-soft hover:text-emp-text",
  ghost:
    "border border-transparent bg-transparent text-emp-text hover:border-emp-line hover:bg-emp-raised",
  danger:
    "border border-transparent bg-emp-critical text-white",
};

export interface AppButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: AppButtonVariant;
  readonly size?: AppButtonSize;
  readonly children: ReactNode;
}

/** Shared action button for module chrome (save, submit, dialogs). */
export function AppButton({
  variant = "primary",
  size = "default",
  className,
  type = "button",
  children,
  ...props
}: AppButtonProps) {
  return (
    <button
      type={type}
      className={[BASE_CLASS, SIZE_CLASS[size], VARIANT_CLASS[variant], className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
