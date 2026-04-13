import Image from "next/image";

import { signOut } from "@/auth";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { BackgroundMotionToggle } from "@/components/layout/background-motion-toggle";
import { LogoutButton } from "@/components/layout/logout-button";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { JobsStatusIndicator } from "@/components/layout/jobs-status-indicator";
import { Tooltip } from "@/components/ui/tooltip";

type HeaderProps = {
  name: string;
  email: string;
  isAdmin: boolean;
};

export const Header = ({ name, email, isAdmin }: HeaderProps) => {
  const logoutAction = async () => {
    "use server";
    await signOut({ redirectTo: "/login" });
  };

  return (
    <header className="flex items-center justify-between bg-transparent px-2 py-0.5 sm:px-3 sm:py-1 md:px-4 md:py-1.5">
      <div>
        <Image
          src="/logo.svg"
          alt="CGN-Agent logo"
          width={170}
          height={54}
          priority
          className="logo-light h-auto w-[92px] sm:w-[120px] md:w-[136px]"
        />
        <Image
          src="/logo-dark.svg"
          alt="CGN-Agent logo"
          width={170}
          height={54}
          priority
          className="logo-dark h-auto w-[92px] sm:w-[120px] md:w-[136px]"
        />
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <JobsStatusIndicator />
        <div className="lg:hidden">
          <MobileSidebar isAdmin={isAdmin} />
        </div>
        <div className="hidden text-right lg:block">
          <Tooltip content={email || name} placement="bottom" delay={450} wrapperClassName="block">
            <p className="text-xs font-medium leading-4">{name}</p>
          </Tooltip>
        </div>
        <BackgroundMotionToggle />
        <ThemeToggle />
        <LogoutButton action={logoutAction} />
      </div>
    </header>
  );
};
