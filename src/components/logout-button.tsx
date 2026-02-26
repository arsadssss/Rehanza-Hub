'use client';

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { SidebarMenuButton } from "@/components/ui/sidebar";

export function LogoutButton() {
  return (
    <SidebarMenuButton
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"
    >
      <LogOut className="h-4 w-4" />
      <span>Logout</span>
    </SidebarMenuButton>
  );
}
