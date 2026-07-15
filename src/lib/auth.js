import { createClient } from './supabase/server'

export async function getAuthUser(request) {
  const supabase = await createClient()
  const authHeader = request.headers.get('Authorization')
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]
    const { data: { user } } = await supabase.auth.setSession({
      access_token: token,
      refresh_token: '',
    })
    if (user) return { user, supabase }
  }
  
  const { data: { user } } = await supabase.auth.getUser()
  if (user) return { user, supabase }
  
  return { user: null, supabase }
}
