import React from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarNav } from "./_components/sidebar-nav";
import { MobileHeader } from "./_components/mobile-header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <SidebarNav />
        <main className="flex-1 min-w-0 bg-background">
          <MobileHeader />
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
