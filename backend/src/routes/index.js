// HTTP layer: route definitions only. Everything except login sits behind auth.
const { Router } = require('express');
const auth = require('../middleware/auth');
const authCtrl = require('../controllers/authController');
const supplierCtrl = require('../controllers/supplierController');
const purchaseCtrl = require('../controllers/purchaseController');
const chequeCtrl = require('../controllers/chequeController');
const financeCtrl = require('../controllers/financeController');
const reportCtrl = require('../controllers/reportController');
const systemCtrl = require('../controllers/systemController');

const router = Router();

// Auth
router.post('/auth/login', authCtrl.login);
router.get('/auth/me', auth, authCtrl.me);
router.post('/auth/change-password', auth, authCtrl.changePassword);

// Suppliers
router.get('/suppliers', auth, supplierCtrl.list);
router.get('/suppliers/:id', auth, supplierCtrl.get);
router.post('/suppliers', auth, supplierCtrl.create);
router.put('/suppliers/:id', auth, supplierCtrl.update);
router.delete('/suppliers/:id', auth, supplierCtrl.remove);

// Purchases
router.get('/purchases', auth, purchaseCtrl.list);
router.get('/purchases/:id', auth, purchaseCtrl.get);
router.post('/purchases', auth, purchaseCtrl.create);
router.put('/purchases/:id', auth, purchaseCtrl.update);
router.delete('/purchases/:id', auth, purchaseCtrl.remove);

// Cheques
router.get('/cheques', auth, chequeCtrl.list);
router.get('/cheques/:id', auth, chequeCtrl.get);
router.post('/cheques', auth, chequeCtrl.create);
router.put('/cheques/:id', auth, chequeCtrl.update);
router.post('/cheques/:id/status', auth, chequeCtrl.setStatus);
router.delete('/cheques/:id', auth, chequeCtrl.remove);

// Revenue + savings account
router.get('/revenue', auth, financeCtrl.listRevenue);
router.post('/revenue', auth, financeCtrl.recordRevenue);
router.delete('/revenue/:id', auth, financeCtrl.deleteRevenue);
router.get('/savings/account', auth, financeCtrl.account);

// Reports
router.get('/reports/monthly', auth, reportCtrl.monthly);
router.get('/reports/trends', auth, reportCtrl.trends);
router.get('/reports/savings-growth', auth, reportCtrl.savingsGrowth);
router.get('/reports/calendar', auth, reportCtrl.calendar);
router.get('/reports/export/excel', auth, reportCtrl.exportExcel);
router.get('/reports/export/pdf', auth, reportCtrl.exportPdf);

// System
router.get('/system/sms-logs', auth, systemCtrl.smsLogs);
router.get('/system/activity-logs', auth, systemCtrl.activityLogs);
router.get('/system/settings', auth, systemCtrl.getSettings);
router.put('/system/settings', auth, systemCtrl.updateSettings);
router.get('/system/backups', auth, systemCtrl.backups);
router.post('/system/backups', auth, systemCtrl.backupNow);
router.post('/system/run-alert-sweep', auth, systemCtrl.runAlertSweep);
router.post('/system/test-sms', auth, systemCtrl.testSms);

module.exports = router;
