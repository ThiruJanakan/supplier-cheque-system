import { getAuthUser } from '@/lib/auth'
import { exportPdf } from '@/lib/services/reportService'
import { PassThrough } from 'stream'

export async function GET(request) {
  try {
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    if (!month) return Response.json({ error: 'Month query param is required.' }, { status: 400 })

    const pdfStream = new PassThrough()
    // Run the PDF generation asynchronously writing to the stream
    exportPdf(supabase, month, pdfStream)

    // Convert PassThrough Node Stream to Web ReadableStream for standard fetch response
    const readable = new ReadableStream({
      start(controller) {
        pdfStream.on('data', chunk => controller.enqueue(chunk))
        pdfStream.on('end', () => controller.close())
        pdfStream.on('error', err => controller.error(err))
      },
      cancel() {
        pdfStream.destroy()
      }
    })

    return new Response(readable, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename=monthly_report_${month}.pdf`,
      },
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
