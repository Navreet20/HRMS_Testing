import {
  MoreIcon as SharedMoreIcon,
  SortIcon as SharedSortIcon,
} from "@/shared/ui/icons";
import { projectsUi as ui } from "../uiClasses";

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
      className={active ? ui.sortIconActive : undefined}
    />
  );
}

export function MoreIcon() {
  return <SharedMoreIcon />;
}
