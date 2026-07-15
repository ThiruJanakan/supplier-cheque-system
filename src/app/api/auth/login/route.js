import { createClient } from '@/lib/supabase/server'

export async function POST(request) {
  try {
    const { username, password } = await request.json()
    if (!username || !password) {
      return Response.json({ error: 'Username and password are required.' }, { status: 400 })
    }

    const email = username.includes('@') ? username : `${username}@cheque-manager.local`
    const supabase = await createClient()

    // 1. Attempt login
    let { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    // 2. Auto-bootstrap default admin on first-time setup
    if (error && username === 'admin' && password === 'admin123') {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (!signUpError) {
        // Retry sign in after successful sign up
        const retry = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        data = retry.data
        error = retry.error
      }
    }

    if (error) {
      return Response.json({ error: error.message }, { status: 401 })
    }

    return Response.json({
      token: data.session.access_token,
      user: {
        id: data.user.id,
        username,
        email: data.user.email,
        phone: data.user.phone || '',
      }
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
