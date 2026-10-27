export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title?: string
  description?: string
  action?: React.ReactNode
}) {
  if (!title && !description && !action) return null

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-white/[0.06] pb-6">
      {(title || description) && (
        <div className="space-y-1 min-w-0">
          {title && (
            <h1 className="font-accent text-[22px] font-bold tracking-[0.01em] text-white">{title}</h1>
          )}
          {description && (
            <p className="text-[12.5px] text-ta-muted">{description}</p>
          )}
        </div>
      )}
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  )
}
