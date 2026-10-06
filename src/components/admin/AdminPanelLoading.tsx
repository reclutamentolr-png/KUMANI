import { LoaderCircle } from 'lucide-react'

// Segnaposto mentre si scarica il codice di una sezione dell'Admin
export default function AdminPanelLoading() {
  return (
    <div className="flex justify-center py-12">
      <LoaderCircle className="h-6 w-6 animate-spin text-gray-400" />
    </div>
  )
}
