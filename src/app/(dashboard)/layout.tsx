import React from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SidebarNav } from './_components/sidebar-nav';
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MobileHeader } from './_components/mobile-header';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <SidebarNav user={user} />
        <main className="flex-1 min-w-0 bg-background">
          <MobileHeader />
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
