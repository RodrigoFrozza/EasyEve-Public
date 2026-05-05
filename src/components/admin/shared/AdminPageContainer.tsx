export function AdminPageContainer({ 
  children, 
  title, 
  description,
  action
}: { 
  children: React.ReactNode
  title?: string
  description?: string 
  action?: React.ReactNode
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        {(title || description) && (
          <div className="space-y-1">
            {title && <h2 className="text-2xl font-bold text-eve-text">{title}</h2>}
            {description && <p className="text-eve-text/60">{description}</p>}
          </div>
        )}
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  )
}
