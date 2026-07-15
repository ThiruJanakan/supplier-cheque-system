const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const PDFDocument = require('pdfkit');

// Load environment variables
const envPath = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const file = fs.readFileSync(envPath, 'utf8');
  file.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/(^['"]|['"]$)/g, '');
      if (key && !key.startsWith('#')) {
        process.env[key] = val;
      }
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, anonKey);

const month = '2026-07';

async function test() {
  console.log("Loading modules...");
  // Import the service
  const { exportPdf } = require('./src/lib/services/reportService');
  const { PassThrough } = require('stream');

  console.log("Triggering PDF generation...");
  const stream = new PassThrough();
  const chunks = [];
  stream.on('data', chunk => chunks.push(chunk));
  stream.on('end', () => {
    console.log("Stream ended. PDF size:", Buffer.concat(chunks).length);
  });

  try {
    await exportPdf(supabase, month, stream);
    console.log("Completed exportPdf execution!");
  } catch (err) {
    console.error("❌ ERROR THROWN:", err);
  }
}

test();
