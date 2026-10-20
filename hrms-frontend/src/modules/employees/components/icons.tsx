import { Search, Users } from "lucide-react";

import {
  CloseIcon as SharedCloseIcon,
  MoreIcon as SharedMoreIcon,
  PencilIcon as SharedPencilIcon,
  SortIcon as SharedSortIcon,
} from "@/shared/ui/icons";
import { ui } from "../uiClasses";

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
      className={
        active ? ui.sortIconActive : undefined
      }
    />
  );
}

export function CloseIcon() {
  return <SharedCloseIcon />;
}

export function PencilIcon() {
  return <SharedPencilIcon />;
}

export function MoreIcon() {
  return <SharedMoreIcon />;
}

export function DirectoryEmptyUsersIcon() {
  return <Users size={22} strokeWidth={1.6} aria-hidden focusable={false} />;
}

export function DirectoryEmptySearchIcon() {
  return <Search size={22} strokeWidth={1.6} aria-hidden focusable={false} />;
}
