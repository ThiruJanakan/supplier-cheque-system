import { getAuthUser } from '@/lib/auth'
import { updatePurchasePayment, removePurchasePayment } from '@/lib/services/purchaseService'

export async function PUT(request, { params }) {
  try {
    const { id, paymentId } = await params
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const purchase = await updatePurchasePayment(supabase, Number(id), Number(paymentId), body, user)
    return Response.json(purchase)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id, paymentId } = await params
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const purchase = await removePurchasePayment(supabase, Number(id), Number(paymentId), user)
    return Response.json(purchase)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
