import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-black text-white p-8 flex flex-col items-center justify-center space-y-8">
      <Skeleton className="w-[300px] h-[300px] rounded-full opacity-20" />
      <Skeleton className="w-[400px] h-4 opacity-20" />
      <Skeleton className="w-[400px] h-4 opacity-20" />
    </div>
  )
}
