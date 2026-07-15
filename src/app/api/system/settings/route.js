import { getAuthUser } from '@/lib/auth'
import { getAllSettings, setSetting } from '@/lib/services/settingsService'
import { logActivity } from '@/lib/services/activityLogService'

export async function GET(request) {
  try {
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const settings = await getAllSettings(supabase)
    return Response.json(settings)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    for (const [key, value] of Object.entries(body)) {
      await setSetting(supabase, key, value)
    }

    const username = user.email ? user.email.split('@')[0] : 'admin'
    await logActivity(supabase, {
      userId: user.id,
      username,
      action: 'update',
      entityType: 'settings',
      details: { keys: Object.keys(body) }
    })

    const updated = await getAllSettings(supabase)
    return Response.json(updated)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
