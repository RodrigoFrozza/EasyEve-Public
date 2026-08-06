import { Sparkles } from 'lucide-react'

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
    <div className="flex flex-col items-center justify-center p-16 text-center border border-dashed border-border/60 rounded-[2.5rem] bg-card/10 backdrop-blur-sm font-sans animate-in fade-in zoom-in duration-700">
      <div className="relative mb-8">
        {Icon && (
          <div className="w-24 h-24 rounded-[2rem] bg-background flex items-center justify-center border border-border shadow-2xl relative z-10 group-hover:scale-110 transition-transform duration-500">
            <Icon className="w-10 h-10 text-muted-foreground/30 group-hover:text-primary transition-colors" />
          </div>
        )}
        <div className="absolute -inset-4 bg-primary/5 blur-2xl rounded-full" />
        <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-primary/40 animate-pulse" />
      </div>

      <div className="space-y-3">
        <h3 className="text-2xl font-black text-foreground tracking-tight uppercase tracking-[0.1em]">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-muted-foreground/70 max-w-sm font-medium leading-relaxed italic">
            {description}
          </p>
        )}
      </div>
      
      {/* Decorative pulse element */}
      <div className="mt-10 flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-border/40 bg-muted/20">
        <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-ping" />
        <span className="text-[10px] text-muted-foreground/50 font-black uppercase tracking-[0.2em]">Awaiting_Input</span>
      </div>
    </div>
  )
}

