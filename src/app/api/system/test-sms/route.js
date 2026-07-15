import { getAuthUser } from '@/lib/auth'
import { sendRaw } from '@/lib/services/smsService'
import { getSetting } from '@/lib/services/settingsService'

export async function POST(request) {
  try {
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const recipient = await getSetting(supabase, 'admin_phone')
    if (!recipient) {
      return Response.json({ error: 'No admin phone number configured in settings.' }, { status: 400 })
    }

    const message = 'Test SMS from Supplier Cheque Management System.'
    const result = await sendRaw(supabase, { recipient, message, category: 'test' })

    if (result.status === 'failed') {
      return Response.json({ error: result.error || 'Failed to send SMS' }, { status: 500 })
    }

    return Response.json({ ok: true, message: 'Test SMS sent successfully.' })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
