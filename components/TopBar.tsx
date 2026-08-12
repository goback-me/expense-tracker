"use client";

import { useRouter } from "next/navigation";

export default function TopBar({
  title,
  rightIcon,
  onRightClick,
  showBack = true,
}: {
  title: string;
  rightIcon?: string;
  onRightClick?: () => void;
  showBack?: boolean;
}) {
  const router = useRouter();

  return (
    <header className="safe-top sticky top-0 z-40 flex h-16 w-full shrink-0 items-center justify-between border-b border-outline-variant bg-background px-container-margin">
      {showBack ? (
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="flex items-center justify-center p-2 -ml-2 active:opacity-70"
        >
          <span className="material-symbols-outlined text-primary">
            arrow_back
          </span>
        </button>
      ) : (
        <div className="w-6" />
      )}
      <h1 className="font-bold text-lg tracking-tight text-primary">
        {title}
      </h1>
      {rightIcon ? (
        <button
          onClick={onRightClick}
          aria-label={rightIcon}
          className="flex items-center justify-center p-2 -mr-2 active:opacity-70"
        >
          <span className="material-symbols-outlined text-primary">
            {rightIcon}
          </span>
        </button>
      ) : (
        <div className="w-6" />
      )}
    </header>
  );
}
