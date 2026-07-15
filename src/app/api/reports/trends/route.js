import { getAuthUser } from '@/lib/auth'
import { getTrends } from '@/lib/services/reportService'

export async function GET(request) {
  try {
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const months = searchParams.get('months') ? Number(searchParams.get('months')) : 6

    const trends = await getTrends(supabase, months)
    return Response.json(trends)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
