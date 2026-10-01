"use client";

import React, { useRef, useState, useEffect } from "react";
import { Button } from "./Button";

export function SignaturePad({ onChange }: { onChange: (data: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set real size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0F1220";
  }, []);

  const startDraw = (x: number, y: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (x: number, y: number) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && hasDrawn) {
      onChange(canvas.toDataURL());
    }
  };

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onChange(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="border border-[#E5E7EB] rounded-[10px] overflow-hidden bg-white relative">
        <canvas
          ref={canvasRef}
          className="w-full h-[200px] touch-none cursor-crosshair"
          onMouseDown={(e) => { const coords = getCoordinates(e); startDraw(coords.x, coords.y); }}
          onMouseMove={(e) => { const coords = getCoordinates(e); draw(coords.x, coords.y); }}
          onMouseUp={endDraw}
          onMouseOut={endDraw}
          onTouchStart={(e) => { const coords = getCoordinates(e); startDraw(coords.x, coords.y); }}
          onTouchMove={(e) => { const coords = getCoordinates(e); draw(coords.x, coords.y); }}
          onTouchEnd={endDraw}
          onTouchCancel={endDraw}
        />
        {!hasDrawn && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-[#9CA3AF] text-[15px]">
            Draw your signature here
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <Button variant="ghost" type="button" onClick={clear} className="!min-h-[32px] !text-[13px] !px-3">
          Clear signature
        </Button>
      </div>
    </div>
  );
}
