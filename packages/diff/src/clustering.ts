import type { BoundingBox } from './types.js';

/**
 * Clusters an array of changed pixel coordinates into a concise set of bounding boxes
 * using grid spatial partitioning and connected-component labeling.
 */
export function clusterBoundingBoxes(
  changedPixels: Array<{ x: number; y: number }>,
  width: number,
  height: number,
  tileSize = 32,
): BoundingBox[] {
  if (changedPixels.length === 0) {
    return [];
  }

  const gridW = Math.ceil(width / tileSize);
  const gridH = Math.ceil(height / tileSize);
  const grid = new Uint8Array(gridW * gridH);

  for (let i = 0; i < changedPixels.length; i++) {
    const p = changedPixels[i];
    const gx = Math.floor(p.x / tileSize);
    const gy = Math.floor(p.y / tileSize);
    if (gx >= 0 && gx < gridW && gy >= 0 && gy < gridH) {
      grid[gy * gridW + gx] = 1;
    }
  }

  const visited = new Uint8Array(gridW * gridH);
  const boxes: BoundingBox[] = [];

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const idx = gy * gridW + gx;
      if (grid[idx] === 1 && visited[idx] === 0) {
        // BFS to find all connected tiles
        let minGx = gx;
        let maxGx = gx;
        let minGy = gy;
        let maxGy = gy;

        const queue: Array<[number, number]> = [[gx, gy]];
        visited[idx] = 1;

        while (queue.length > 0) {
          const item = queue.shift();
          if (!item) break;
          const [cx, cy] = item;
          if (cx < minGx) minGx = cx;
          if (cx > maxGx) maxGx = cx;
          if (cy < minGy) minGy = cy;
          if (cy > maxGy) maxGy = cy;

          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = cx + dx;
              const ny = cy + dy;
              if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH) {
                const nIdx = ny * gridW + nx;
                if (grid[nIdx] === 1 && visited[nIdx] === 0) {
                  visited[nIdx] = 1;
                  queue.push([nx, ny]);
                }
              }
            }
          }
        }

        boxes.push({
          minX: minGx * tileSize,
          minY: minGy * tileSize,
          maxX: Math.min((maxGx + 1) * tileSize, width) - 1,
          maxY: Math.min((maxGy + 1) * tileSize, height) - 1,
        });
      }
    }
  }

  return boxes;
}
