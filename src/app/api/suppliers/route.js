import { getAuthUser } from '@/lib/auth'
import { listSuppliers, createSupplier } from '@/lib/services/supplierService'

export async function GET(request) {
  try {
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const includeInactive = searchParams.get('include_inactive') === 'true' || searchParams.get('includeInactive') === 'true';

    const suppliers = await listSuppliers(supabase, { search, includeInactive })
    return Response.json(suppliers)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const supplier = await createSupplier(supabase, body, user)
    return Response.json(supplier, { status: 201 })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
