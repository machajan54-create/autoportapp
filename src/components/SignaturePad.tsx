import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  onChange: (dataUrl: string | null) => void;
  initialDataUrl?: string | null;
}

export function SignaturePad({ onChange, initialDataUrl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(!!initialDataUrl);

  useEffect(() => {
    const c = canvasRef.current!;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = 180;
    c.width = w * dpr;
    c.height = h * dpr;
    c.style.height = h + "px";
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    if (initialDataUrl) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, w, h);
      img.src = initialDataUrl;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const start = (e: React.PointerEvent) => {
    setDrawing(true);
    const { x, y } = pos(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing) return;
    const { x, y } = pos(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  };
  const end = () => {
    setDrawing(false);
    if (hasInk) onChange(canvasRef.current!.toDataURL("image/png"));
  };
  const clear = () => {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full rounded-md border-2 border-dashed border-primary/50 bg-white touch-none"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        {!hasInk && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-sm text-muted-foreground">
              ✍️ Podepište se zde (prstem nebo myší)
            </span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-4 bottom-6 border-b border-dashed border-slate-300" />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Podepište se v rámečku výše, na řádku.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={clear}>
          Vymazat
        </Button>
      </div>
    </div>
  );
}