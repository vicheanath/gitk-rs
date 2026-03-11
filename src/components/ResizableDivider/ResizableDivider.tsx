import { useState, useRef, useEffect } from "react";

interface ResizableDividerProps {
  direction: "horizontal" | "vertical";
  onResize: (delta: number) => void;
  className?: string;
}

export default function ResizableDivider({
  direction,
  onResize,
  className = "",
}: ResizableDividerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dividerRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef<number>(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    
    if (direction === "vertical") {
      startPosRef.current = e.clientX;
    } else {
      startPosRef.current = e.clientY;
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      let delta = 0;
      if (direction === "vertical") {
        // For vertical: dragging right increases left panel size
        delta = e.clientX - startPosRef.current;
      } else {
        // For horizontal: dragging down (positive delta) should increase bottom panel size
        // So we pass the delta as-is (positive when dragging down)
        delta = e.clientY - startPosRef.current;
      }
      
      if (delta !== 0) {
        onResize(delta);
        startPosRef.current = direction === "vertical" ? e.clientX : e.clientY;
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, direction, onResize]);

  const cursor = direction === "vertical" ? "col-resize" : "row-resize";
  const dimension = direction === "vertical" ? "width" : "height";
  const size = direction === "vertical" ? "4px" : "4px";

  return (
    <div
      ref={dividerRef}
      className={`resizable-divider resizable-divider-${direction} ${className} ${isDragging ? "dragging" : ""} ${isHovered ? "hovered" : ""}`}
      style={{
        cursor,
        [dimension]: size,
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    />
  );
}

