// Optional demo data for local development.
const { db } = require('../config/database');

const suppliers = [
  ['Lanka Timber Traders', 'Ruwan Perera', '+94711111111', 'ruwan@lankatimber.lk', 'Colombo 14', 'Commercial Bank'],
  ['Ceylon Hardware Supplies', 'Nadeesha Silva', '+94722222222', 'sales@ceylonhw.lk', 'Kandy Rd, Kadawatha', 'Sampath Bank'],
  ['Metro Packaging (Pvt) Ltd', 'A. Fernando', '+94733333333', 'accounts@metropack.lk', 'Biyagama EPZ', 'HNB'],
];
const insSup = db.prepare('INSERT INTO suppliers (name, contact_person, phone, email, address, bank_name) VALUES (?,?,?,?,?,?)');
suppliers.forEach(s => insSup.run(...s));
console.log('Seeded demo suppliers.');
