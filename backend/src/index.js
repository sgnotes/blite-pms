import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

dotenv.config();

// Route imports
import propertiesRouter from './routes/properties.js';
import roomsRouter from './routes/rooms.js';
import tenantsRouter from './routes/tenants.js';
import rentLedgerRouter from './routes/rentLedger.js';
import rentDeedsRouter from './routes/rentDeeds.js';
import maintenanceRouter from './routes/maintenance.js';
import paymentsRouter from './routes/payments.js';
import dashboardRouter from './routes/dashboard.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ───────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(morgan('dev'));

// Raw body for Razorpay webhook signature verification
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// JSON body for everything else
app.use(express.json());

// ── Health check ─────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'blite-pms-api' }));

// ── Routes ───────────────────────────────────────────────────
app.use('/api/dashboard',    dashboardRouter);
app.use('/api/properties',   propertiesRouter);
app.use('/api/rooms',        roomsRouter);
app.use('/api/tenants',      tenantsRouter);
app.use('/api/rent-ledger',  rentLedgerRouter);
app.use('/api/rent-deeds',   rentDeedsRouter);
app.use('/api/maintenance',  maintenanceRouter);
app.use('/api/payments',     paymentsRouter);

// ── Global error handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.listen(PORT, () => {
  console.log(`🏠 Blite PMS API running on http://localhost:${PORT}`);
});

export default app;
