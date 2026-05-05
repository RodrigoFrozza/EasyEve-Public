export function AdminEmptyState({ 
  icon: Icon,
  title, 
  description 
}: { 
  icon?: React.ElementType
  title: string 
  description?: string 
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-eve-panel/60 flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-eve-text/30" />
        </div>
      )}
      <h3 className="text-lg font-medium text-eve-text/80 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-eve-text/40 max-w-sm">{description}</p>
      )}
    </div>
  )
}
