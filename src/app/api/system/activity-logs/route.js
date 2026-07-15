import { getAuthUser } from '@/lib/auth'
import { listActivity } from '@/lib/services/activityLogService'

export async function GET(request) {
  try {
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entity_type') || undefined
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 300

    const logs = await listActivity(supabase, { entityType, limit })
    return Response.json(logs)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
