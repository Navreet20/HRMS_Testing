import { DialogShell } from "@/shared/ui/DialogShell";
import { sharedButtonPrimary } from "@/shared/ui/sharedUiClasses";

export interface ClientSaveSuccessDialogProps {
  readonly mode: "create" | "edit";
  readonly clientId: string;
  readonly onClose: () => void;
}

/** Centered success dialog after client create/update (Close dismisses; no auto-dismiss). */
export function ClientSaveSuccessDialog({
  mode,
  clientId,
  onClose,
}: ClientSaveSuccessDialogProps) {
  const title =
    mode === "create"
      ? "Client successfully created"
      : "Client successfully updated";
  const description = `Client ID: ${clientId}`;

  return (
    <DialogShell
      open
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <button
          type="button"
          className={sharedButtonPrimary}
          data-dialog-initial-focus
          onClick={onClose}
        >
          Close
        </button>
      }
    />
  );
}
