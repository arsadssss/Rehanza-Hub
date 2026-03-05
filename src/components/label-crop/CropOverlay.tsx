"use client";

import React from 'react';
import { Rnd } from 'react-rnd';
import { Move } from 'lucide-react';

interface CropOverlayProps {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  onUpdate: (box: { x: number; y: number; width: number; height: number }) => void;
}

export function CropOverlay({ x, y, width, height, scale, onUpdate }: CropOverlayProps) {
  return (
    <Rnd
      bounds="parent"
      scale={scale}
      size={{ width, height }}
      position={{ x, y }}
      onDragStop={(e, d) => onUpdate({ x: d.x, y: d.y, width, height })}
      onResizeStop={(e, direction, ref, delta, position) => {
        onUpdate({
          width: ref.offsetWidth,
          height: ref.offsetHeight,
          x: position.x,
          y: position.y
        });
      }}
      className="z-50"
    >
      <div className="w-full h-full relative border-2 border-primary bg-primary/5 group/box shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
        {/* The Grid Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-20" 
          style={{
            backgroundImage: `
              linear-gradient(to right, white 1px, transparent 1px),
              linear-gradient(to bottom, white 1px, transparent 1px)
            `,
            backgroundSize: '33.33% 33.33%'
          }}
        />
        
        {/* Corner Visual Indicators */}
        <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-white rounded-tl-sm shadow-sm" />
        <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-white rounded-tr-sm shadow-sm" />
        <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-white rounded-bl-sm shadow-sm" />
        <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-white rounded-br-sm shadow-sm" />
        
        {/* Drag Handle Indicator */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-primary text-white opacity-0 group-hover/box:opacity-100 transition-opacity">
          <Move className="h-3 w-3" />
        </div>
      </div>
    </Rnd>
  );
}
