import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useViewer } from '../../../context/ViewerContext.js';

export const DiffHighlightView: React.FC = () => {
  const { activeStory } = useViewer();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);

  const baselineUrl = activeStory?.baselineUrl || '';
  const candidateUrl = activeStory?.candidateUrl || '';
  const diffUrl = activeStory?.diffUrl || '';

  useEffect(() => {
    if (!activeStory) return;

    let isMounted = true;
    setLoading(true);

    const baseImg = new Image();
    baseImg.crossOrigin = 'anonymous';
    const candImg = new Image();
    candImg.crossOrigin = 'anonymous';

    let loadedCount = 0;
    const checkRender = () => {
      loadedCount++;
      if (loadedCount < 2) return;
      if (!isMounted) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const w = Math.max(baseImg.naturalWidth || 1, candImg.naturalWidth || 1);
      const h = Math.max(
        baseImg.naturalHeight || 1,
        candImg.naturalHeight || 1,
      );

      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const offBase = document.createElement('canvas');
      offBase.width = w;
      offBase.height = h;
      const baseCtx = offBase.getContext('2d', { willReadFrequently: true });
      if (baseCtx) {
        baseCtx.drawImage(baseImg, 0, 0);
      }

      const offCand = document.createElement('canvas');
      offCand.width = w;
      offCand.height = h;
      const candCtx = offCand.getContext('2d', { willReadFrequently: true });
      if (candCtx) {
        candCtx.drawImage(candImg, 0, 0);
      }

      const baseData = baseCtx
        ? baseCtx.getImageData(0, 0, w, h).data
        : new Uint8ClampedArray(w * h * 4);
      const candData = candCtx
        ? candCtx.getImageData(0, 0, w, h).data
        : new Uint8ClampedArray(w * h * 4);

      const outData = ctx.createImageData(w, h);
      const output = outData.data;

      // Vivid neon green for changed pixels
      const hr = 0;
      const hg = 255;
      const hb = 102;

      for (let i = 0; i < baseData.length; i += 4) {
        const br = baseData[i]!;
        const bg = baseData[i + 1]!;
        const bb = baseData[i + 2]!;
        const ba = baseData[i + 3]!;

        const cr = candData[i]!;
        const cg = candData[i + 1]!;
        const cb = candData[i + 2]!;
        const ca = candData[i + 3]!;

        const dr = Math.abs(cr - br);
        const dg = Math.abs(cg - bg);
        const db = Math.abs(cb - bb);
        const da = Math.abs(ca - ba);

        const isChanged = dr + dg + db + da > 10;

        if (isChanged) {
          // Vivid high-contrast neon changed pixel
          output[i] = hr;
          output[i + 1] = hg;
          output[i + 2] = hb;
          output[i + 3] = 255;
        } else {
          // Muted desaturated candidate backdrop
          const gray = Math.round(cr * 0.299 + cg * 0.587 + cb * 0.114);
          output[i] = Math.round(gray * 0.45 + 50);
          output[i + 1] = Math.round(gray * 0.45 + 50);
          output[i + 2] = Math.round(gray * 0.45 + 50);
          output[i + 3] = Math.max(ca, 230);
        }
      }

      ctx.putImageData(outData, 0, 0);
      setLoading(false);
    };

    baseImg.onload = checkRender;
    baseImg.onerror = () => {
      loadedCount++;
      if (loadedCount >= 2) setLoading(false);
    };

    candImg.onload = checkRender;
    candImg.onerror = () => {
      loadedCount++;
      if (loadedCount >= 2) setLoading(false);
    };

    baseImg.src = baselineUrl || candidateUrl || diffUrl;
    candImg.src = candidateUrl || baselineUrl || diffUrl;

    return () => {
      isMounted = false;
    };
  }, [activeStory, baselineUrl, candidateUrl, diffUrl]);

  if (!activeStory) return null;

  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-white border border-zinc-200/80 rounded-2xl overflow-auto canvas-backdrop min-h-0 w-full h-full select-none text-ui-base shadow-xs">
      {loading ? (
        <div className="p-8 text-ui-medium text-zinc-400 flex items-center justify-center">
          Rendering diff highlight...
        </div>
      ) : null}
      <canvas
        ref={canvasRef}
        className={`block max-w-full h-auto pointer-events-none ${
          loading ? 'hidden' : 'block'
        }`}
      />
    </div>
  );
};
