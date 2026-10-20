"use client";

import { useEffect } from "react";

let lockCount = 0;
let previousOverflow = "";

/** Lock document scrolling while a full-viewport dialog is open, matching Add Employee. */
export function useBodyScrollLock(enabled = true) {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const { body } = document;
    if (lockCount === 0) {
      previousOverflow = body.style.overflow;
      body.style.overflow = "hidden";
    }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        body.style.overflow = previousOverflow;
      }
    };
  }, [enabled]);
}
