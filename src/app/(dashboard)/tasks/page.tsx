
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  PlusCircle, 
  Pencil, 
  Trash2, 
  FileText, 
  User, 
  Zap,
  Image as ImageIcon,
  ShoppingBag,
  Package,
  Calendar,
  CheckCircle2,
  MoreHorizontal,
  ChevronRight,
  Clock,
  BarChart3,
  Sparkles
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

const CircularIndicator = ({ value, colorClass }: { value: number; colorClass: string }) => {
    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (value / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center w-12 h-12 shrink-0">
            <svg className="w-full h-full -rotate-90 drop-shadow-sm">
                <circle
                    className="text-white/10"
                    strokeWidth="3"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx="24"
                    cy="24"
                />
                <circle
                    className={cn("transition-all duration-[1500ms] ease-out", colorClass.replace('bg-', 'text-'))}
                    strokeWidth="3"
                    strokeDasharray={circumference}
                    style={{ strokeDashoffset: isNaN(offset) ? circumference : offset }}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx="24"
                    cy="24"
                />
            </svg>
            <span className="absolute text-[10px] font-black text-white/90">{Math.round(value)}%</span>
        </div>
    );
};

const ProgressCard = ({ title, stats, gradient, loading, icon: Icon }: { title: string; stats: ProgressStats; gradient: string; loading: boolean; icon: React.ElementType }) => {
    const [animatedValue, setAnimatedValue] = useState(0);
    const [animatedCount, setAnimatedCount] = useState(0);

    useEffect(() => {
        if (!loading) {
            const timer = setTimeout(() => {
                setAnimatedValue(stats.percentage || 0);
                setAnimatedCount(stats.completed || 0);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [loading, stats.percentage, stats.completed]);

    const getStatusColor = (pct: number) => {
        if (pct < 30) return "bg-rose-500";
        if (pct < 70) return "bg-amber-500";
        return "bg-emerald-500";
    };

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Card className={cn(
                    "group relative text-white shadow-xl rounded-[2.5rem] border border-white/10 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl active:scale-[0.98] hover:z-30",
                    "bg-gradient-to-br backdrop-blur-xl",
                    gradient
                )}>
                    {/* Visual Content Containment Layer to avoid internal effect clipping */}
                    <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none">
                        <div className="absolute inset-0 bg-white/5 opacity-50 group-hover:opacity-10 transition-opacity" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                        
                        {/* Large Background Decorative Icon */}
                        <div className="absolute -right-6 -bottom-6 opacity-10 group-hover:opacity-20 group-hover:scale-110 group-hover:-rotate-12 transition-all duration-700 pointer-events-none">
                            <Icon size={140} strokeWidth={1} />
                        </div>
                    </div>

                    {loading ? (
                        <CardContent className="p-8">
                            <Skeleton className="h-6 w-32 bg-white/20 rounded-lg" />
                            <div className="mt-8 space-y-4">
                                <Skeleton className="h-3 w-full bg-white/20 rounded-full" />
                                <div className="flex justify-between">
                                    <Skeleton className="h-5 w-24 bg-white/20 rounded-md" />
                                    <Skeleton className="h-5 w-12 bg-white/20 rounded-md" />
                                </div>
                            </div>
                        </CardContent>
                    ) : (
                        <CardContent className="p-8 relative z-10">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 group-hover:text-white transition-colors duration-300">
                                        {title}
                                    </h3>
                                    <div className="flex items-center gap-3 mt-1">
                                        <div className="text-4xl font-black font-headline tracking-tighter drop-shadow-md">
                                            {animatedValue.toFixed(0)}%
                                        </div>
                                        <div className={cn(
                                            "h-2 w-2 rounded-full animate-pulse",
                                            stats.percentage >= 100 ? "bg-emerald-400" : "bg-white/40"
                                        )} />
                                    </div>
                                </div>
                                <CircularIndicator value={animatedValue} colorClass={getStatusColor(stats.percentage)} />
                            </div>

                            <div className="mt-10 space-y-4">
                                <div className="relative h-3 w-full bg-black/20 rounded-full overflow-hidden border border-white/5 shadow-inner">
                                    <div 
                                        className={cn(
                                            "h-full transition-all duration-[1200ms] ease-out relative rounded-full shadow-lg",
                                            getStatusColor(stats.percentage)
                                        )}
                                        style={{ width: `${animatedValue}%` }}
                                    >
                                        {/* Premium Shimmer Sweep Effect */}
                                        <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-shimmer" />
                                    </div>
                                </div>
                                
                                <div className="flex justify-between items-center">
                                    <div className="flex items-baseline gap-1.5 bg-white/10 px-3 py-1 rounded-2xl backdrop-blur-md border border-white/10">
                                        <span className="text-xl font-black tracking-tight">{animatedCount}</span>
                                        <span className="text-[9px] font-black text-white/50 uppercase tracking-widest">/ {stats.total} COMPLETED</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-tighter px-3 py-1.5 bg-black/20 rounded-xl backdrop-blur-sm border border-white/5 group-hover:bg-white/10 transition-colors">
                                        <Icon className="h-3 w-3 opacity-70" />
                                        <span>{stats.percentage >= 100 ? "Fully Synced" : "Operational"}</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    )}
                </Card>
            </TooltipTrigger>
            <TooltipContent className="rounded-2xl border-white/10 bg-slate-900/95 backdrop-blur-xl font-black text-[10px] uppercase tracking-[0.2em] px-5 py-3 shadow-2xl z-[9999]">
                {stats.completed} OUT OF {stats.total} WORKFLOWS COMPLETE
            </TooltipContent>
        </Tooltip>
    );
};

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
    const [pageSize] = useState(25);
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

    const updateTaskStatus = async (id: string, newStatus: Task['status']) => {
        const originalTasks = [...tasks];
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
        
        try {
            const res = await apiFetch('/api/tasks', {
                method: 'PUT',
                body: JSON.stringify({ id, status: newStatus })
            });
            if (!res.ok) throw new Error();
            toast({ title: "Status Updated", description: `Task is now ${newStatus}` });
        } catch (e) {
            setTasks(originalTasks);
            toast({ variant: 'destructive', title: "Update Failed" });
        }
    };

    const updateListingStep = async (id: string, step: keyof Task['listing_steps'], val: boolean) => {
        const task = tasks.find(t => t.id === id);
        if (!task || !task.listing_steps) return;

        const newSteps = { ...task.listing_steps, [step]: val };
        
        // Optimistic update
        const originalTasks = [...tasks];
        setTasks(prev => prev.map(t => {
            if (t.id === id) {
                const completed = Object.values(newSteps).filter(Boolean).length;
                const total = Object.values(newSteps).length;
                let status: Task['status'] = completed === 0 ? 'Pending' : completed === total ? 'Completed' : 'In Progress';
                return { ...t, listing_steps: newSteps, status };
            }
            return t;
        }));

        try {
            const res = await apiFetch('/api/tasks', {
                method: 'PUT',
                body: JSON.stringify({ id, listing_steps: newSteps, is_listing_task: true })
            });
            if (!res.ok) throw new Error();
        } catch (e) {
            setTasks(originalTasks);
            toast({ variant: 'destructive', title: "Update Failed" });
        }
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
        const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

        const cycleStatus = () => {
            const sequence: Task['status'][] = ['Pending', 'In Progress', 'Completed'];
            const next = sequence[(sequence.indexOf(task.status) + 1) % sequence.length];
            updateTaskStatus(task.id, next);
        };

        return (
            <TableRow key={task.id} className={cn(
                "group/row relative transition-all duration-300 border-l-4",
                task.is_today ? "border-l-primary bg-primary/[0.02]" : "border-l-transparent",
                task.status === 'Completed' && "opacity-60"
            )}>
                <TableCell className="px-6 py-4">
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                            <span className={cn(
                                "font-bold text-sm tracking-tight transition-all",
                                task.status === 'Completed' && "line-through text-muted-foreground"
                            )}>
                                {task.task_name}
                            </span>
                            {task.notes && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-muted-foreground hover:text-primary transition-colors" onClick={() => setViewingTaskNotes(task)}>
                                    <FileText className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                            <span>{task.task_group}</span>
                            <span className="h-1 w-1 rounded-full bg-border" />
                            <span className={cn(task.is_listing_task && "text-primary")}>
                                {task.is_listing_task ? "Marketplace Listing" : "General Task"}
                            </span>
                        </div>
                    </div>
                </TableCell>

                <TableCell className="w-[240px]">
                    {task.is_listing_task && task.listing_steps ? (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-1.5">
                                <button 
                                    onClick={() => updateListingStep(task.id, 'imageGeneration', !task.listing_steps?.imageGeneration)}
                                    className={cn(
                                        "px-2 py-1 rounded-md text-[9px] font-black uppercase transition-all flex items-center gap-1 border",
                                        task.listing_steps.imageGeneration ? "bg-indigo-500 text-white border-indigo-600" : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                                    )}
                                >
                                    <ImageIcon className="h-2.5 w-2.5" /> Img
                                </button>
                                <button 
                                    onClick={() => updateListingStep(task.id, 'meesho', !task.listing_steps?.meesho)}
                                    className={cn(
                                        "px-2 py-1 rounded-md text-[9px] font-black uppercase transition-all flex items-center gap-1 border",
                                        task.listing_steps.meesho ? "bg-pink-500 text-white border-pink-600" : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                                    )}
                                >
                                    <ShoppingBag className="h-2.5 w-2.5" /> Msh
                                </button>
                                <button 
                                    onClick={() => updateListingStep(task.id, 'flipkart', !task.listing_steps?.flipkart)}
                                    className={cn(
                                        "px-2 py-1 rounded-md text-[9px] font-black uppercase transition-all flex items-center gap-1 border",
                                        task.listing_steps.flipkart ? "bg-amber-500 text-white border-amber-600" : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                                    )}
                                >
                                    <Package className="h-2.5 w-2.5" /> Fkt
                                </button>
                                <button 
                                    onClick={() => updateListingStep(task.id, 'amazon', !task.listing_steps?.amazon)}
                                    className={cn(
                                        "px-2 py-1 rounded-md text-[9px] font-black uppercase transition-all flex items-center gap-1 border",
                                        task.listing_steps.amazon ? "bg-slate-800 text-white border-black" : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                                    )}
                                >
                                    <Zap className="h-2.5 w-2.5" /> Amz
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <Progress value={progressPercent} className="h-1 flex-1 bg-muted" />
                                <span className="text-[9px] font-black text-muted-foreground">{Math.round(progressPercent)}%</span>
                            </div>
                        </div>
                    ) : (
                        <span className="text-[10px] font-bold text-muted-foreground/40 italic">N/A</span>
                    )}
                </TableCell>

                <TableCell>
                    <button 
                        onClick={cycleStatus}
                        className={cn(
                            "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all hover:scale-105 active:scale-95",
                            task.status === 'Pending' && "bg-slate-100 text-slate-600 border border-slate-200",
                            task.status === 'In Progress' && "bg-amber-100 text-amber-700 border border-amber-200 shadow-sm shadow-amber-100",
                            task.status === 'Completed' && "bg-emerald-100 text-emerald-700 border border-emerald-200"
                        )}
                    >
                        {task.status === 'In Progress' && <Clock className="h-2.5 w-2.5 inline mr-1 animate-pulse" />}
                        {task.status === 'Completed' && <CheckCircle2 className="h-2.5 w-2.5 inline mr-1" />}
                        {task.status}
                    </button>
                </TableCell>

                <TableCell>
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-muted border-2 border-white flex items-center justify-center text-[10px] font-black text-muted-foreground shadow-sm">
                            {(task.created_by_name || "S").charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-bold text-foreground/70">{task.created_by_name || "Ahmad"}</span>
                    </div>
                </TableCell>

                <TableCell className="text-xs font-bold text-muted-foreground/80">
                    <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(task.task_date), 'dd MMM')}
                    </div>
                </TableCell>

                <TableCell className="text-right px-6">
                    <div className="flex items-center justify-end gap-1">
                        {task.is_today ? (
                            <div className="flex items-center gap-1">
                                <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-black py-0 px-2 h-7 rounded-lg">✓ TODAY</Badge>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-rose-500 hover:bg-rose-50 rounded-lg"
                                    onClick={() => handleToggleToday(task, false)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-[10px] font-black uppercase tracking-tighter rounded-lg border-primary/20 text-primary hover:bg-primary hover:text-white transition-all opacity-0 group-hover/row:opacity-100"
                                onClick={() => handleToggleToday(task, true)}
                                disabled={task.status === 'Completed'}
                            >
                                Move to Today
                            </Button>
                        )}
                        <div className="flex gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary rounded-lg" onClick={() => handleOpenModal(task)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive rounded-lg" onClick={() => setItemToDelete({id: task.id, description: task.task_name})}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                    </div>
                </TableCell>
            </TableRow>
        );
    }

    return (
        <div className="w-full px-6 py-6 space-y-8 bg-gray-50/50 dark:bg-black/50 min-h-full font-body">
            <AddTaskModal isOpen={isModalOpen} onClose={handleCloseModal} onSuccess={handleSuccess} task={taskToEdit} />
             <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
                <AlertDialogContent className="rounded-[2.5rem]">
                    <AlertDialogHeader>
                    <AlertDialogTitle className="font-headline text-2xl font-bold">Confirm Deletion</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently remove the task record. This action cannot be reversed.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4">
                    <AlertDialogCancel className="rounded-xl border-0 bg-muted hover:bg-muted/80">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90 rounded-xl px-8 font-bold">Delete Task</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Dialog open={!!viewingTaskNotes} onOpenChange={() => setViewingTaskNotes(null)}>
                <DialogContent className="rounded-[2.5rem] sm:max-w-lg">
                    <DialogHeader>
                        <div className="p-3 bg-primary/10 rounded-2xl w-fit mb-4 text-primary">
                            <FileText className="h-6 w-6" />
                        </div>
                        <DialogTitle className="font-headline text-2xl font-bold">{viewingTaskNotes?.task_name}</DialogTitle>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pt-1">Task Context & Notes</p>
                    </DialogHeader>
                    <div className="text-sm text-foreground/80 py-6 max-h-[400px] overflow-y-auto whitespace-pre-wrap leading-relaxed border-y my-2">
                        {viewingTaskNotes?.notes || "No additional briefing provided for this task."}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setViewingTaskNotes(null)} className="rounded-xl px-8 font-bold">Close Brief</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Premium Performance Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full relative z-20">
                <ProgressCard title="Account Completion" stats={progressStats.overall} gradient="from-indigo-600 to-violet-700" icon={BarChart3} loading={loadingProgress} />
                <ProgressCard title="Fashion Workflow" stats={progressStats.fashion} gradient="from-blue-600 to-cyan-700" icon={ShoppingBag} loading={loadingProgress} />
                <ProgressCard title="Cosmetics Workflow" stats={progressStats.cosmetics} gradient="from-pink-600 to-rose-700" icon={Sparkles} loading={loadingProgress} />
            </div>

            <Card className="relative z-10 border-0 shadow-2xl rounded-[2.5rem] overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
                <CardHeader className="bg-muted/20 pb-8 border-b border-border/50 px-8 pt-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <div className="p-2 bg-primary rounded-xl shadow-lg shadow-primary/20">
                                    <Zap className="h-5 w-5 text-white" />
                                </div>
                                <CardTitle className="font-headline text-3xl font-black tracking-tight">Execution Engine</CardTitle>
                            </div>
                            <CardDescription className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/60 ml-1">Command center for marketplace operations</CardDescription>
                        </div>
                        <Button onClick={() => handleOpenModal()} className="font-black h-12 px-8 rounded-xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all bg-primary text-primary-foreground">
                            <PlusCircle className="mr-2 h-5 w-5" /> CREATE TASK
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-8 px-8">
                    <div className="flex flex-col md:flex-row gap-4 mb-8">
                        <Select value={groupFilter} onValueChange={setGroupFilter}>
                            <SelectTrigger className="w-full md:w-[220px] h-11 bg-background rounded-xl border-border/50 font-bold text-xs uppercase tracking-tight"><SelectValue placeholder="All Categories" /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="all" className="text-xs font-bold">ALL CATEGORIES</SelectItem>
                                <SelectItem value="Fashion" className="text-xs font-bold">FASHION</SelectItem>
                                <SelectItem value="Cosmetics" className="text-xs font-bold">COSMETICS</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full md:w-[220px] h-11 bg-background rounded-xl border-border/50 font-bold text-xs uppercase tracking-tight"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="all" className="text-xs font-bold">ALL STATUSES</SelectItem>
                                <SelectItem value="Pending" className="text-xs font-bold">PENDING</SelectItem>
                                <SelectItem value="In Progress" className="text-xs font-bold">IN PROGRESS</SelectItem>
                                <SelectItem value="Completed" className="text-xs font-bold">COMPLETED</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Tabs defaultValue="today" className="w-full">
                        <TabsList className="bg-muted/50 p-1.5 rounded-2xl mb-8 flex w-fit h-auto">
                            <TabsTrigger value="today" className="rounded-xl px-10 py-3 font-black uppercase tracking-widest text-[10px] flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-primary transition-all">
                                <Zap className="h-3.5 w-3.5" /> TODAY QUEUE ({todayTasks.length})
                            </TabsTrigger>
                            <TabsTrigger value="all" className="rounded-xl px-10 py-3 font-black uppercase tracking-widest text-[10px] flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-primary transition-all">
                                <ChevronRight className="h-3.5 w-3.5" /> FULL BACKLOG ({totalRows})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="today" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="rounded-[2rem] border border-border/50 overflow-hidden bg-background/40 shadow-inner">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow className="h-14 border-border/50 hover:bg-transparent">
                                            <TableHead className="px-6 font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Task Overview</TableHead>
                                            <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Workflow Steps</TableHead>
                                            <TableHead className="w-[140px] font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Live Status</TableHead>
                                            <TableHead className="w-[160px] font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Owner</TableHead>
                                            <TableHead className="w-[100px] font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Deadline</TableHead>
                                            <TableHead className="text-right w-[180px] px-6 font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loadingTasks ? (
                                            Array.from({ length: 3 }).map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-12 w-full opacity-40"/></TableCell></TableRow>)
                                        ) : todayTasks.length > 0 ? (
                                            todayTasks.map(task => <TaskRow key={task.id} task={task} />)
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-64 text-center text-muted-foreground">
                                                    <div className="flex flex-col items-center gap-4 opacity-30">
                                                        <div className="p-6 bg-muted rounded-full">
                                                            <Zap className="h-12 w-12" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-lg font-black uppercase tracking-widest">Active Queue Empty</p>
                                                            <p className="text-xs font-medium">Promote tasks from the backlog to start the execution clock.</p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>

                        <TabsContent value="all" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="rounded-[2rem] border border-border/50 overflow-hidden bg-background/40 shadow-inner">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow className="h-14 border-border/50 hover:bg-transparent">
                                            <TableHead className="px-6 font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Task Overview</TableHead>
                                            <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Workflow Steps</TableHead>
                                            <TableHead className="w-[140px] font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Live Status</TableHead>
                                            <TableHead className="w-[160px] font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Owner</TableHead>
                                            <TableHead className="w-[100px] font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Deadline</TableHead>
                                            <TableHead className="text-right w-[180px] px-6 font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loadingTasks ? (
                                            Array.from({ length: 5 }).map((_, i) => (
                                                <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-12 w-full opacity-40"/></TableCell></TableRow>
                                            ))
                                        ) : tasks.length > 0 ? (
                                            tasks.map(task => <TaskRow key={task.id} task={task} />)
                                        ) : (
                                            <TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic">No historical tasks identified in the system registry.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center justify-between py-8 gap-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground ml-2">
                                    Registry Volume: <span className="text-foreground">{totalRows} RECORDS</span>
                                </p>
                                <div className="flex items-center gap-3">
                                    <Button variant="outline" size="sm" className="h-10 px-6 rounded-xl font-black text-[10px] uppercase tracking-tighter border-border/50 shadow-sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>Previous</Button>
                                    <div className="bg-muted/50 h-10 px-4 flex items-center rounded-xl text-[10px] font-black text-muted-foreground">PAGE {page}</div>
                                    <Button variant="outline" size="sm" className="h-10 px-6 rounded-xl font-black text-[10px] uppercase tracking-tighter border-border/50 shadow-sm" onClick={() => setPage(p => + 1)} disabled={(page * pageSize) >= totalRows}>Next</Button>
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
