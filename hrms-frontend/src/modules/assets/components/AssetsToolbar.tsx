import { PlusIcon } from "@/shared/ui/icons";
import { empUi as ui } from "@/shared/ui/empUi";
import { AppButton } from "@/shared/ui";

interface AssetsToolbarProps {
  readonly canWrite: boolean;
  readonly onCreate: () => void;
}

/** Same placement as DirectoryToolbar's Add employee — top-right actions row. */
export function AssetsToolbar({ canWrite, onCreate }: AssetsToolbarProps) {
  if (!canWrite) {
    return null;
  }

  return (
    <div className={ui.toolbarActions}>
      <AppButton onClick={onCreate}>
        <PlusIcon />
        Add asset
      </AppButton>
    </div>
  );
}
