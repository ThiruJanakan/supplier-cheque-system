const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local configuration
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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey || serviceKey.startsWith('sb_publishable')) {
  console.error("\n❌ Error: Valid SUPABASE_SERVICE_ROLE_KEY must be set in .env.local to run the seeder.");
  console.error("Please ensure the 'service_role' (secret) key is copied into your .env.local file.");
  process.exit(1);
}

// Initialize Supabase admin client
const supabase = createClient(supabaseUrl, serviceKey);

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const daysHence = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

async function seed() {
  console.log("Starting database seeding...");
  
  try {
    // 1. Clear existing transactional data (optional but ensures clean starting point)
    console.log("Cleaning up existing seed records...");
    await supabase.from('cheque_allocations').delete().neq('id', 0);
    await supabase.from('cheques').delete().neq('id', 0);
    await supabase.from('purchases').delete().neq('id', 0);
    await supabase.from('suppliers').delete().neq('id', 0);
    await supabase.from('savings_ledger').delete().neq('id', 0);
    await supabase.from('revenue').delete().neq('id', 0);
    await supabase.from('sms_logs').delete().neq('id', 0);
    await supabase.from('activity_logs').delete().neq('id', 0);

    // 2. Insert Suppliers with granular Bank fields
    console.log("Inserting suppliers...");
    const { data: sups, error: errSups } = await supabase.from('suppliers').insert([
      {
        name: "MediCare Pharma Ceylon",
        contact_person: "Mr. Amal Perera",
        phone: "+94771234567",
        email: "contact@medicare.lk",
        address: "123 Galle Road, Colombo 03",
        bank_name: "Commercial Bank of Ceylon",
        bank_account_no: "1002003004",
        branch_name: "Kollupitiya",
        branch_code: "084",
        notes: "Primary supplier for standard antibiotics and OTC products."
      },
      {
        name: "Apex Medical Distributors",
        contact_person: "Dr. Sanduni Silva",
        phone: "+94719876543",
        email: "sales@apexmeds.com",
        address: "45 Peradeniya Road, Kandy",
        bank_name: "Hatton National Bank (HNB)",
        bank_account_no: "003004005006",
        branch_name: "Kandy Main",
        branch_code: "032",
        notes: "Supplier for specialty diabetic medication and insulin."
      },
      {
        name: "BioLabs Healthcare",
        contact_person: "Mr. Tharindu Jayasuriya",
        phone: "+94765544332",
        email: "orders@biolabs.lk",
        address: "78 Wackwella Road, Galle",
        bank_name: "People's Bank",
        bank_account_no: "400500600",
        branch_name: "Galle Fort",
        branch_code: "012",
        notes: "Imported laboratory diagnostics and rapid test kits."
      }
    ]).select();

    if (errSups) throw errSups;
    console.log(`✅ Seeded ${sups.length} suppliers.`);

    const supMedicare = sups[0];
    const supApex = sups[1];
    const supBiolabs = sups[2];

    // 3. Insert Purchases
    console.log("Inserting purchases...");
    const { data: purcs, error: errPurc } = await supabase.from('purchases').insert([
      {
        supplier_id: supMedicare.id,
        invoice_no: "INV-MED-5011",
        description: "Bulk purchase of Amoxicillin capsules and Paracetamol syrup",
        total_amount: 150000.00,
        purchase_date: daysAgo(10)
      },
      {
        supplier_id: supMedicare.id,
        invoice_no: "INV-MED-5024",
        description: "Delivery of surgical masks, gloves, and sanitizers",
        total_amount: 220000.00,
        purchase_date: daysAgo(5)
      },
      {
        supplier_id: supApex.id,
        invoice_no: "INV-APX-9821",
        description: "Imported insulin vials and blood glucose testing strips",
        total_amount: 350000.00,
        purchase_date: daysAgo(12)
      },
      {
        supplier_id: supBiolabs.id,
        invoice_no: "INV-BIO-0491",
        description: "Dengue antigen rapid test cassettes (Pack of 500)",
        total_amount: 80000.00,
        purchase_date: daysAgo(2)
      }
    ]).select();

    if (errPurc) throw errPurc;
    console.log(`✅ Seeded ${purcs.length} purchases.`);

    // 4. Insert Cheques
    console.log("Inserting cheques...");
    const { data: chqs, error: errChq } = await supabase.from('cheques').insert([
      {
        cheque_number: "CHQ-001001",
        supplier_id: supMedicare.id,
        amount: 150000.00,
        issue_date: daysAgo(10),
        due_date: daysAgo(1), // Cleared yesterday
        status: "cleared",
        bank_name: "Commercial Bank of Ceylon",
        bank_account_no: "8800991122",
        branch_name: "Kollupitiya",
        branch_code: "084",
        notes: "Settled invoice INV-MED-5011."
      },
      {
        cheque_number: "CHQ-001002",
        supplier_id: supMedicare.id,
        amount: 220000.00,
        issue_date: daysAgo(5),
        due_date: daysHence(5), // Upcoming payment
        status: "issued",
        bank_name: "Commercial Bank of Ceylon",
        bank_account_no: "8800991122",
        branch_name: "Kollupitiya",
        branch_code: "084",
        notes: "Post-dated cheque for surgical supply inventory."
      },
      {
        cheque_number: "CHQ-001003",
        supplier_id: supApex.id,
        amount: 150000.00,
        issue_date: daysAgo(12),
        due_date: daysAgo(2), // Bounced 2 days ago
        status: "bounced",
        bank_name: "Commercial Bank of Ceylon",
        bank_account_no: "8800991122",
        branch_name: "Kollupitiya",
        branch_code: "084",
        notes: "Insufficient balance on presentation date. Needs to re-present."
      },
      {
        cheque_number: "CHQ-001004",
        supplier_id: supBiolabs.id,
        amount: 80000.00,
        issue_date: daysAgo(2),
        due_date: daysHence(10), // Pending check
        status: "pending",
        bank_name: "Commercial Bank of Ceylon",
        bank_account_no: "8800991122",
        branch_name: "Kollupitiya",
        branch_code: "084",
        notes: "Awaiting signature release."
      }
    ]).select();

    if (errChq) throw errChq;
    console.log(`✅ Seeded ${chqs.length} cheques.`);

    // 5. Insert Cheque Allocations
    console.log("Allocating cheques to invoices...");
    await supabase.from('cheque_allocations').insert([
      {
        cheque_id: chqs[0].id,
        purchase_id: purcs[0].id,
        allocated_amount: 150000.00
      },
      {
        cheque_id: chqs[1].id,
        purchase_id: purcs[1].id,
        allocated_amount: 220000.00
      },
      {
        cheque_id: chqs[2].id,
        purchase_id: purcs[2].id,
        allocated_amount: 150000.00
      }
    ]);
    console.log(`✅ Seeded cheque allocations.`);

    // 6. Seed Savings Account Ledger
    console.log("Seeding savings ledger...");
    await supabase.from('savings_ledger').insert([
      {
        entry_date: daysAgo(15),
        type: "deposit",
        amount: 500000.00,
        reference: "Initial opening balance deposit",
        created_at: new Date(Date.now() - 15 * 86400000).toISOString()
      },
      {
        entry_date: daysAgo(5),
        type: "deposit",
        amount: 120000.00,
        reference: "Counter pharmacy sales transfer",
        created_at: new Date(Date.now() - 5 * 86400000).toISOString()
      },
      {
        entry_date: daysAgo(1),
        type: "cheque_clearance",
        amount: -150000.00,
        reference: "Cheque CHQ-001001 clearance",
        created_at: new Date(Date.now() - 1 * 86400000).toISOString()
      }
    ]);
    console.log("✅ Seeded savings ledger transactions.");

    // 7. Seed Daily Revenue Entries
    console.log("Seeding daily revenue sales records...");
    await supabase.from('revenue').insert([
      {
        entry_date: daysAgo(3),
        amount: 120000.00,
        notes: "Counter prescriptions and OTC retail receipts",
        created_at: new Date(Date.now() - 3 * 86400000).toISOString()
      },
      {
        entry_date: daysAgo(2),
        amount: 95000.00,
        notes: "Baby care products, cosmetics and retail receipts",
        created_at: new Date(Date.now() - 2 * 86400000).toISOString()
      },
      {
        entry_date: daysAgo(1),
        amount: 110000.00,
        notes: "Standard pharmaceutical sales and surgical items",
        created_at: new Date(Date.now() - 1 * 86400000).toISOString()
      }
    ]);
    console.log("✅ Seeded daily revenue receipts.");

    // 8. Seeding Settings Defaults
    console.log("Seeding project settings...");
    await supabase.from('settings').upsert([
      { key: 'alert_intervals', value: '7,3,1' },
      { key: 'admin_phone', value: '+94770000000' },
      { key: 'currency', value: 'LKR' },
      { key: 'overdue_alerts', value: 'true' }
    ]);
    console.log("✅ Seeded configuration settings.");

    // 9. Seeding SMS logs and activity logs
    console.log("Seeding diagnostic logs...");
    await supabase.from('sms_logs').insert([
      {
        recipient: "+94771234567",
        message: "Medicare Pharmacy: Cheque CHQ-001001 for LKR 150,000.00 has been cleared today.",
        status: "sent"
      },
      {
        recipient: "+94770000000",
        message: "ADMIN NOTICE: Cheque CHQ-001003 for Apex Medical has bounced. Pls check balance.",
        status: "sent"
      }
    ]);

    await supabase.from('activity_logs').insert([
      {
        username: "system",
        action: "daily_alert_check",
        entity_type: "cron",
        details: { result: "checked cheques. 1 warning dispatched." }
      },
      {
        username: "admin",
        action: "create",
        entity_type: "supplier",
        entity_id: 1,
        details: { name: "MediCare Pharma Ceylon" }
      }
    ]);
    console.log("✅ Seeded activity and notification logs.");

    console.log("\n🎉 Database Seeding Completed Successfully!");
    console.log("Launch your server and visit the dashboard to see your loaded statistics!");
  } catch (err) {
    console.error("\n❌ Seeding Failed:", err.message);
  }
}

seed();
