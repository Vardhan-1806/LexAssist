/**
 * LEXASSIST — Admin Seeder
 * Run once: node seedAdmin.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

if (!process.env.MONGO_URI) { console.error('❌ MONGO_URI missing in .env'); process.exit(1); }
if(process.env.NODE_ENV==='production'&&process.env.ALLOW_ADMIN_BOOTSTRAP!=='true'){
  console.error('❌ Set ALLOW_ADMIN_BOOTSTRAP=true for the one-time production admin bootstrap.');process.exit(1);
}
if(!process.env.ADMIN_EMAIL||!/^\S+@\S+\.\S+$/.test(process.env.ADMIN_EMAIL)){
  console.error('❌ Set a valid ADMIN_EMAIL before creating the first admin.');process.exit(1);
}
if(!process.env.ADMIN_PASSWORD||process.env.ADMIN_PASSWORD.length<16||/admin@123|replace_with|changeme/i.test(process.env.ADMIN_PASSWORD)){
  console.error('❌ Set a unique ADMIN_PASSWORD with at least 16 characters.');process.exit(1);
}

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const User = require('./Backend/models/User');

  const existing = await User.findOne({ role: 'admin' });
  if (existing) {
    console.log('ℹ️  An admin already exists; bootstrap skipped.');
    console.log('   Login at: /admin/login');
    await mongoose.disconnect();
    process.exit(0);
  }

  const email = process.env.ADMIN_EMAIL.toLowerCase().trim();
  const pass  = process.env.ADMIN_PASSWORD;
  const hash  = await bcrypt.hash(pass, 12);

  await User.insertMany([{
    name: 'Admin LEXASSIST', email, password: hash,
    role: 'admin', isVerified: true, isActive: true,
    userId: 'LEX-ADM-00001', phone: '9000000000',
  }]);

  console.log('\n✅ Admin created successfully!');
  console.log('First admin credentials were read from the environment; password not written to logs.');

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(err => { console.error('❌', err.message); process.exit(1); });
