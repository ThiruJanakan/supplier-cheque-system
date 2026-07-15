import { getAuthUser } from '@/lib/auth'
import { setChequeStatus } from '@/lib/services/chequeService'

export async function POST(request, { params }) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { status } = await request.json()
    const updatedCheque = await setChequeStatus(supabase, Number(id), status, user)
    return Response.json(updatedCheque)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
