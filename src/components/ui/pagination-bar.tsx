import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  page: number;
  pageCount: number;
  total: number;
  start: number;
  end: number;
  label?: string;
  onPageChange: (p: number) => void;
};

export function PaginationBar({ page, pageCount, total, start, end, label = "itens", onPageChange }: Props) {
  if (total === 0) return null;
  const visible: number[] = [];
  const win = 2;
  for (let p = Math.max(1, page - win); p <= Math.min(pageCount, page + win); p++) visible.push(p);

  return (
    <div className="flex items-center justify-between flex-wrap gap-2 pt-2 text-sm">
      <div className="text-muted-foreground">
        Mostrando <span className="font-medium text-foreground">{start}-{end}</span> de{" "}
        <span className="font-medium text-foreground">{total}</span> {label}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {visible[0] > 1 && (
          <>
            <Button variant="ghost" size="sm" onClick={() => onPageChange(1)}>1</Button>
            {visible[0] > 2 && <span className="px-1 text-muted-foreground">…</span>}
          </>
        )}
        {visible.map((p) => (
          <Button
            key={p}
            variant={p === page ? "default" : "ghost"}
            size="sm"
            onClick={() => onPageChange(p)}
          >
            {p}
          </Button>
        ))}
        {visible[visible.length - 1] < pageCount && (
          <>
            {visible[visible.length - 1] < pageCount - 1 && <span className="px-1 text-muted-foreground">…</span>}
            <Button variant="ghost" size="sm" onClick={() => onPageChange(pageCount)}>{pageCount}</Button>
          </>
        )}
        <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
