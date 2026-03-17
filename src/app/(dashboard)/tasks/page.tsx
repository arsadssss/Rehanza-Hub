"use client"

import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  PlusCircle, 
  Pencil, 
  Trash2, 
  FileText, 
  User, 
  BarChart3, 
  CalendarPlus, 
  CalendarMinus, 
  CheckCircle2, 
  LayoutList, 
  Zap,
  ShoppingBag
} from 'lucide-react';
import { AddTaskModal } from './components/add-task-modal';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/apiFetch';
import { TaskPerformanceCard, type TrackRecordEntry } from '@/components/TaskPerformanceCard';

export type Task = {
  id: string;
  task_name: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  task_date: string;
  task_group: 'Fashion' | 'Cosmetics';
  is_today: boolean;
  is_listing_task: boolean;
  listing_steps: {
    imageGeneration: boolean;
    meesho: boolean;
    flipkart: boolean;
    amazon: boolean;
  } | null;
  is_deleted: boolean;
  created_at: string;
  notes: string | null;
  created_by_name?: string;
  updated_by_name?: string;
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
    const [isMounted, setIsMounted] = useState(false);

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
            
            fetchTrackRecord();
        } catch(error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setLoadingTasks(false);
            setLoadingProgress(false);
        }
    }, [page, pageSize, groupFilter, statusFilter, toast, fetchTrackRecord]);

    useEffect(() => { 
        setIsMounted(true);
        fetchPageData(); 
    }, [fetchPageData]);
    
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

    const handleToggleToday = async (task: Task, isToday: boolean) => {
        try {
            const res = await apiFetch('/api/tasks', {
                method: 'PUT',
                body: JSON.stringify({ id: task.id, quick_today_toggle: isToday })
            });
            if (!res.ok) throw new Error('Failed to update task');
            
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_today: isToday } : t));
            toast({ 
                title: isToday ? "Moved to Today" : "Removed from Today", 
                description: isToday ? "Task added to your priority queue." : "Task removed from priority queue."
            });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
        }
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

    const todayTasks = useMemo(() => tasks.filter(t => t.is_today), [tasks]);

    if (!isMounted) {
        return <div className="p-6 space-y-6"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
    }

    const TaskRow = ({ task }: { task: Task }) => {
        const completedSteps = task.listing_steps 
            ? Object.values(task.listing_steps).filter(Boolean).length 
            : 0;
        const totalSteps = task.listing_steps 
            ? Object.values(task.listing_steps).length 
            : 0;

        return (
            <TableRow key={task.id} className={cn(
                "hover:bg-muted/30 transition-colors",
                task.status === 'Completed' && "opacity-60 grayscale-[0.5]"
            )}>
                <TableCell className="font-medium text-xs whitespace-nowrap">
                    {format(new Date(task.task_date), 'dd MMM yyyy')}
                </TableCell>
                <TableCell>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <span className={cn("font-bold text-sm", task.is_today && "text-primary")}>
                                {task.task_name}
                            </span>
                            {task.is_listing_task && (
                                <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-tighter bg-primary/10 text-primary">
                                    <ShoppingBag className="h-2.5 w-2.5 mr-1" /> Listing
                                </Badge>
                            )}
                            {task.notes && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-primary" onClick={() => setViewingTaskNotes(task)}>
                                    <FileText className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                        {task.is_listing_task && task.listing_steps && (
                            <div className="flex items-center gap-2 mt-1">
                                <Progress value={(completedSteps / totalSteps) * 100} className="h-1 w-20" />
                                <span className="text-[9px] font-bold text-muted-foreground uppercase">{completedSteps}/{totalSteps} Steps</span>
                            </div>
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
                        {task.is_today ? (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-amber-600 hover:bg-amber-100"
                                onClick={() => handleToggleToday(task, false)}
                                title="Remove from Today"
                            >
                                <CalendarMinus className="h-4 w-4" />
                            </Button>
                        ) : (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-primary hover:bg-primary/10"
                                onClick={() => handleToggleToday(task, true)}
                                disabled={task.status === 'Completed'}
                                title="Move to Today"
                            >
                                <CalendarPlus className="h-4 w-4" />
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={() => handleOpenModal(task)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => setItemToDelete({id: task.id, description: task.task_name})}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                </TableCell>
            </TableRow>
        );
    }

    return (
        <div className="w-full px-6 py-6 space-y-8 bg-gray-50/50 dark:bg-black/50 min-h-full font-body">
            <AddTaskModal isOpen={isModalOpen} onClose={handleCloseModal} onSuccess={handleSuccess} task={taskToEdit} />
             <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
                <AlertDialogContent className="rounded-[2rem]">
                    <AlertDialogHeader>
                    <AlertDialogTitle className="font-headline text-xl">Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>This will mark the task "{itemToDelete?.description}" as deleted. This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90 rounded-xl">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Dialog open={!!viewingTaskNotes} onOpenChange={() => setViewingTaskNotes(null)}>
                <DialogContent className="rounded-[2rem]">
                    <DialogHeader>
                        <DialogTitle className="font-headline">Task Brief: {viewingTaskNotes?.task_name}</DialogTitle>
                    </DialogHeader>
                    <div className="text-sm text-muted-foreground py-4 max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                        {viewingTaskNotes?.notes || "No additional notes for this task."}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setViewingTaskNotes(null)} className="rounded-xl">Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                <ProgressCard title="Overall Tasks Progress" stats={progressStats.overall} gradient="from-indigo-500 to-purple-600" loading={loadingProgress} />
                <ProgressCard title="Fashion Tasks Progress" stats={progressStats.fashion} gradient="from-blue-500 to-cyan-600" loading={loadingProgress} />
                <ProgressCard title="Cosmetics Tasks Progress" stats={progressStats.cosmetics} gradient="from-pink-500 to-rose-600" loading={loadingProgress} />
            </div>

            <Card className="border-0 shadow-xl rounded-[2rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
                <CardHeader className="bg-muted/30 pb-6 border-b border-border/50">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <CardTitle className="font-headline text-2xl font-bold tracking-tight">Task Scheduling</CardTitle>
                            <CardDescription className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Manage operational execution queue and backlog.</CardDescription>
                        </div>
                        <Button onClick={() => handleOpenModal()} className="font-bold h-11 px-6 rounded-xl shadow-lg shadow-primary/20"><PlusCircle className="mr-2 h-4 w-4" /> Create New Task</Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-8">
                    <div className="flex flex-col md:flex-row gap-3 mb-8">
                        <Select value={groupFilter} onValueChange={setGroupFilter}>
                            <SelectTrigger className="w-full md:w-[200px] h-11 bg-background rounded-xl border-border/50"><SelectValue placeholder="All Groups" /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="all">All Groups</SelectItem>
                                <SelectItem value="Fashion">Fashion</SelectItem>
                                <SelectItem value="Cosmetics">Cosmetics</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full md:w-[200px] h-11 bg-background rounded-xl border-border/50"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="In Progress">In Progress</SelectItem>
                                <SelectItem value="Completed">Completed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Tabs defaultValue="today" className="w-full">
                        <TabsList className="bg-muted/50 p-1 rounded-2xl mb-6">
                            <TabsTrigger value="today" className="rounded-xl px-8 font-black uppercase tracking-widest text-[10px] flex items-center gap-2">
                                <Zap className="h-3.5 w-3.5" /> Execution Queue ({todayTasks.length})
                            </TabsTrigger>
                            <TabsTrigger value="all" className="rounded-xl px-8 font-black uppercase tracking-widest text-[10px] flex items-center gap-2">
                                <LayoutList className="h-3.5 w-3.5" /> Full Backlog ({totalRows})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="today" className="animate-in fade-in duration-500">
                            <div className="rounded-2xl border border-border/50 overflow-hidden bg-background/40">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow className="h-14 border-border/50">
                                            <TableHead className="px-6 font-bold text-[10px] uppercase tracking-[0.2em]">Date</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase tracking-[0.2em]">Priority Task Name</TableHead>
                                            <TableHead className="w-[120px] font-bold text-[10px] uppercase tracking-[0.2em]">Group</TableHead>
                                            <TableHead className="w-[120px] font-bold text-[10px] uppercase tracking-[0.2em]">Status</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase tracking-[0.2em]">Assignee</TableHead>
                                            <TableHead className="text-right w-[140px] px-6 font-bold text-[10px] uppercase tracking-[0.2em]">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loadingTasks ? (
                                            Array.from({ length: 3 }).map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-10 w-full"/></TableCell></TableRow>)
                                        ) : todayTasks.length > 0 ? (
                                            todayTasks.map(task => <TaskRow key={task.id} task={task} />)
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                                                    <div className="flex flex-col items-center gap-2 opacity-40">
                                                        <Zap className="h-10 w-10 mb-2" />
                                                        <p className="text-sm font-black uppercase tracking-widest">Priority queue is empty</p>
                                                        <p className="text-xs">Move tasks here from the backlog to start working.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>

                        <TabsContent value="all" className="animate-in fade-in duration-500">
                            <div className="rounded-2xl border border-border/50 overflow-hidden bg-background/40">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow className="h-14 border-border/50">
                                            <TableHead className="px-6 font-bold text-[10px] uppercase tracking-[0.2em]">Date</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase tracking-[0.2em]">Task Name</TableHead>
                                            <TableHead className="w-[120px] font-bold text-[10px] uppercase tracking-[0.2em]">Group</TableHead>
                                            <TableHead className="w-[120px] font-bold text-[10px] uppercase tracking-[0.2em]">Status</TableHead>
                                            <TableHead className="font-bold text-[10px] uppercase tracking-[0.2em]">Created By</TableHead>
                                            <TableHead className="text-right w-[140px] px-6 font-bold text-[10px] uppercase tracking-[0.2em]">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loadingTasks ? (
                                            Array.from({ length: 5 }).map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-10 w-full"/></TableCell></TableRow>)
                                        ) : tasks.length > 0 ? (
                                            tasks.map(task => <TaskRow key={task.id} task={task} />)
                                        ) : (
                                            <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">No tasks found in the backlog.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="flex items-center justify-between py-6">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    Total Records: <span className="text-foreground">{totalRows}</span>
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl font-bold text-[10px] uppercase tracking-tighter" onClick={() => setPage(p => p - 1)} disabled={page === 1}>Previous</Button>
                                    <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl font-bold text-[10px] uppercase tracking-tighter" onClick={() => setPage(p => p + 1)} disabled={(page * pageSize) >= totalRows}>Next</Button>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <TaskPerformanceCard data={trackRecord} loading={loadingTrackRecord} />
        </div>
    );
}
