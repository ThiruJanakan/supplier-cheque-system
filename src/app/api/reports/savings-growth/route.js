import { getAuthUser } from '@/lib/auth'
import { getSavingsGrowth } from '@/lib/services/reportService'

export async function GET(request) {
  try {
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 365

    const growth = await getSavingsGrowth(supabase, limit)
    return Response.json(growth)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
