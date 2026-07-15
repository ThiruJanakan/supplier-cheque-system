import { getAuthUser } from '@/lib/auth'
import { listPurchases, createPurchase } from '@/lib/services/purchaseService'

export async function GET(request) {
  try {
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get('supplier_id') ? Number(searchParams.get('supplier_id')) : undefined
    const from = searchParams.get('from') || undefined
    const to = searchParams.get('to') || undefined
    const search = searchParams.get('search') || undefined

    const purchases = await listPurchases(supabase, { supplierId, from, to, search })
    return Response.json(purchases)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const purchase = await createPurchase(supabase, body, user)
    return Response.json(purchase, { status: 201 })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
