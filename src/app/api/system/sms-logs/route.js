import { getAuthUser } from '@/lib/auth'

export async function GET(request) {
  try {
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const status = searchParams.get('status')
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 200

    let query = supabase
      .from('sms_logs')
      .select('*, cheques(cheque_number)')
      .order('id', { ascending: false })
      .limit(limit)

    if (category) query = query.eq('category', category)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    const logs = data.map(l => {
      const cheque_number = l.cheques ? l.cheques.cheque_number : null
      const lCopy = { ...l }
      delete lCopy.cheques
      return {
        ...lCopy,
        cheque_number,
        sent_at: l.sent_at,
      }
    })

    return Response.json(logs)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
