import {
  Banknote,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Eye,
  EyeOff,
  LayoutGrid,
  List,
  LogOut,
  Mail,
  Monitor,
  Moon,
  MoreVertical,
  Pencil,
  Plus,
  Sun,
  TrendingUp,
  UserRound,
  Users,
  X,
  type LucideProps,
} from "lucide-react";
import type { ReactNode } from "react";

import { cx } from "./cx";

/** Default stroke for UI chrome icons (matches prior inline SVGs). */
export const ICON_STROKE = 1.75;

const decorative = {
  "aria-hidden": true as const,
  focusable: false as const,
};

export function CloseIcon({
  size = 16,
  strokeWidth = ICON_STROKE,
  ...props
}: LucideProps): ReactNode {
  return <X size={size} strokeWidth={strokeWidth} {...decorative} {...props} />;
}

export function MoreIcon({
  size = 16,
  strokeWidth = ICON_STROKE,
  ...props
}: LucideProps): ReactNode {
  return (
    <MoreVertical size={size} strokeWidth={strokeWidth} {...decorative} {...props} />
  );
}

export function ListIcon({
  size = 16,
  strokeWidth = ICON_STROKE,
  ...props
}: LucideProps): ReactNode {
  return <List size={size} strokeWidth={strokeWidth} {...decorative} {...props} />;
}

export function CardIcon({
  size = 16,
  strokeWidth = ICON_STROKE,
  ...props
}: LucideProps): ReactNode {
  return (
    <LayoutGrid size={size} strokeWidth={strokeWidth} {...decorative} {...props} />
  );
}

export function MailIcon({
  size = 16,
  strokeWidth = ICON_STROKE,
  ...props
}: LucideProps): ReactNode {
  return <Mail size={size} strokeWidth={strokeWidth} {...decorative} {...props} />;
}

export function SortIcon({
  active,
  direction,
  className,
}: {
  readonly active: boolean;
  readonly direction: "asc" | "desc";
  readonly className?: string;
}): ReactNode {
  const upOpacity = active && direction === "asc" ? "opacity-100" : "opacity-35";
  const downOpacity = active && direction === "desc" ? "opacity-100" : "opacity-35";
  return (
    <span
      className={cx("inline-flex size-[12px] flex-col items-center leading-[0]", className)}
      aria-hidden="true"
    >
      <ChevronUp size={8} strokeWidth={1.5} className={upOpacity} />
      <ChevronDown size={8} strokeWidth={1.5} className={downOpacity} />
    </span>
  );
}

export function PencilIcon({
  size = 14,
  strokeWidth = ICON_STROKE,
  ...props
}: LucideProps): ReactNode {
  return (
    <Pencil size={size} strokeWidth={strokeWidth} {...decorative} {...props} />
  );
}

export function ProfileIcon({
  size = 16,
  strokeWidth = ICON_STROKE,
  ...props
}: LucideProps): ReactNode {
  return (
    <UserRound size={size} strokeWidth={strokeWidth} {...decorative} {...props} />
  );
}

export function SunIcon({
  size = 16,
  strokeWidth = ICON_STROKE,
  ...props
}: LucideProps): ReactNode {
  return <Sun size={size} strokeWidth={strokeWidth} {...decorative} {...props} />;
}

export function MoonIcon({
  size = 16,
  strokeWidth = ICON_STROKE,
  ...props
}: LucideProps): ReactNode {
  return <Moon size={size} strokeWidth={strokeWidth} {...decorative} {...props} />;
}

export function SystemIcon({
  size = 16,
  strokeWidth = ICON_STROKE,
  ...props
}: LucideProps): ReactNode {
  return (
    <Monitor size={size} strokeWidth={strokeWidth} {...decorative} {...props} />
  );
}

export function CheckIcon({
  size = 16,
  strokeWidth = 2,
  ...props
}: LucideProps): ReactNode {
  return <Check size={size} strokeWidth={strokeWidth} {...decorative} {...props} />;
}

export function SignOutIcon({
  size = 16,
  strokeWidth = ICON_STROKE,
  ...props
}: LucideProps): ReactNode {
  return (
    <LogOut size={size} strokeWidth={strokeWidth} {...decorative} {...props} />
  );
}

export function PersonaIcon({
  size = 16,
  strokeWidth = ICON_STROKE,
  ...props
}: LucideProps): ReactNode {
  return (
    <UserRound size={size} strokeWidth={strokeWidth} {...decorative} {...props} />
  );
}

export function BackIcon({
  size = 14,
  strokeWidth = ICON_STROKE,
  ...props
}: LucideProps): ReactNode {
  return (
    <ChevronLeft size={size} strokeWidth={strokeWidth} {...decorative} {...props} />
  );
}

export function PlusIcon({
  size = 16,
  strokeWidth = 2,
  ...props
}: LucideProps): ReactNode {
  return <Plus size={size} strokeWidth={strokeWidth} {...decorative} {...props} />;
}

export function EyeIcon({
  size = 16,
  strokeWidth = ICON_STROKE,
  ...props
}: LucideProps): ReactNode {
  return <Eye size={size} strokeWidth={strokeWidth} {...decorative} {...props} />;
}

export function EyeOffIcon({
  size = 16,
  strokeWidth = ICON_STROKE,
  ...props
}: LucideProps): ReactNode {
  return (
    <EyeOff size={size} strokeWidth={strokeWidth} {...decorative} {...props} />
  );
}

export function UsersIcon({
  size = 16,
  strokeWidth = ICON_STROKE,
  ...props
}: LucideProps): ReactNode {
  return (
    <Users size={size} strokeWidth={strokeWidth} {...decorative} {...props} />
  );
}

export function CalendarIcon({
  size = 16,
  strokeWidth = ICON_STROKE,
  ...props
}: LucideProps): ReactNode {
  return (
    <Calendar size={size} strokeWidth={strokeWidth} {...decorative} {...props} />
  );
}

export function BanknoteIcon({
  size = 16,
  strokeWidth = ICON_STROKE,
  ...props
}: LucideProps): ReactNode {
  return (
    <Banknote size={size} strokeWidth={strokeWidth} {...decorative} {...props} />
  );
}

export function TrendingUpIcon({
  size = 16,
  strokeWidth = ICON_STROKE,
  ...props
}: LucideProps): ReactNode {
  return (
    <TrendingUp
      size={size}
      strokeWidth={strokeWidth}
      {...decorative}
      {...props}
    />
  );
}
