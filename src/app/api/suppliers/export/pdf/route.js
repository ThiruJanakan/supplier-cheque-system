import { getAuthUser } from '@/lib/auth'
import { exportSuppliersPdf } from '@/lib/services/reportService'
import { PassThrough } from 'stream'

export async function GET(request) {
  try {
    const { user, supabase } = await getAuthUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const month = new URL(request.url).searchParams.get('month') || ''

    const pdfStream = new PassThrough()
    const chunks = []

    const pdfPromise = new Promise((resolve, reject) => {
      pdfStream.on('data', chunk => chunks.push(chunk))
      pdfStream.on('end', () => resolve(Buffer.concat(chunks)))
      pdfStream.on('error', err => reject(err))
    })

    exportSuppliersPdf(supabase, pdfStream, month).catch(err => pdfStream.emit('error', err))

    const pdfBuffer = await pdfPromise

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=suppliers_${new Date().toISOString().slice(0, 10)}.pdf`,
      },
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
