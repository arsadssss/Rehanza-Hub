import React from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
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
      <div className="flex min-h-screen bg-gray-50/50 dark:bg-black/50">
        <SidebarNav user={user} />
        <SidebarInset>
          <MobileHeader />
          {children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
