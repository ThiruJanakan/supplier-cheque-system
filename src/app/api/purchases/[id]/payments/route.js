import { getAuthUser } from '@/lib/auth'
import { listPurchasePayments, addPurchasePayment } from '@/lib/services/purchaseService'

export async function GET(request, { params }) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const payments = await listPurchasePayments(supabase, Number(id))
    return Response.json(payments)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const purchase = await addPurchasePayment(supabase, Number(id), body, user)
    return Response.json(purchase, { status: 201 })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
