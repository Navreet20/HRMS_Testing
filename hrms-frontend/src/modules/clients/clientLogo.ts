/** Client-side validation for client logo uploads. */

export const CLIENT_LOGO_MAX_BYTES = 5 * 1024 * 1024;
export const CLIENT_LOGO_MIN_PX = 200;

export const CLIENT_LOGO_ACCEPT =
  ".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/svg+xml"]);

export type ClientLogoValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

function normalizeMime(file: File): string {
  return (file.type || "").split(";")[0]!.trim().toLowerCase();
}

function extensionLooksAllowed(name: string): boolean {
  return /\.(png|jpe?g|svg)$/i.test(name.trim());
}

export async function validateClientLogoFile(
  file: File,
): Promise<ClientLogoValidationResult> {
  const mime = normalizeMime(file);
  if (!ALLOWED_MIME.has(mime) && !extensionLooksAllowed(file.name)) {
    return {
      ok: false,
      message: "Logo must be a PNG, JPG, JPEG, or SVG file.",
    };
  }
  if (!ALLOWED_MIME.has(mime)) {
    return {
      ok: false,
      message: `Disallowed logo type '${mime || "unknown"}'. Use PNG, JPG, or SVG.`,
    };
  }
  if (file.size > CLIENT_LOGO_MAX_BYTES) {
    return { ok: false, message: "Logo must be 5 MB or smaller." };
  }
  if (mime === "image/svg+xml") {
    return { ok: true };
  }

  const dimensions = await readImageDimensions(file);
  if (!dimensions) {
    return { ok: false, message: "Could not read image dimensions." };
  }
  if (
    dimensions.width < CLIENT_LOGO_MIN_PX ||
    dimensions.height < CLIENT_LOGO_MIN_PX
  ) {
    return {
      ok: false,
      message: `Logo must be at least ${CLIENT_LOGO_MIN_PX}×${CLIENT_LOGO_MIN_PX}px.`,
    };
  }
  return { ok: true };
}

function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}
