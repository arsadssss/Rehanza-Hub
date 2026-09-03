import React from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarNav } from "./_components/sidebar-nav";
import { MobileHeader } from "./_components/mobile-header";
import { MobileBottomNav } from "./_components/mobile-bottom-nav";
import { AccountInitializer } from "@/components/account-initializer";
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
      <AccountInitializer />
      <div className="dashboard-shell flex min-h-screen w-full">
        <SidebarNav />
        <main className="relative flex min-w-0 flex-1 flex-col bg-transparent">
          <MobileHeader />
          <div className="relative z-10 flex-1 w-full pb-20 md:pb-0">
            {children}
          </div>
          <MobileBottomNav />
        </main>
      </div>
    </SidebarProvider>
  );
}
