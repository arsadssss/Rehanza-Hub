
"use client";

import React from 'react';
import { formatINR } from '@/lib/format';
import { cn } from '@/lib/utils';
import styles from './InventoryValueCard.module.css';

interface InventoryValueCardProps {
  title: string;
  amount: number;
  subtitle?: string;
  className?: string;
}

export function InventoryValueCard({ title, amount, subtitle, className }: InventoryValueCardProps) {
  return (
    <div className={cn(styles.card, className)}>
      <div className={styles.background} />
      <div className={styles.content}>
        <h3 className={styles.title}>{title}</h3>
        <h1 className={styles.amount}>{formatINR(amount)}</h1>
        <div className={styles.divider} />
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
    </div>
  );
}
