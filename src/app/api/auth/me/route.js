import { getAuthUser } from '@/lib/auth'

export async function GET(request) {
  const { user } = await getAuthUser(request)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return Response.json({
    id: user.id,
    username: user.email ? user.email.split('@')[0] : 'admin',
    email: user.email,
    phone: user.phone || '',
  })
}
