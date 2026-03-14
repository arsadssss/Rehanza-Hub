"use client";

import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, FilterX, Calendar as CalendarIcon, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ReturnsFiltersProps {
  search: string;
  onSearchChange: (val: string) => void;
  platform: string;
  onPlatformChange: (val: string) => void;
  status: string[];
  onStatusChange: (val: string[]) => void;
  onDateRangeChange: (range: { from?: string; to?: string }) => void;
}

const STATUS_OPTIONS = [
  "RTO",
  "Customer Return",
  "Courier Return",
  "Delivered Return",
  "Rejected Return",
  "DTO",
  "EXCHANGE",
  "OTHER"
];

export function ReturnsFilters({ 
  search, 
  onSearchChange, 
  platform, 
  onPlatformChange, 
  status,
  onStatusChange,
  onDateRangeChange 
}: ReturnsFiltersProps) {
  const [date, setDate] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleDateChange = (newDate: any) => {
    setDate(newDate);
    if (newDate?.from) {
      onDateRangeChange({
        from: format(newDate.from, 'yyyy-MM-dd'),
        to: newDate.to ? format(newDate.to, 'yyyy-MM-dd') : undefined
      });
    } else {
      onDateRangeChange({});
    }
  };

  const handleStatusToggle = (option: string) => {
    if (status.includes(option)) {
      onStatusChange(status.filter(s => s !== option));
    } else {
      onStatusChange([...status, option]);
    }
  };

  const reset = () => {
    onSearchChange('');
    onPlatformChange('all');
    onStatusChange([]);
    setDate(null);
    onDateRangeChange({});
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col md:flex-row gap-4 items-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-4 rounded-2xl shadow-sm border border-border/50">
      <div className="relative flex-1 w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search Order ID, SKU or AWB..." 
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 h-11 bg-background rounded-xl border-border/50"
        />
      </div>

      <div className="flex flex-wrap md:flex-nowrap gap-3 w-full md:w-auto">
        <Select value={platform} onValueChange={onPlatformChange}>
          <SelectTrigger className="h-11 w-full md:w-[140px] bg-background rounded-xl border-border/50">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="Meesho">Meesho</SelectItem>
            <SelectItem value="Flipkart">Flipkart</SelectItem>
            <SelectItem value="Amazon">Amazon</SelectItem>
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-11 w-full md:w-[160px] rounded-xl bg-background border-border/50 justify-between font-normal text-muted-foreground">
              <span className="flex items-center truncate">
                <CheckSquare className="mr-2 h-4 w-4 shrink-0" />
                {status.length === 0 ? "Status Filter" : `${status.length} Selected`}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 rounded-xl">
            <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground">Select Statuses</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {STATUS_OPTIONS.map((option) => (
              <DropdownMenuCheckboxItem
                key={option}
                checked={status.includes(option)}
                onCheckedChange={() => handleStatusToggle(option)}
                onSelect={(e) => e.preventDefault()}
                className="rounded-lg text-xs font-medium"
              >
                {option}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-11 w-full md:w-[200px] rounded-xl bg-background border-border/50 justify-start text-left font-normal text-muted-foreground">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date?.from ? (
                date.to ? (
                  <>{format(date.from, "MMM dd") + " - " + format(date.to, "MMM dd")}</>
                ) : (
                  format(date.from, "MMM dd")
                )
              ) : (
                <span className="truncate">Return Date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 rounded-2xl" align="end">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={handleDateChange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        <Button variant="ghost" size="icon" onClick={reset} className="h-11 w-11 shrink-0 rounded-xl hover:bg-rose-500/10 hover:text-rose-500">
          <FilterX className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
