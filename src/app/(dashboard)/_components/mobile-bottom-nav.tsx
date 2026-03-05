'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  BarChart2, 
  User 
} from 'lucide-react';
import { cn } from '@/lib/utils';

const bottomNavItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { href: '/products', icon: Package, label: 'Products' },
  { href: '/orders', icon: ShoppingCart, label: 'Orders' },
  { href: '/analytics', icon: BarChart2, label: 'Report' },
  { href: '/profile', icon: User, label: 'Profile' },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-border/50 flex items-center justify-around px-2 md:hidden">
      {bottomNavItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-200",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className={cn(
              "p-1.5 rounded-xl transition-colors",
              isActive && "bg-primary/10"
            )}>
              <item.icon className={cn(
                "h-5 w-5",
                isActive ? "stroke-[2.5px]" : "stroke-2"
              )} />
            </div>
            <span className={cn(
              "text-[10px] font-bold uppercase tracking-tighter",
              isActive ? "opacity-100" : "opacity-70"
            )}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
