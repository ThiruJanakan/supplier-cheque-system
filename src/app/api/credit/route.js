import { getAuthUser } from '@/lib/auth'
import { listCreditDues } from '@/lib/services/purchaseService'

export async function GET(request) {
  try {
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get('supplier_id') ? Number(searchParams.get('supplier_id')) : undefined

    const dues = await listCreditDues(supabase, { supplierId })
    return Response.json(dues)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
