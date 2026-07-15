import { getAuthUser } from '@/lib/auth'
import { exportExcel } from '@/lib/services/reportService'

export async function GET(request) {
  try {
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    if (!month) return Response.json({ error: 'Month query param is required.' }, { status: 400 })

    const buffer = await exportExcel(supabase, month)

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=monthly_report_${month}.xlsx`,
      },
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
