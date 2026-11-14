import { useEffect, useState } from 'react';

export interface ImageSize {
  width: number;
  height: number;
}

/** Natural pixel size of an image, or null until it has loaded. */
export function useNaturalSize(url: string | undefined): ImageSize | null {
  const [size, setSize] = useState<ImageSize | null>(null);

  useEffect(() => {
    if (!url) {
      setSize(null);
      return;
    }
    let current = true;
    const img = new Image();
    img.onload = () => {
      if (current) {
        setSize({ width: img.naturalWidth, height: img.naturalHeight });
      }
    };
    img.src = url;
    return () => {
      current = false;
    };
  }, [url]);

  return size;
}
