import { getAuthUser } from '@/lib/auth'

export async function POST(request) {
  try {
    const { user, supabase } = await getAuthUser(request)
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { current_password, new_password } = await request.json()
    if (!current_password || !new_password) {
      return Response.json({ error: 'Current password and new password are required.' }, { status: 400 })
    }

    // 1. Verify current password
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current_password,
    })

    if (verifyError) {
      return Response.json({ error: 'Incorrect current password.' }, { status: 400 })
    }

    // 2. Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: new_password,
    })

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 400 })
    }

    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
