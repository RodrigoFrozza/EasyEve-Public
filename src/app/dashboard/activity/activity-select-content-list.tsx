import { SelectItem } from '@/components/ui/select'

export function ActivitySelectContentList({ items }: { items: string[] }) {
  return (
    <>
      {items.map((item) => (
        <SelectItem key={item} value={item}>
          {item}
        </SelectItem>
      ))}
    </>
  )
}
