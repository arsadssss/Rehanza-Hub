
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import styles from './SummaryStatCard.module.css';

interface SummaryStatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  loading?: boolean;
}

const AnimatedCounter = ({ value, duration = 1500 }: { value: number; duration?: number }) => {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const currentCount = Math.floor(progress * value);
      setCount(currentCount);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [value, duration, isVisible]);

  return <span ref={containerRef}>{count.toLocaleString()}</span>;
};

export function SummaryStatCard({ title, value, icon, loading }: SummaryStatCardProps) {
  if (loading) {
    return (
      <div className="h-32 w-full rounded-[1.25rem] bg-muted animate-pulse border border-border/50" />
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.background} />
      <div className={styles.content}>
        <div className="flex justify-between items-start w-full">
          <div>
            <p className={styles.title}>{title}</p>
            <h2 className={styles.value}>
              <AnimatedCounter value={value} />
            </h2>
          </div>
          <div className={styles.iconWrapper}>
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
}
