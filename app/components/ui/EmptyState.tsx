"use client";

export function EmptyState({ title, description, action, onAction, actionLabel, children }: { title: string; description?: string; action?: React.ReactNode; onAction?: () => void; actionLabel?: string; children?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {description ? <span>{description}</span> : null}
      {action ?? children ?? (actionLabel && onAction ? <button className="secondary" onClick={onAction}>{actionLabel}</button> : null)}
    </div>
  );
}
