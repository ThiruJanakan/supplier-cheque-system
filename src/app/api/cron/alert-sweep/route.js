import { runDueDateSweep } from '@/lib/services/alertService'
import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET

  // Verify secret authorization header when deployed on Vercel
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Use the admin service role client for background crons to bypass RLS policies
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    await runDueDateSweep(supabase)
    return Response.json({ ok: true, message: 'Alert sweep executed successfully via Vercel Cron.' })
  } catch (e) {
    console.error('Cron alert sweep failed:', e);
    return Response.json({ error: e.message }, { status: 500 })
  }
}
