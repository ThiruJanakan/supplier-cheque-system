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
  console.error("\n❌ Error: Valid SUPABASE_SERVICE_ROLE_KEY must be set in .env.local to run this script.");
  console.error("Please retrieve the 'service_role' (secret) key from Supabase Dashboard -> Settings -> API and paste it in your .env.local file.");
  process.exit(1);
}

const newPassword = process.argv[2];
if (!newPassword || newPassword.length < 8) {
  console.error("\n❌ Error: Please specify a new password of at least 8 characters.");
  console.error("Usage: node reset-admin.js <YourNewPassword>");
  process.exit(1);
}

// Initialize Supabase with the admin service role client
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function run() {
  console.log("Locating user Thirujanakan@gmail.com...");
  try {
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    const user = users.find(u => u.email.toLowerCase() === 'thirujanakan@gmail.com');
    if (!user) {
      console.error("\n❌ Error: User Thirujanakan@gmail.com not found. Please log in once to bootstrap the user.");
      process.exit(1);
    }

    console.log(`User found! ID: ${user.id}`);
    console.log("Updating password...");

    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword
    });

    if (updateError) throw updateError;

    console.log("\n✅ Success! Password updated successfully.");
    console.log("You can now log in at http://localhost:3000/login using your new password!");
  } catch (e) {
    console.error("\n❌ Admin Reset Failed:", e.message);
  }
}

run();
