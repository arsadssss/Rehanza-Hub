import React from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarNav } from "./_components/sidebar-nav";
import { MobileHeader } from "./_components/mobile-header";
import { TopNavbar } from "./_components/top-navbar";
import { MobileBottomNav } from "./_components/mobile-bottom-nav";
import { AccountInitializer } from "@/components/account-initializer";
import { OrderNotificationListener } from "@/components/meesho/order-notification-listener";
import { AiChatProvider } from "@/components/ai/ai-chat-context";
import { AiCopilotModal } from "@/components/ai/ai-copilot-modal";
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
      <OrderNotificationListener />
      <AiChatProvider>
        <div className="dashboard-shell flex min-h-screen w-full">
          <SidebarNav />
          <main className="relative flex min-w-0 flex-1 flex-col bg-transparent">
            <TopNavbar />
            <MobileHeader />
            <div className="flex-1 w-full pb-20 md:pb-0">
              {children}
            </div>
            <MobileBottomNav />
          </main>
        </div>
        <AiCopilotModal />
      </AiChatProvider>
    </SidebarProvider>
  );
}
