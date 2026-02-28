"use client"

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from "@/components/ui/progress"
import { PlusCircle, Pencil, Trash2, FileText, User, BarChart3 } from 'lucide-react';
import { AddTaskModal } from './components/add-task-modal';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/apiFetch';

export type Task = {
  id: string;
  task_name: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  task_date: string;
  task_group: 'Fashion' | 'Cosmetics';
  is_deleted: boolean;
  created_at: string;
  notes: string | null;
  created_by_name?: string;
  updated_by_name?: string;
};

type TrackRecordEntry = {
    user_name: string;
    created_by: string;
    total_tasks: number;
    pending: number;
    in_progress: number;
    completed: number;
};

type ProgressStats = {
    total: number;
    completed: number;
    percentage: number;
}

const ProgressCard = ({ title, stats, gradient, loading }: { title: string; stats: ProgressStats; gradient: string; loading: boolean }) => (
    <Card className={cn("text-white shadow-lg rounded-2xl border-0 overflow-hidden bg-gradient-to-br", gradient)}>
        {loading ? (
            <CardContent className="p-6">
                <Skeleton className="h-5 w-32 bg-white/20" />
                <Skeleton className="h-4 w-24 mt-4 bg-white/20" />
                <Skeleton className="h-4 w-full mt-2 bg-white/20" />
                <Skeleton className="h-5 w-20 mt-2 bg-white/20" />
            </CardContent>
        ) : (
            <CardContent className="p-6">
                <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
                <div className="mt-4">
                    <Progress value={stats.percentage} className="h-2 bg-white/30 [&>div]:bg-white" />
                    <div className="flex justify-between items-center mt-2 text-sm text-white/90">
                        <span>{stats.completed} / {stats.total} Completed</span>
                        <span className="font-bold">{stats.percentage.toFixed(0)}%</span>
                    </div>
                </div>
            </CardContent>
        )}
    </Card>
);

export default function TasksPage() {
    const { toast } = useToast();

    const [tasks, setTasks] = useState<Task[]>([]);
    const [progressStats, setProgressStats] = useState({
        overall: { total: 0, completed: 0, percentage: 0 },
        fashion: { total: 0, completed: 0, percentage: 0 },
        cosmetics: { total: 0, completed: 0, percentage: 0 },
    });
    const [trackRecord, setTrackRecord] = useState<TrackRecordEntry[]>([]);

    const [loadingTasks, setLoadingTasks] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(true);
    const [loadingTrackRecord, setLoadingTrackRecord] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
    const [itemToDelete, setItemToDelete] = useState<{id: string, description: string} | null>(null);
    const [viewingTaskNotes, setViewingTaskNotes] = useState<Task | null>(null);

    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [totalRows, setTotalRows] = useState(0);

    const [groupFilter, setGroupFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    const fetchTrackRecord = useCallback(async () => {
        setLoadingTrackRecord(true);
        try {
            const res = await apiFetch('/api/tasks/track-record');
            if (!res.ok) throw new Error('Failed to fetch track record');
            const json = await res.json();
            setTrackRecord(json.data || []);
        } catch (error: any) {
            console.error("Track record fetch error:", error);
        } finally {
            setLoadingTrackRecord(false);
        }
    }, []);

    const fetchPageData = useCallback(async () => {
        setLoadingTasks(true);
        setLoadingProgress(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                pageSize: pageSize.toString(),
                group: groupFilter,
                status: statusFilter,
            });
            const res = await apiFetch(`/api/tasks?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch tasks');

            const { data, count, progress } = await res.json();
            setTasks(data);
            setTotalRows(count);
            setProgressStats(progress);
            
            // Also refresh track record whenever task data changes
            fetchTrackRecord();
        } catch(error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setLoadingTasks(false);
            setLoadingProgress(false);
        }
    }, [page, pageSize, groupFilter, statusFilter, toast, fetchTrackRecord]);

    useEffect(() => { fetchPageData(); }, [fetchPageData]);
    
    useEffect(() => { setPage(1); }, [groupFilter, statusFilter]);
    
    const handleSuccess = () => {
        fetchPageData();
    };

    const handleOpenModal = (task?: Task) => {
        setTaskToEdit(task || null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setTaskToEdit(null);
        setIsModalOpen(false);
    };

    const handleConfirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            const res = await apiFetch(`/api/tasks?id=${itemToDelete.id}`, { method: 'DELETE' });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || 'Failed to delete task');
            }
            toast({ title: 'Success', description: 'The task has been deleted.' });
            handleSuccess();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error deleting task', description: error.message });
        } finally {
            setItemToDelete(null);
        }
    };

    const getStatusBadge = (status: Task['status']) => {
        switch (status) {
            case 'Pending': return 'bg-gray-500';
            case 'In Progress': return 'bg-yellow-500';
            case 'Completed': return 'bg-green-600';
            default: return 'bg-gray-400';
        }
    };
    
    const getGroupBadge = (group: Task['task_group']) => {
        switch (group) {
            case 'Fashion': return 'bg-blue-500';
            case 'Cosmetics': return 'bg-pink-500';
            default: return 'bg-gray-400';
        }
    };

    return (
        <div className="w-full px-6 py-6 space-y-8">
            <AddTaskModal isOpen={isModalOpen} onClose={handleCloseModal} onSuccess={handleSuccess} task={taskToEdit} />
             <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>This will mark the task "{itemToDelete?.description}" as deleted. This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Dialog open={!!viewingTaskNotes} onOpenChange={() => setViewingTaskNotes(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Notes for: {viewingTaskNotes?.task_name}</DialogTitle>
                    </DialogHeader>
                    <div className="text-sm text-muted-foreground py-4 max-h-60 overflow-y-auto whitespace-pre-wrap">
                        {viewingTaskNotes?.notes || "No notes have been added for this task."}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setViewingTaskNotes(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                <ProgressCard title="Overall Tasks Progress" stats={progressStats.overall} gradient="from-indigo-500 to-purple-600" loading={loadingProgress} />
                <ProgressCard title="Fashion Tasks Progress" stats={progressStats.fashion} gradient="from-blue-500 to-cyan-600" loading={loadingProgress} />
                <ProgressCard title="Cosmetics Tasks Progress" stats={progressStats.cosmetics} gradient="from-pink-500 to-rose-600" loading={loadingProgress} />
            </div>

            <Card className="border-0 shadow-md overflow-hidden">
                <CardHeader className="bg-muted/30 pb-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <CardTitle className="font-headline text-xl">Task Inventory</CardTitle>
                            <CardDescription>Comprehensive log of all operational activities.</CardDescription>
                        </div>
                        <Button onClick={() => handleOpenModal()} className="font-bold"><PlusCircle className="mr-2 h-4 w-4" /> Add New Task</Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-3 mb-6">
                        <Select value={groupFilter} onValueChange={setGroupFilter}>
                            <SelectTrigger className="w-full md:w-[200px] bg-background"><SelectValue placeholder="All Groups" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Groups</SelectItem>
                                <SelectItem value="Fashion">Fashion</SelectItem>
                                <SelectItem value="Cosmetics">Cosmetics</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full md:w-[200px] bg-background"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="In Progress">In Progress</SelectItem>
                                <SelectItem value="Completed">Completed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="rounded-xl border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50"><TableRow>
                                <TableHead className="w-[120px]">Date</TableHead>
                                <TableHead>Task Name</TableHead>
                                <TableHead className="w-[120px]">Group</TableHead>
                                <TableHead className="w-[120px]">Status</TableHead>
                                <TableHead>Created By</TableHead>
                                <TableHead className="text-right w-[100px]">Actions</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                                {loadingTasks ? (
                                    Array.from({ length: 5 }).map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full"/></TableCell></TableRow>)
                                ) : tasks.length > 0 ? (
                                    tasks.map(task => (
                                        <TableRow key={task.id} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="font-medium text-xs">{format(new Date(task.task_date), 'dd MMM yyyy')}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{task.task_name}</span>
                                                    {task.notes && (
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-primary" onClick={() => setViewingTaskNotes(task)}>
                                                            <FileText className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell><Badge className={cn("text-white text-[10px] px-2 py-0", getGroupBadge(task.task_group))}>{task.task_group}</Badge></TableCell>
                                            <TableCell><Badge className={cn("text-white text-[10px] px-2 py-0", getStatusBadge(task.status))}>{task.status}</Badge></TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <User className="h-3 w-3" />
                                                    <span className="truncate max-w-[100px]">{task.created_by_name ?? '-'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => handleOpenModal(task)}><Pencil className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => setItemToDelete({id: task.id, description: task.task_name})}><Trash2 className="h-4 w-4" /></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground italic">No tasks found matching your criteria.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="flex items-center justify-end space-x-2 py-4">
                        <span className="text-xs text-muted-foreground">{totalRows > 0 ? `Page ${page} of ${Math.ceil(totalRows / pageSize)}` : 'Page 0 of 0'}</span>
                        <Button variant="outline" size="sm" className="h-8" onClick={() => setPage(p => p - 1)} disabled={page === 1}>Previous</Button>
                        <Button variant="outline" size="sm" className="h-8" onClick={() => setPage(p => p + 1)} disabled={(page * pageSize) >= totalRows}>Next</Button>
                    </div>
                </CardContent>
            </Card>

            {/* NEW SECTION: User Task Track Record */}
            <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <BarChart3 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="font-headline text-xl">User Task Track Record</CardTitle>
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
                                {loadingTrackRecord ? (
                                    Array.from({ length: 3 }).map((_, i) => (
                                        <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-10 w-full"/></TableCell></TableRow>
                                    ))
                                ) : trackRecord.length > 0 ? (
                                    trackRecord.map((user) => {
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
        </div>
    );
}
