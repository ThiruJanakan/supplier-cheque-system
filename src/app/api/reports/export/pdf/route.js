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
    const chunks = []

    // Wait for the PDF kit document to finish compiling and write all data chunks
    const pdfPromise = new Promise((resolve, reject) => {
      pdfStream.on('data', chunk => chunks.push(chunk))
      pdfStream.on('end', () => resolve(Buffer.concat(chunks)))
      pdfStream.on('error', err => reject(err))
    })

    // Trigger PDF generation asynchronously and pipe errors to the stream
    exportPdf(supabase, month, pdfStream).catch(err => pdfStream.emit('error', err))

    // Await the full PDF buffer
    const pdfBuffer = await pdfPromise

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=monthly_report_${month}.pdf`,
      },
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
