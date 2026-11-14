import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useViewer } from '../../../context/ViewerContext.js';
import { RegionOverlay } from '../RegionOverlay.js';
import { Viewport } from '../Viewport.js';

export const DiffHighlightView: React.FC = () => {
  const { activeStory } = useViewer();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  // True when pixels cannot be read in this browser context, for example when
  // a report is opened from disk. The diff image made at test time is shown.
  const [pixelsUnavailable, setPixelsUnavailable] = useState(false);

  const baselineUrl = activeStory?.baselineUrl || '';
  const candidateUrl = activeStory?.candidateUrl || '';
  const diffUrl = activeStory?.diffUrl || '';

  useEffect(() => {
    if (!activeStory) return;

    let isMounted = true;
    setLoading(true);
    setPixelsUnavailable(false);

    const baseImg = new Image();
    baseImg.crossOrigin = 'anonymous';
    const candImg = new Image();
    candImg.crossOrigin = 'anonymous';

    let loadedCount = 0;
    const fallBackToDiffImage = () => {
      if (!isMounted) return;
      setPixelsUnavailable(true);
      setLoading(false);
    };
    const checkRender = () => {
      loadedCount++;
      if (loadedCount < 2) return;
      if (!isMounted) return;
      try {
        renderPixels();
      } catch {
        // Reading pixels of a cross-origin or file image throws a SecurityError.
        fallBackToDiffImage();
      }
    };
    const renderPixels = () => {
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

      // Changed pixels use the accent colour over a faded backdrop.
      const hr = 61;
      const hg = 61;
      const hb = 245;

      for (let i = 0; i < baseData.length; i += 4) {
        const br = baseData[i] ?? 0;
        const bg = baseData[i + 1] ?? 0;
        const bb = baseData[i + 2] ?? 0;
        const ba = baseData[i + 3] ?? 0;

        const cr = candData[i] ?? 0;
        const cg = candData[i + 1] ?? 0;
        const cb = candData[i + 2] ?? 0;
        const ca = candData[i + 3] ?? 0;

        const dr = Math.abs(cr - br);
        const dg = Math.abs(cg - bg);
        const db = Math.abs(cb - bb);
        const da = Math.abs(ca - ba);

        const isChanged = dr + dg + db + da > 10;

        if (isChanged) {
          // Changed pixel
          output[i] = hr;
          output[i + 1] = hg;
          output[i + 2] = hb;
          output[i + 3] = 255;
        } else {
          // Faded, desaturated candidate backdrop
          const gray = Math.round(cr * 0.299 + cg * 0.587 + cb * 0.114);
          const faded = Math.round(gray * 0.2 + 192);
          output[i] = faded;
          output[i + 1] = faded;
          output[i + 2] = faded;
          output[i + 3] = ca;
        }
      }

      ctx.putImageData(outData, 0, 0);
      setLoading(false);
    };

    baseImg.onload = checkRender;
    baseImg.onerror = fallBackToDiffImage;
    candImg.onload = checkRender;
    candImg.onerror = fallBackToDiffImage;

    baseImg.src = baselineUrl || candidateUrl || diffUrl;
    candImg.src = candidateUrl || baselineUrl || diffUrl;

    return () => {
      isMounted = false;
    };
  }, [activeStory, baselineUrl, candidateUrl, diffUrl]);

  if (!activeStory) return null;

  return (
    <Viewport sourceUrl={candidateUrl || baselineUrl}>
      {loading ? <div className="text-ink-3">Rendering changes</div> : null}
      <div
        className={`relative inline-block image-edge ${
          loading ? 'hidden' : ''
        }`}
      >
        {pixelsUnavailable ? (
          <img
            src={diffUrl || candidateUrl}
            alt={`Changed areas of ${activeStory.name}`}
            className="block max-w-none pointer-events-none"
          />
        ) : (
          <canvas
            ref={canvasRef}
            aria-label={`Changed areas of ${activeStory.name}`}
            className="block pointer-events-none"
          />
        )}
        <RegionOverlay />
      </div>
    </Viewport>
  );
};
