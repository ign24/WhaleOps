"use client";

import {
  useFloating,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
} from "@floating-ui/react";
import { useState } from "react";

type TooltipProps = {
  content: React.ReactNode;
  placement?: string;
  delay?: number;
  /** Extra classes for the wrapper span (e.g. "w-full block") */
  wrapperClassName?: string;
  children: React.ReactNode;
};

export const Tooltip = ({
  content,
  delay = 400,
  wrapperClassName,
  children,
}: TooltipProps) => {
  const [open, setOpen] = useState(false);

  const { refs, context } = useFloating({
    open,
    onOpenChange: setOpen,
  });

  const hover = useHover(context, {
    delay: { open: delay, close: 80 },
    move: false,
  });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ]);

  return (
    <>
      <span
        ref={refs.setReference}
        className={wrapperClassName}
        style={wrapperClassName ? undefined : { display: "inline-flex" }}
        {...getReferenceProps()}
      >
        {children}
      </span>

      {open && content ? (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={{ position: "fixed", bottom: "1rem", left: "1rem" }}
            {...getFloatingProps()}
            className="neu-tooltip z-[9999]"
          >
            {content}
          </div>
        </FloatingPortal>
      ) : null}
    </>
  );
};
