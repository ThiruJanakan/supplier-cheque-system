import { getAuthUser } from '@/lib/auth'
import { runDueDateSweep } from '@/lib/services/alertService'

export async function POST(request) {
  try {
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    await runDueDateSweep(supabase)
    return Response.json({ ok: true, message: 'Alert sweep executed successfully.' })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
