import { AdminPageHeader } from './AdminPageHeader'

export function AdminPageContainer({
  children,
  title,
  description,
  action,
}: {
  children: React.ReactNode
  title?: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="space-y-6">
      <AdminPageHeader title={title} description={description} action={action} />
      {children}
    </div>
  )
}
