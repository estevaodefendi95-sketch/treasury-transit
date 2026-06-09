import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

type EmptyStateProps = {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  children?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon = "✨",
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  children,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-12 px-6 ${className}`}>
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-3xl mb-4 animate-fade-in">
        {icon}
      </div>
      <h3 className="font-semibold text-base mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      )}
      {actionLabel && (actionHref ? (
        <Button asChild>
          <Link to={actionHref as any}>{actionLabel}</Link>
        </Button>
      ) : onAction ? (
        <Button onClick={onAction}>{actionLabel}</Button>
      ) : null)}
      {children}
    </div>
  );
}
