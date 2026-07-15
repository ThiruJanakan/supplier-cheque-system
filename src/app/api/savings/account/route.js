import { getAuthUser } from '@/lib/auth'
import { getAccountDetails } from '@/lib/services/financeService'

export async function GET(request) {
  try {
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const details = await getAccountDetails(supabase)
    return Response.json(details)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
