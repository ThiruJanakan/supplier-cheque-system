import { getAuthUser } from '@/lib/auth'

export async function GET(request) {
  try {
    const { user } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    return Response.json([]) // Return empty list since Supabase automatically handles system backups
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { user } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    return Response.json({ ok: true, message: 'Backups are managed automatically by Supabase.' })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
