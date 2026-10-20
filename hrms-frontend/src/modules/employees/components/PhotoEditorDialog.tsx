import { Minus, Plus } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";

import {
  AVATAR_CROP_MAX_ZOOM,
  AVATAR_CROP_MIN_ZOOM,
  clampAvatarOffset,
  clampAvatarZoom,
  displaySize,
  exportCroppedAvatarFile,
} from "../cropAvatar";
import { ui } from "../uiClasses";

const VIEWPORT_SIZE = 280;

interface PhotoEditorDialogProps {
  readonly imageSrc: string;
  readonly onCancel: () => void;
  readonly onSave: (file: File) => void;
  /** Dialog heading; defaults to profile-photo copy. */
  readonly title?: string;
}

export function PhotoEditorDialog({
  imageSrc,
  onCancel,
  onSave,
  title = "Edit profile photo",
}: PhotoEditorDialogProps) {
  const titleId = useId();
  const zoomId = useId();
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const [natural, setNatural] = useState<{ w: number; h: number } | null>(
    null,
  );
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyOffset = useCallback(
    (nextX: number, nextY: number, nextZoom = zoom) => {
      if (!natural) {
        setOffsetX(nextX);
        setOffsetY(nextY);
        return;
      }
      const clamped = clampAvatarOffset(
        natural.w,
        natural.h,
        VIEWPORT_SIZE,
        nextZoom,
        nextX,
        nextY,
      );
      setOffsetX(clamped.offsetX);
      setOffsetY(clamped.offsetY);
    },
    [natural, zoom],
  );

  const applyZoom = useCallback(
    (nextZoom: number) => {
      const z = clampAvatarZoom(nextZoom);
      setZoom(z);
      applyOffset(offsetX, offsetY, z);
    },
    [applyOffset, offsetX, offsetY],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  function syncNaturalSize() {
    const img = imgRef.current;
    if (!img || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
      return;
    }
    setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
    setError(null);
  }

  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete) {
      syncNaturalSize();
    }
  }, [imageSrc]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !natural) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offsetX,
      originY: offsetY,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    applyOffset(
      drag.originX + (event.clientX - drag.startX),
      drag.originY + (event.clientY - drag.startY),
    );
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  async function handleSave() {
    const img = imgRef.current;
    if (!img || !natural || saving) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const file = await exportCroppedAvatarFile(
        img,
        natural.w,
        natural.h,
        VIEWPORT_SIZE,
        { zoom, offsetX, offsetY },
      );
      onSave(file);
    } catch {
      setError("Could not save cropped photo.");
      setSaving(false);
    }
  }

  const size = natural
    ? displaySize(natural.w, natural.h, VIEWPORT_SIZE, zoom)
    : { width: VIEWPORT_SIZE, height: VIEWPORT_SIZE };

  const dialog = (
    <div
      className={ui.overlayNested}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        className={ui.photoEditorDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={ui.panelHeader}>
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className={ui.createCloseBtn}
            aria-label="Close photo editor"
            onClick={onCancel}
          >
            ×
          </button>
        </div>
        <p className={ui.photoEditorHint}>
          Drag to reposition. Use zoom to adjust framing.
        </p>

        <div className={ui.photoEditorStage}>
          <div
            className={ui.photoEditorViewport}
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            role="presentation"
          >
            <img
              ref={imgRef}
              className={ui.photoEditorImage}
              src={imageSrc}
              alt=""
              draggable={false}
              onLoad={syncNaturalSize}
              onError={() => setError("Could not load photo.")}
              style={{
                width: size.width,
                height: size.height,
                transform: `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px)`,
              }}
            />
          </div>
        </div>

        <div className={ui.photoEditorZoom}>
          <button
            type="button"
            className={ui.iconBtn}
            aria-label="Zoom out"
            disabled={zoom <= AVATAR_CROP_MIN_ZOOM || !natural}
            onClick={() => applyZoom(zoom - 0.1)}
          >
            <Minus size={16} strokeWidth={2} aria-hidden="true" />
          </button>
          <label className={ui.photoEditorZoomLabel} htmlFor={zoomId}>
            <span className={ui.srOnly}>Zoom</span>
            <input
              id={zoomId}
              className={ui.photoEditorZoomRange}
              type="range"
              min={AVATAR_CROP_MIN_ZOOM}
              max={AVATAR_CROP_MAX_ZOOM}
              step={0.01}
              value={zoom}
              disabled={!natural}
              onChange={(event) => applyZoom(Number(event.target.value))}
            />
          </label>
          <button
            type="button"
            className={ui.iconBtn}
            aria-label="Zoom in"
            disabled={zoom >= AVATAR_CROP_MAX_ZOOM || !natural}
            onClick={() => applyZoom(zoom + 0.1)}
          >
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {error ? (
          <p className={ui.error} role="alert">
            {error}
          </p>
        ) : null}

        <div className={ui.formActions}>
          <button
            type="button"
            className={ui.btnGhost}
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className={ui.btnPrimary}
            onClick={() => {
              void handleSave();
            }}
            disabled={!natural || saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }
  return createPortal(dialog, document.body);
}
