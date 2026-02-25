import React from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarNav } from "./_components/sidebar-nav";
import { MobileHeader } from "./_components/mobile-header";
import { cookies } from "next/headers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sidebarState = cookieStore.get("sidebar_state")?.value;
  
  const defaultOpen = sidebarState === undefined ? true : sidebarState === "true";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <div className="flex min-h-screen">
        <SidebarNav />
        <main className="flex-1 min-w-0 bg-background flex flex-col">
          <MobileHeader />
          <div className="flex-1 w-full">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}