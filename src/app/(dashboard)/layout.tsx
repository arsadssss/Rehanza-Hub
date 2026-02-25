import React from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarNav } from "./_components/sidebar-nav";
import { MobileHeader } from "./_components/mobile-header";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check session
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const sidebarState = cookieStore.get("sidebar_state")?.value;
  
  // Default to true (open) if the cookie is missing
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
