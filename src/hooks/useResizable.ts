import { useState, useCallback } from "react";

interface UseResizableOptions {
  initialSize: number;
  minSize: number;
  maxSize: number;
}

export function useResizable({
  initialSize,
  minSize,
  maxSize,
}: UseResizableOptions): [number, (delta: number) => void] {
  const [size, setSize] = useState(initialSize);

  const handleResize = useCallback(
    (delta: number) => {
      setSize((prevSize) => {
        // For left panels: dragging right (positive delta) should increase size
        const newSize = prevSize + delta;
        return Math.max(minSize, Math.min(maxSize, newSize));
      });
    },
    [minSize, maxSize]
  );

  return [size, handleResize];
}

