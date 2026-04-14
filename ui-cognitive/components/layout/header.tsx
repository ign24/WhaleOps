import { ThemeToggle } from "@/components/layout/theme-toggle";
import { BackgroundMotionToggle } from "@/components/layout/background-motion-toggle";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { Tooltip } from "@/components/ui/tooltip";
import { WhaleLogo } from "@/components/layout/whale-logo";

type HeaderProps = {
  name: string;
  email: string;
  isAdmin: boolean;
  logoutAction: () => Promise<void>;
};

export const Header = ({ name, email, isAdmin, logoutAction }: HeaderProps) => {
  return (
    <header
      className="flex items-center justify-between px-2 py-0.5 sm:px-3 sm:py-1 md:px-4 md:py-1.5"
      style={{
        background: "transparent",
        borderBottom: "none",
        backdropFilter: "none",
        WebkitBackdropFilter: "none",
      }}
    >
      <WhaleLogo />

      <div className="flex items-center gap-1 sm:gap-2">
        <div className="lg:hidden">
          <MobileSidebar isAdmin={isAdmin} logoutAction={logoutAction} />
        </div>
        <div className="hidden text-right lg:block">
          <Tooltip content={email || name} placement="bottom" delay={450} wrapperClassName="block">
            <p className="text-xs font-medium leading-4">{name}</p>
          </Tooltip>
        </div>
        <BackgroundMotionToggle />
        <ThemeToggle />
      </div>
    </header>
  );
};
