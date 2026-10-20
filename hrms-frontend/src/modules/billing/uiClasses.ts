import { workspaceParts, workspaceUi } from "@/shared/ui/workspaceUi";

export { cx } from "@/shared/ui/workspaceUi";

export const ui = {
  ...workspaceUi,
  btnPrimary: workspaceUi.btnAccent,
  btnPrimaryCompact: workspaceUi.btnAccentCompact,
  dialogWide: `${workspaceParts.dialog} w-[min(36rem,100%)]`,
} as const;
