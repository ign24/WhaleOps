"use client";

import { LogOut } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

type LogoutButtonProps = {
  action: () => Promise<void>;
};

export const LogoutButton = ({ action }: LogoutButtonProps) => {
  return (
    <Tooltip content="Cerrar sesión">
      <form action={action}>
        <button
          type="submit"
          className="styled-button styled-button-icon"
          aria-label="Cerrar sesión"
        >
          <LogOut size={16} />
        </button>
      </form>
    </Tooltip>
  );
};
