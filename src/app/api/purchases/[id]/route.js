import { getAuthUser } from '@/lib/auth'
import { getPurchase, updatePurchase, removePurchase } from '@/lib/services/purchaseService'

export async function GET(request, { params }) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const purchase = await getPurchase(supabase, Number(id))
    return Response.json(purchase)
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
    const purchase = await updatePurchase(supabase, Number(id), body, user)
    return Response.json(purchase)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const result = await removePurchase(supabase, Number(id), user)
    return Response.json(result)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
