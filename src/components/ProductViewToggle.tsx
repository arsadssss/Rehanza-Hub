
"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import styles from './ProductViewToggle.module.css';

interface ProductViewToggleProps {
  value: "products" | "variants";
  onChange: (value: "products" | "variants") => void;
}

export function ProductViewToggle({ value, onChange }: ProductViewToggleProps) {
  const isChecked = value === "variants";

  return (
    <div className={styles.toggleWrapper}>
      <span className={cn(styles.label, !isChecked && styles.activeLabel)}>
        Products
      </span>
      
      <div 
        className={cn(styles.toggleContainer, isChecked && styles.toggleContainerChecked)}
        onClick={() => onChange(isChecked ? "products" : "variants")}
      >
        {/* Stars for Variants state */}
        <div className={cn(styles.star, styles.star1)} />
        <div className={cn(styles.star, styles.star2)} />
        <div className={cn(styles.star, styles.star3)} />
        <div className={cn(styles.star, styles.star4)} />
        <div className={cn(styles.star, styles.star5)} />

        {/* Clouds for Products state */}
        <div className={styles.clouds}>
          <div className={cn(styles.cloud, styles.cloud1)} />
          <div className={cn(styles.cloud, styles.cloud2)} />
        </div>

        {/* The Sliding Circle */}
        <div className={cn(styles.handler, isChecked && styles.handlerChecked)}>
          <div className={cn(styles.crater, styles.crater1)} />
          <div className={cn(styles.crater, styles.crater2)} />
          <div className={cn(styles.crater, styles.crater3)} />
        </div>
      </div>

      <span className={cn(styles.label, isChecked && styles.activeLabel)}>
        Variants
      </span>
    </div>
  );
}
