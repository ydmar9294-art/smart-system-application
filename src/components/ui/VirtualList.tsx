/**
 * VirtualList - Lightweight virtual scrolling component
 * Uses native IntersectionObserver for infinite scroll trigger
 * No external dependency required
 */
import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  overscan?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  onEndReached?: () => void;
  endReachedThreshold?: number;
  className?: string;
  containerHeight?: number | string;
}

export function VirtualList<T>({
  items,
  itemHeight,
  overscan = 5,
  renderItem,
  onEndReached,
  endReachedThreshold = 200,
  className = '',
  containerHeight = '100%',
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeightPx, setContainerHeightPx] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerHeightPx(entry.contentRect.height);
      }
    });
    obs.observe(el);
    setContainerHeightPx(el.clientHeight);
    return () => obs.disconnect();
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollTop(target.scrollTop);

    if (onEndReached) {
      const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
      if (distanceFromBottom < endReachedThreshold) {
        onEndReached();
      }
    }
  }, [onEndReached, endReachedThreshold]);

  const { startIndex, endIndex, totalHeight } = useMemo(() => {
    const total = items.length * itemHeight;
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeightPx / itemHeight);
    const end = Math.min(items.length - 1, start + visibleCount + overscan * 2);
    return { startIndex: start, endIndex: end, totalHeight: total };
  }, [items.length, itemHeight, scrollTop, containerHeightPx, overscan]);

  const visibleItems = useMemo(() => {
    const result = [];
    for (let i = startIndex; i <= endIndex && i < items.length; i++) {
      result.push(
        <div
          key={i}
          style={{
            position: 'absolute',
            top: i * itemHeight,
            height: itemHeight,
            width: '100%',
          }}
        >
          {renderItem(items[i], i)}
        </div>
      );
    }
    return result;
  }, [startIndex, endIndex, items, itemHeight, renderItem]);

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ position: 'relative', height: totalHeight }}>
        {visibleItems}
      </div>
    </div>
  );
}
