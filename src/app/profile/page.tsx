import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Mail, ShieldCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChangePasswordForm } from "./change-password-form";

/**
 * ProfilePage - A server component that displays the logged-in user's information.
 * It is protected by NextAuth getServerSession.
 */
export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  // Protection: Redirect to login if no session exists
  if (!session) {
    redirect("/login");
  }

  // NextAuth setup in lib/auth.ts ensures role, name, and email are available
  const user = session.user as any;
  const firstLetter = user?.name ? user.name.charAt(0).toUpperCase() : "U";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50/50 dark:bg-black/50 p-4 font-body py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Navigation back to dashboard */}
        <Button variant="ghost" asChild className="mb-2 text-muted-foreground hover:text-primary transition-colors">
          <Link href="/dashboard" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="font-medium">Back to Dashboard</span>
          </Link>
        </Button>
        
        <Card className="shadow-2xl border-0 rounded-[2rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
          {/* Decorative Header Gradient */}
          <div className="h-32 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600"></div>
          
          <CardHeader className="relative pb-0">
            {/* Avatar positioned over the header break */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 md:left-10 md:translate-x-0">
              <Avatar className="h-24 w-24 border-4 border-background shadow-xl">
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground font-bold">
                  {firstLetter}
                </AvatarFallback>
              </Avatar>
            </div>
            
            <div className="pt-14 text-center md:text-left">
              <CardTitle className="text-2xl font-headline font-bold text-foreground">
                {user.name}
              </CardTitle>
              <div className="flex justify-center md:justify-start mt-2">
                <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 px-3 py-1 rounded-full uppercase tracking-tighter text-[10px] font-bold">
                  {user.role}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="mt-8 space-y-4 px-6 pb-10">
            {/* User Info Sections */}
            <div className="group flex items-center gap-4 p-4 rounded-2xl bg-gray-100/50 dark:bg-white/5 border border-transparent hover:border-primary/20 transition-all duration-300">
              <div className="p-2.5 bg-primary/10 rounded-xl group-hover:scale-110 transition-transform">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Full Name</p>
                <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
              </div>
            </div>

            <div className="group flex items-center gap-4 p-4 rounded-2xl bg-gray-100/50 dark:bg-white/5 border border-transparent hover:border-primary/20 transition-all duration-300">
              <div className="p-2.5 bg-primary/10 rounded-xl group-hover:scale-110 transition-transform">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Email Address</p>
                <p className="text-sm font-semibold text-foreground truncate">{user.email}</p>
              </div>
            </div>

            <div className="group flex items-center gap-4 p-4 rounded-2xl bg-gray-100/50 dark:bg-white/5 border border-transparent hover:border-primary/20 transition-all duration-300">
              <div className="p-2.5 bg-primary/10 rounded-xl group-hover:scale-110 transition-transform">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Account Security</p>
                <p className="text-sm font-semibold text-foreground capitalize">
                  {user.role} Access Permissions
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change Password Component */}
        <ChangePasswordForm />
      </div>
    </div>
  );
}
