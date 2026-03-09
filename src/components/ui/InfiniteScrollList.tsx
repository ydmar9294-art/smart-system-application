/**
 * InfiniteScrollList - Reusable infinite scroll trigger component
 * 
 * Uses IntersectionObserver to detect when the user scrolls near the bottom
 * and triggers fetchNextPage. Works with useCursorPagination / useInfiniteQuery.
 */
import React, { useRef, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface InfiniteScrollListProps {
  /** Are we currently fetching the next page? */
  isFetchingNextPage: boolean;
  /** Is there a next page available? */
  hasNextPage: boolean;
  /** Function to fetch the next page */
  fetchNextPage: () => void;
  /** Total items loaded so far */
  totalLoaded?: number;
  /** Optional className for the sentinel container */
  className?: string;
}

export const InfiniteScrollTrigger: React.FC<InfiniteScrollListProps> = ({
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  totalLoaded,
  className = '',
}) => {
  const { t } = useTranslation();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fetchRef = useRef(fetchNextPage);
  fetchRef.current = fetchNextPage;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          fetchRef.current();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage]);

  if (!hasNextPage && !isFetchingNextPage) return null;

  return (
    <div ref={sentinelRef} className={`flex items-center justify-center py-4 ${className}`}>
      {isFetchingNextPage && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{t('common.loadingMore', 'جاري التحميل...')}</span>
        </div>
      )}
    </div>
  );
};

/**
 * Manual "Load More" button — alternative to auto-scroll for specific contexts
 */
export const LoadMoreButton: React.FC<InfiniteScrollListProps> = ({
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  totalLoaded,
}) => {
  const { t } = useTranslation();

  if (!hasNextPage) return null;

  return (
    <button
      onClick={fetchNextPage}
      disabled={isFetchingNextPage}
      className="w-full py-3 text-sm font-bold text-primary hover:bg-primary/5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
    >
      {isFetchingNextPage ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('common.loadingMore', 'جاري التحميل...')}
        </>
      ) : (
        t('common.loadMore', 'تحميل المزيد')
      )}
      {totalLoaded != null && (
        <span className="text-xs text-muted-foreground">({totalLoaded})</span>
      )}
    </button>
  );
};
