import { getAuthUser } from '@/lib/auth'
import { monthlySummary } from '@/lib/services/reportService'

export async function GET(request) {
  try {
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    if (!month) return Response.json({ error: 'Month query param is required.' }, { status: 400 })

    const summary = await monthlySummary(supabase, month)
    return Response.json(summary)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
