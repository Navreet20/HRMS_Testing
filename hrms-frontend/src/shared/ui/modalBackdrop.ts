import { zClass } from "@/ui/zIndex";

/** Canonical create/edit modal backdrop: dimmed overlay + background blur. */
export const modalBackdropClass = [
  "fixed",
  "inset-0",
  zClass.modal,
  "grid",
  "place-items-center",
  "bg-[rgba(15,23,42,0.48)]",
  "p-4",
  "backdrop-blur-[6px]",
].join(" ");

/** Same treatment stacked above an open modal (nested confirms / editors). */
export const nestedModalBackdropClass = [
  "fixed",
  "inset-0",
  zClass.overlayNested,
  "grid",
  "place-items-center",
  "bg-[rgba(15,23,42,0.48)]",
  "p-4",
  "backdrop-blur-[6px]",
].join(" ");
