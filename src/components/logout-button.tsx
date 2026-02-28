'use client';

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-all duration-200 ease-in-out group"
    >
      <LogOut className="h-4 w-4 transition-colors group-hover:text-rose-400" />
      <span>Logout</span>
    </button>
  );
}
