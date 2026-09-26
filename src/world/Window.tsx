import clsx from "clsx";
import { motion, useReducedMotionConfig } from "motion/react";
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * A place's window (#126 "Layout"): the pixel frame with a bark title bar and a square close,
 * docked right on a desktop with the world dimmed 30 % behind it, a full sheet on a phone. It is a
 * modal native <dialog> labelled by its title: focus moves in (to `[data-autofocus]`, else the
 * close) and back to whatever opened it; Escape and a click on the world close it. The content
 * scrolls inside; nothing else does.
 */
export function Window({
  open,
  title,
  onClose,
  children,
  scrollKey,
  returnFocus,
}: {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Changes when the content becomes another page: the window scrolls back to the top. */
  scrollKey?: string;
  /** Where focus goes on close when nothing opened the window, or its opener is gone. */
  returnFocus?: () => HTMLElement | null;
}) {
  const still = useReducedMotionConfig();
  const ref = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const pressedBackdrop = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
      dialog.showModal();
      (dialog.querySelector<HTMLElement>("[data-autofocus]") ?? dialog.querySelector<HTMLElement>("[data-close]"))?.focus();
    }
    if (!open && dialog.open) {
      dialog.close();
      (opener.current?.isConnected ? opener.current : returnFocus?.())?.focus();
    }
  }, [open]);
  useEffect(() => () => ref.current?.close(), []);
  useEffect(() => {
    if (body.current) body.current.scrollTop = 0;
  }, [scrollKey]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Dialogs opened by the page inside send their close/cancel events up the React tree: only
      // this window's own events close it. The close event of our own close() arrives late: if the
      // window has reopened since (the next place, at once under reduced motion), it's stale.
      onClose={(e) => e.target === e.currentTarget && open && !ref.current?.open && onClose()}
      onCancel={(e) => {
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        onClose();
      }}
      onPointerDown={(e) => (pressedBackdrop.current = e.target === ref.current)}
      onClick={(e) => {
        if (pressedBackdrop.current && e.target === ref.current) onClose();
        pressedBackdrop.current = false;
      }}
      className={clsx(
        // Room for the frame's 2 px edge and step on every side; the dialog itself never scrolls.
        "m-0 ml-auto h-dvh max-h-none w-full max-w-full overflow-visible border-0 bg-transparent p-1 text-ink backdrop:bg-dusk-deep/30",
        "sm:w-[clamp(420px,50vw,720px)] sm:p-3",
      )}
    >
      {open && (
        <motion.div
          initial={still ? false : { opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          className="pixel-frame flex h-full flex-col"
        >
          <header className="flex items-center justify-between gap-4 bg-bark px-4 py-3 text-cream">
            <h2 id={titleId} className="min-w-0 truncate font-display text-xl font-medium leading-7">
              {title}
            </h2>
            <button
              data-close
              onClick={onClose}
              className="pixel-chip grid h-8 w-8 shrink-0 place-items-center bg-parchment text-ink hover:bg-lantern focus-visible:outline-lantern"
              aria-label="Close"
              title="Back to the garden"
            >
              <X className="h-4 w-4" strokeWidth={3} aria-hidden />
            </button>
          </header>
          {/* A size container: pages inside can lay out by the window's width (`@lg:`), not the viewport's. */}
          <div ref={body} data-window-body className="@container relative min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
            {children}
          </div>
          <footer className="border-t border-parchment-deep px-4 py-3 sm:hidden">
            <button type="button" onClick={onClose} className="pixel-btn pixel-btn-secondary h-10 w-full px-4 text-sm font-semibold">
              Back to the garden
            </button>
          </footer>
        </motion.div>
      )}
    </dialog>
  );
}
