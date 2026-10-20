"use client";
import { useEffect, useRef } from "react";
export function useModal(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  }, [close]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          '.modal button:not(:disabled), .modal a[href], .modal input:not([readonly]):not(:disabled), .modal select:not(:disabled), .modal textarea:not(:disabled), .modal [tabindex="0"]',
        ),
      ).filter((el) => el.offsetParent !== null);
    const frame = requestAnimationFrame(() => {
      const initial = document.querySelector<HTMLElement>(
        ".modal input[autofocus], .modal input:not([readonly]), .modal button:not(:disabled)",
      );
      initial?.focus();
    });
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      const dialog = document.querySelector(".modal");
      if (!dialog?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", keyboard);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open]);
}
