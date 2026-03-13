
"use client";

import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, FilterX, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';

interface OrderFiltersProps {
  search: string;
  onSearchChange: (val: string) => void;
  platform: string;
  onPlatformChange: (val: string) => void;
  onDateRangeChange: (range: { from?: string; to?: string }) => void;
}

export function OrderFilters({ search, onSearchChange, platform, onPlatformChange, onDateRangeChange }: OrderFiltersProps) {
  const [date, setDate] = React.useState<any>(null);

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

  const reset = () => {
    onSearchChange('');
    onPlatformChange('all');
    setDate(null);
    onDateRangeChange({});
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 items-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-4 rounded-2xl shadow-sm border border-border/50">
      <div className="relative flex-1 w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search Order ID or SKU..." 
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 h-11 bg-background rounded-xl border-border/50"
        />
      </div>

      <div className="flex gap-3 w-full md:w-auto">
        <Select value={platform} onValueChange={onPlatformChange}>
          <SelectTrigger className="h-11 w-full md:w-[160px] bg-background rounded-xl border-border/50">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="Meesho">Meesho</SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-11 w-full md:w-[240px] rounded-xl bg-background border-border/50 justify-start text-left font-normal text-muted-foreground">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date?.from ? (
                date.to ? (
                  <>{format(date.from, "LLL dd, y") + " - " + format(date.to, "LLL dd, y")}</>
                ) : (
                  format(date.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date range</span>
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

        <Button variant="ghost" size="icon" onClick={reset} className="h-11 w-11 rounded-xl hover:bg-rose-500/10 hover:text-rose-500">
          <FilterX className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
