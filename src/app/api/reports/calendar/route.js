import { getAuthUser } from '@/lib/auth'
import { getCalendar } from '@/lib/services/reportService'

export async function GET(request) {
  try {
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    if (!month) return Response.json({ error: 'Month query param is required.' }, { status: 400 })

    const events = await getCalendar(supabase, month)
    return Response.json(events)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
