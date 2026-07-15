import { getAuthUser } from '@/lib/auth'
import { listRevenue, recordRevenue } from '@/lib/services/financeService'

export async function GET(request) {
  try {
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from') || undefined
    const to = searchParams.get('to') || undefined

    const revenues = await listRevenue(supabase, { from, to })
    return Response.json(revenues)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const result = await recordRevenue(supabase, body, user)
    return Response.json(result, { status: 201 })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
