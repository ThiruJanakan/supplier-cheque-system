import { getAuthUser } from '@/lib/auth'
import { getCheque, updateCheque, removeCheque } from '@/lib/services/chequeService'

export async function GET(request, { params }) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const cheque = await getCheque(supabase, Number(id))
    return Response.json(cheque)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 404 })
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const cheque = await updateCheque(supabase, Number(id), body, user)
    return Response.json(cheque)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const result = await removeCheque(supabase, Number(id), user)
    return Response.json(result)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
