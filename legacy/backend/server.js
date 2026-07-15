// Application entry point.
// Layered architecture:
//   routes  -> HTTP endpoints (no logic)
//   controllers -> request/response handling
//   services -> business rules, validation, side effects (SMS, ledger)
//   repositories -> SQL data access
//   config / utils / middleware -> cross-cutting concerns
const express = require('express');
const cors = require('cors');
const env = require('./src/config/env');

require('./src/database/migrate');            // ensure schema + admin user exist

const routes = require('./src/routes');
const errorHandler = require('./src/middleware/errorHandler');
const alertScheduler = require('./src/services/alertScheduler');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api', routes);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`Cheque Manager API running on http://localhost:${env.port}`);
  alertScheduler.start();
});
