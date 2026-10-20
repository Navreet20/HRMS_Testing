import { Camera, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";

import { ui } from "../uiClasses";
import { PhotoEditorDialog } from "./PhotoEditorDialog";

const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp";
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

interface PhotoControlsProps {
  readonly canEdit: boolean;
  readonly hasPhoto: boolean;
  readonly onUpload: (file: File) => void;
  readonly onRemove: () => void;
  readonly onError?: (message: string) => void;
  /** Overlay sits on the avatar; caption is the legacy text links. */
  readonly variant?: "caption" | "overlay";
  /** Existing photo URL — clicking the avatar reopens the crop editor. */
  readonly currentPhotoSrc?: string | null;
  /** Crop dialog heading. */
  readonly editorTitle?: string;
  readonly uploadLabel?: string;
  readonly replaceLabel?: string;
  readonly removeLabel?: string;
}

function validateAvatarFile(
  file: File,
  onError?: (message: string) => void,
): boolean {
  if (file.size > AVATAR_MAX_BYTES) {
    onError?.("Photo exceeds 2 MB limit");
    return false;
  }
  const type = file.type.toLowerCase();
  if (
    type !== "image/jpeg" &&
    type !== "image/png" &&
    type !== "image/webp"
  ) {
    onError?.("Photo must be JPEG, PNG, or WebP");
    return false;
  }
  return true;
}

export function PhotoControls({
  canEdit,
  hasPhoto,
  onUpload,
  onRemove,
  onError,
  variant = "caption",
  currentPhotoSrc = null,
  editorTitle = "Edit profile photo",
  uploadLabel = "Upload photo",
  replaceLabel = "Replace photo",
  removeLabel = "Remove photo",
}: PhotoControlsProps) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editorSrc, setEditorSrc] = useState<string | null>(null);
  const [ownedObjectUrl, setOwnedObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (ownedObjectUrl) {
        URL.revokeObjectURL(ownedObjectUrl);
      }
    };
  }, [ownedObjectUrl]);

  if (!canEdit) {
    return null;
  }

  function clearEditor() {
    setEditorSrc(null);
    if (ownedObjectUrl) {
      URL.revokeObjectURL(ownedObjectUrl);
      setOwnedObjectUrl(null);
    }
  }

  function openEditor(src: string, objectUrl: string | null = null) {
    if (ownedObjectUrl && ownedObjectUrl !== objectUrl) {
      URL.revokeObjectURL(ownedObjectUrl);
    }
    setOwnedObjectUrl(objectUrl);
    setEditorSrc(src);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!validateAvatarFile(file, onError)) {
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    openEditor(objectUrl, objectUrl);
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleAvatarClick() {
    if (hasPhoto && currentPhotoSrc) {
      openEditor(currentPhotoSrc, null);
      return;
    }
    openFilePicker();
  }

  function handleEditorSave(file: File) {
    clearEditor();
    onUpload(file);
  }

  const fileInput = (
    <input
      ref={fileInputRef}
      id={fileInputId}
      type="file"
      className={ui.srOnly}
      accept={AVATAR_ACCEPT}
      onChange={handleFileChange}
    />
  );

  const editor =
    editorSrc != null ? (
      <PhotoEditorDialog
        imageSrc={editorSrc}
        title={editorTitle}
        onCancel={clearEditor}
        onSave={handleEditorSave}
      />
    ) : null;

  if (variant === "overlay") {
    return (
      <>
        <button
          type="button"
          className={ui.photoAvatarHit}
          aria-label={hasPhoto ? replaceLabel : uploadLabel}
          title={hasPhoto ? replaceLabel : uploadLabel}
          onClick={handleAvatarClick}
        />
        <div className={ui.photoOverlay} aria-label={editorTitle}>
          <button
            type="button"
            className={ui.photoOverlayBtn}
            title={hasPhoto ? replaceLabel : uploadLabel}
            aria-label={hasPhoto ? replaceLabel : uploadLabel}
            onClick={openFilePicker}
          >
            <Camera size={14} strokeWidth={2} aria-hidden="true" />
          </button>
          {hasPhoto ? (
            <button
              type="button"
              className={ui.photoOverlayBtn}
              aria-label={removeLabel}
              title={removeLabel}
              onClick={onRemove}
            >
              <X size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          ) : null}
          {fileInput}
        </div>
        {editor}
      </>
    );
  }

  return (
    <div className={ui.photoControls} aria-label={editorTitle}>
      <button type="button" className={ui.photoCapsule} onClick={openFilePicker}>
        {hasPhoto ? replaceLabel : uploadLabel}
      </button>
      {hasPhoto ? (
        <button
          type="button"
          className={ui.photoCapsule}
          onClick={onRemove}
        >
          {removeLabel}
        </button>
      ) : null}
      {fileInput}
      {editor}
    </div>
  );
}
