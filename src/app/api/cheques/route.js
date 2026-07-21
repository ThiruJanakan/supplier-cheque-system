import { getAuthUser } from '@/lib/auth'
import { listCheques, createCheque } from '@/lib/services/chequeService'

export async function GET(request) {
  try {
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const supplierId = searchParams.get('supplier_id') ? Number(searchParams.get('supplier_id')) : undefined
    const search = searchParams.get('search') || undefined
    const dueFrom = searchParams.get('due_from') || undefined
    const dueTo = searchParams.get('due_to') || undefined
    const issueFrom = searchParams.get('issue_from') || undefined
    const issueTo = searchParams.get('issue_to') || undefined

    const cheques = await listCheques(supabase, { status, supplierId, search, dueFrom, dueTo, issueFrom, issueTo })
    return Response.json(cheques)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const cheque = await createCheque(supabase, body, user)
    return Response.json(cheque, { status: 201 })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
