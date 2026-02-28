"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function TaskPerformanceCard({ data, loading, title = "Task Performance" }: TaskPerformanceCardProps) {
    return (
        <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl">
                        <BarChart3 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="font-headline text-xl">{title}</CardTitle>
                        <CardDescription>Individual performance metrics and contribution analysis.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-xl border overflow-hidden bg-background/50">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Team Member</TableHead>
                                <TableHead className="text-center">Total</TableHead>
                                <TableHead className="text-center">Pending</TableHead>
                                <TableHead className="text-center">In Progress</TableHead>
                                <TableHead className="text-center">Completed</TableHead>
                                <TableHead className="w-[200px]">Efficiency</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                                ))
                            ) : data && data.length > 0 ? (
                                data.map((user) => {
                                    const completionRate = user.total_tasks > 0 
                                        ? Math.round((user.completed / user.total_tasks) * 100) 
                                        : 0;
                                    
                                    return (
                                        <TableRow key={user.created_by} className="hover:bg-muted/20">
                                            <TableCell className="font-bold text-sm">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xs">
                                                        {user.user_name.charAt(0).toUpperCase()}
                                                    </div>
                                                    {user.user_name}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center font-bold">{user.total_tasks}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200">{user.pending}</Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="outline" className="text-[10px] bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200">{user.in_progress}</Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 font-black">{user.completed}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between items-center text-[10px] font-black">
                                                        <span>RATE</span>
                                                        <span className={cn(
                                                            completionRate >= 80 ? "text-emerald-600" : 
                                                            completionRate >= 50 ? "text-blue-600" : "text-amber-600"
                                                        )}>{completionRate}%</span>
                                                    </div>
                                                    <Progress 
                                                        value={completionRate} 
                                                        className="h-1.5" 
                                                    />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                                        No user metrics available yet. Create tasks to track performance.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}