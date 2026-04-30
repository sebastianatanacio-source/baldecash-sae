import Link from 'next/link';

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="card-surface p-12 text-center max-w-2xl mx-auto">
      <div className="font-display text-[19px] font-semibold text-ink mb-2">{title}</div>
      <p className="text-[13.5px] text-muted leading-relaxed mb-6">{description}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="btn-primary inline-block">{actionLabel}</Link>
      )}
    </div>
  );
}
