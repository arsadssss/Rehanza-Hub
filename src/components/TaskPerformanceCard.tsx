
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { 
    BarChart3, 
    Search, 
    TrendingUp, 
    Clock, 
    Activity, 
    CheckCircle2, 
    Zap,
    ChevronDown,
    ArrowUpRight,
    Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

export type TrackRecordEntry = {
    user_name: string;
    created_by: string;
    total_tasks: number;
    pending: number;
    in_progress: number;
    completed: number;
};

interface TaskPerformanceCardProps {
    data: TrackRecordEntry[];
    loading?: boolean;
    title?: string;
}

const AnimatedNumber = ({ value }: { value: number }) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        let start = 0;
        const end = value;
        if (start === end) return;

        const duration = 1000;
        const increment = end > start ? 1 : -1;
        const stepTime = Math.abs(Math.floor(duration / end));
        
        const timer = setInterval(() => {
            start += increment;
            setDisplayValue(start);
            if (start === end) clearInterval(timer);
        }, stepTime);

        return () => clearInterval(timer);
    }, [value]);

    return <span>{displayValue}</span>;
};

const SummaryMiniCard = ({ title, value, icon: Icon, colorClass, loading }: any) => (
    <div className="relative group overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-2xl p-4 border border-border/50 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
        <div className={cn("absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500", colorClass.replace('text-', 'text-'))}>
            <Icon size={80} />
        </div>
        <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
                <div className={cn("p-1.5 rounded-lg bg-opacity-10", colorClass.replace('text-', 'bg-'))}>
                    <Icon className={cn("h-4 w-4", colorClass)} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</span>
            </div>
            {loading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-2xl font-black font-headline tracking-tighter">
                    <AnimatedNumber value={value} />
                </div>
            )}
        </div>
    </div>
);

export function TaskPerformanceCard({ data, loading, title = "Task Performance" }: TaskPerformanceCardProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"total" | "completed" | "efficiency">("efficiency");

    const stats = useMemo(() => {
        const total = data.reduce((acc, curr) => acc + curr.total_tasks, 0);
        const pending = data.reduce((acc, curr) => acc + curr.pending, 0);
        const inProgress = data.reduce((acc, curr) => acc + curr.in_progress, 0);
        const completed = data.reduce((acc, curr) => acc + curr.completed, 0);
        return { total, pending, inProgress, completed };
    }, [data]);

    const filteredAndSortedData = useMemo(() => {
        let result = data.filter(u => u.user_name.toLowerCase().includes(searchQuery.toLowerCase()));
        
        return result.sort((a, b) => {
            if (sortBy === "total") return b.total_tasks - a.total_tasks;
            if (sortBy === "completed") return b.completed - a.completed;
            const rateA = a.total_tasks > 0 ? (a.completed / a.total_tasks) : 0;
            const rateB = b.total_tasks > 0 ? (b.completed / b.total_tasks) : 0;
            return rateB - rateA;
        });
    }, [data, searchQuery, sortBy]);

    const getEfficiencyLabel = (rate: number) => {
        if (rate >= 80) return { label: "High Efficiency", color: "text-emerald-600 bg-emerald-50 border-emerald-100" };
        if (rate >= 50) return { label: "Steady Progress", color: "text-amber-600 bg-amber-50 border-amber-100" };
        return { label: "Needs Focus", color: "text-rose-600 bg-rose-50 border-rose-100" };
    };

    return (
        <Card className="border-0 shadow-xl rounded-[2.5rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
            <CardHeader className="p-8 pb-6 border-b border-border/50 bg-muted/20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary rounded-2xl shadow-lg shadow-primary/20 text-white">
                            <BarChart3 className="h-6 w-6" />
                        </div>
                        <div>
                            <CardTitle className="font-headline text-3xl font-black tracking-tight">{title}</CardTitle>
                            <CardDescription className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Real-time team execution analytics</CardDescription>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:flex-none md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Find team member..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 h-11 bg-background/50 rounded-xl border-border/50 focus-visible:ring-primary/20"
                            />
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="h-11 rounded-xl px-4 border-border/50 font-bold text-xs uppercase tracking-tighter">
                                    <Filter className="mr-2 h-3.5 w-3.5" />
                                    Sort: {sortBy}
                                    <ChevronDown className="ml-2 h-3.5 w-3.5 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl">
                                <DropdownMenuItem onClick={() => setSortBy("efficiency")} className="text-xs font-bold uppercase">Efficiency Rate</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSortBy("total")} className="text-xs font-bold uppercase">Total Volume</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setSortBy("completed")} className="text-xs font-bold uppercase">Completion Count</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Summary Cards Layer */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
                    <SummaryMiniCard title="Total Registry" value={stats.total} icon={Zap} colorClass="text-indigo-600" loading={loading} />
                    <SummaryMiniCard title="Idle Stack" value={stats.pending} icon={Clock} colorClass="text-slate-500" loading={loading} />
                    <SummaryMiniCard title="Active Queue" value={stats.inProgress} icon={Activity} colorClass="text-blue-600" loading={loading} />
                    <SummaryMiniCard title="Success Loop" value={stats.completed} icon={CheckCircle2} colorClass="text-emerald-600" loading={loading} />
                </div>
            </CardHeader>

            <CardContent className="p-8">
                {loading ? (
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                        ))}
                    </div>
                ) : filteredAndSortedData.length > 0 ? (
                    <div className="space-y-4">
                        {filteredAndSortedData.map((user) => {
                            const completionRate = user.total_tasks > 0 
                                ? Math.round((user.completed / user.total_tasks) * 100) 
                                : 0;
                            const eff = getEfficiencyLabel(completionRate);
                            
                            return (
                                <div 
                                    key={user.created_by} 
                                    className="group relative flex flex-col lg:flex-row items-center gap-6 p-6 rounded-[2rem] border border-border/50 bg-white/40 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                                >
                                    {/* User Info */}
                                    <div className="flex items-center gap-4 min-w-[240px]">
                                        <div className="relative">
                                            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg group-hover:scale-110 transition-transform duration-500">
                                                {user.user_name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className={cn(
                                                "absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-white dark:border-slate-900",
                                                completionRate >= 80 ? "bg-emerald-500" : completionRate >= 50 ? "bg-amber-500" : "bg-rose-500"
                                            )} />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-lg tracking-tight">{user.user_name}</h4>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Execution Owner</p>
                                        </div>
                                    </div>

                                    {/* Stats Breakdown */}
                                    <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 flex-1">
                                        <Badge variant="outline" className="h-10 px-4 rounded-xl border-border/50 bg-background/50 font-bold text-xs gap-2">
                                            <span className="text-[10px] uppercase text-muted-foreground">TOTAL</span>
                                            <span className="text-sm font-black">{user.total_tasks}</span>
                                        </Badge>
                                        <Badge variant="outline" className="h-10 px-4 rounded-xl border-border/50 bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 font-bold text-xs gap-2">
                                            <span className="text-[10px] uppercase opacity-60">ACTIVE</span>
                                            <span className="text-sm font-black">{user.in_progress}</span>
                                        </Badge>
                                        <Badge variant="outline" className="h-10 px-4 rounded-xl border-emerald-100 bg-emerald-50/50 dark:bg-emerald-900/20 text-emerald-600 font-bold text-xs gap-2">
                                            <span className="text-[10px] uppercase opacity-60">DONE</span>
                                            <span className="text-sm font-black">{user.completed}</span>
                                        </Badge>
                                    </div>

                                    {/* Efficiency Visualization */}
                                    <div className="w-full lg:w-[300px] space-y-3">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <Badge className={cn("text-[9px] font-black uppercase px-2 py-0.5 rounded-md border", eff.color)}>
                                                    {eff.label}
                                                </Badge>
                                            </div>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-2xl font-black font-headline tracking-tighter">{completionRate}%</span>
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Rate</span>
                                            </div>
                                        </div>
                                        <div className="relative h-2 w-full bg-muted/50 rounded-full overflow-hidden">
                                            <div 
                                                className={cn(
                                                    "h-full transition-all duration-[1.5s] ease-out rounded-full",
                                                    completionRate >= 80 ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" : 
                                                    completionRate >= 50 ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]" : 
                                                    "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]"
                                                )}
                                                style={{ width: `${completionRate}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="hidden lg:flex flex-col items-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                                        <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Detailed Intelligence</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center gap-4 opacity-30">
                        <div className="p-6 bg-muted rounded-full">
                            <Filter className="h-12 w-12" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-xl font-black uppercase tracking-widest">No Intelligence Data</p>
                            <p className="text-xs font-medium">Try adjusting your search criteria or create new task assignments.</p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

import { Button } from '@/components/ui/button';
