"use client";

import { Menu, X } from "lucide-react";
import { KeyboardEvent, useEffect, useRef, useState } from "react";

import { Sidebar } from "@/components/layout/sidebar";

type MobileSidebarProps = {
  isAdmin: boolean;
};

export const MobileSidebar = ({ isAdmin }: MobileSidebarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen || !panelRef.current) {
      return;
    }

    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    const firstFocusable = focusable[0] ?? panelRef.current;
    firstFocusable.focus();
  }, [isOpen]);

  const closeMenu = () => {
    setIsOpen(false);
    openButtonRef.current?.focus();
  };

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!panelRef.current) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    if (focusable.length === 0) {
      return;
    }

    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];
    const activeElement = document.activeElement as HTMLElement | null;

    if (event.shiftKey && activeElement === firstFocusable) {
      event.preventDefault();
      lastFocusable.focus();
      return;
    }

    if (!event.shiftKey && activeElement === lastFocusable) {
      event.preventDefault();
      firstFocusable.focus();
    }
  };

  return (
    <>
      <button
        ref={openButtonRef}
        type="button"
        onClick={() => setIsOpen(true)}
        className="styled-button styled-button-compact min-h-8 gap-1 px-2 py-1 text-xs"
        aria-label="Abrir menú de conversaciones"
      >
        <Menu size={15} />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 bg-black/25 lg:hidden" role="dialog" aria-modal="true">
          <div
            ref={panelRef}
            onKeyDown={onPanelKeyDown}
            tabIndex={-1}
            className="absolute inset-y-0 left-0 w-[80vw] max-w-[280px] p-2 sm:w-[86vw] sm:max-w-[320px] sm:p-3"
          >
            <div className="mb-1.5 flex justify-end sm:mb-3">
              <button
                type="button"
                onClick={closeMenu}
                className="styled-button styled-button-icon"
                aria-label="Cerrar menú de conversaciones"
              >
                <X size={16} />
              </button>
            </div>
            <div className="h-[calc(100%-38px)] sm:h-[calc(100%-52px)]">
              <Sidebar isAdmin={isAdmin} />
            </div>
          </div>
          <button
            type="button"
            className="absolute inset-0 -z-10 h-full w-full cursor-default"
            onClick={closeMenu}
            aria-label="Cerrar"
          />
        </div>
      ) : null}
    </>
  );
};
