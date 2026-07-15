import { getAuthUser } from '@/lib/auth'
import { deleteRevenue } from '@/lib/services/financeService'

export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const result = await deleteRevenue(supabase, Number(id), user)
    return Response.json(result)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
