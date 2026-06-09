import { useMemo, useState } from "react";

export function usePagination<T>(items: T[], pageSize = 20) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const paged = useMemo(() => items.slice(start, end), [items, start, end]);

  return {
    page: safePage,
    setPage,
    pageCount,
    pageSize,
    total,
    start: total === 0 ? 0 : start + 1,
    end,
    paged,
  };
}
