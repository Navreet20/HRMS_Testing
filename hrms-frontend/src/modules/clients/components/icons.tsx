import {
  CloseIcon as SharedCloseIcon,
  MoreIcon as SharedMoreIcon,
  SortIcon as SharedSortIcon,
} from "@/shared/ui/icons";

export function SortIcon({
  active,
  direction,
}: {
  readonly active: boolean;
  readonly direction: "asc" | "desc";
}) {
  return (
    <SharedSortIcon
      active={active}
      direction={direction}
      className={active ? "text-app-accent" : undefined}
    />
  );
}

export function CloseIcon() {
  return <SharedCloseIcon />;
}

export function MoreIcon() {
  return <SharedMoreIcon />;
}
