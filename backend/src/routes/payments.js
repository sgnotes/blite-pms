import { Router } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import supabase from '../config/supabase.js';

const router = Router();

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn('WARNING: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set — payment routes will fail');
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// POST /api/payments/create-order
// Creates a Razorpay order for a rent ledger entry
router.post('/create-order', async (req, res) => {
  const { ledger_id } = req.body;

  const { data: ledger, error } = await supabase
    .from('rent_ledger')
    .select('*, tenants(full_name, phone, email)')
    .eq('id', ledger_id)
    .single();

  if (error || !ledger) return res.status(404).json({ error: 'Ledger entry not found' });

  const amountDue = Number(ledger.total_due) - Number(ledger.amount_paid);
  if (amountDue <= 0) return res.status(400).json({ error: 'No amount due' });

  let order;
  try {
    order = await razorpay.orders.create({
      amount: Math.round(amountDue * 100), // paise
      currency: 'INR',
      receipt: ledger_id.slice(0, 40), // Razorpay receipt max 40 chars
      notes: {
        tenant_id: ledger.tenant_id,
        ledger_id,
        billing_month: ledger.billing_month,
        billing_year: ledger.billing_year,
      }
    });
  } catch (e) {
    console.error('Razorpay order creation failed:', e);
    return res.status(502).json({ error: `Razorpay error: ${e.error?.description || e.message}` });
  }

  // Save order ID to ledger
  await supabase.from('rent_ledger')
    .update({ razorpay_order_id: order.id })
    .eq('id', ledger_id);

  res.json({
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    tenant_name: ledger.tenants?.full_name,
    tenant_email: ledger.tenants?.email,
    tenant_phone: ledger.tenants?.phone,
    key_id: process.env.RAZORPAY_KEY_ID,
  });
});

// POST /api/payments/verify
// Called after Razorpay payment completes on frontend
router.post('/verify', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, ledger_id } = req.body;

  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (expectedSig !== razorpay_signature) {
    return res.status(400).json({ error: 'Invalid payment signature' });
  }

  // Fetch payment details from Razorpay
  let payment;
  try {
    payment = await razorpay.payments.fetch(razorpay_payment_id);
  } catch (e) {
    console.error('Razorpay payment fetch failed:', e);
    return res.status(502).json({ error: `Razorpay error: ${e.error?.description || e.message}` });
  }

  const amountPaid = payment.amount / 100;

  const { data, error } = await supabase
    .from('rent_ledger')
    .update({
      amount_paid: amountPaid,
      payment_status: 'paid',
      payment_method: 'razorpay',
      payment_date: new Date().toISOString().split('T')[0],
      transaction_id: razorpay_payment_id,
    })
    .eq('id', ledger_id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.json({ success: true, ledger: data });
});

// POST /api/payments/record-manual
// Record cash / UPI / cheque payment manually
router.post('/record-manual', async (req, res) => {
  const { ledger_id, amount_paid, payment_method, payment_date, transaction_id, notes } = req.body;

  const { data: ledger } = await supabase
    .from('rent_ledger').select('total_due').eq('id', ledger_id).single();

  const status = Number(amount_paid) >= Number(ledger?.total_due) ? 'paid' : 'partial';

  const { data, error } = await supabase
    .from('rent_ledger')
    .update({ amount_paid, payment_status: status, payment_method, payment_date, transaction_id, notes })
    .eq('id', ledger_id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/payments/webhook — Razorpay webhook (raw body)
router.post('/webhook', (req, res) => {
  const sig = req.headers['x-razorpay-signature'];
  const body = req.body.toString();
  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  if (sig !== expectedSig) return res.status(400).json({ error: 'Invalid webhook signature' });

  const event = JSON.parse(body);
  console.log('Razorpay webhook:', event.event);
  // Handle payment.captured, payment.failed etc here if needed
  res.json({ received: true });
});

// GET /api/payments/ledger?property_id=xxx&month=3&year=2025
router.get('/ledger', async (req, res) => {
  const { property_id, month, year, tenant_id } = req.query;

  let query = supabase
    .from('rent_ledger')
    .select(`
      *,
      tenants ( full_name, phone, room_id ),
      rooms ( room_number )
    `)
    .order('due_date', { ascending: false });

  if (property_id) query = query.eq('property_id', property_id);
  if (month)       query = query.eq('billing_month', month);
  if (year)        query = query.eq('billing_year', year);
  if (tenant_id)   query = query.eq('tenant_id', tenant_id);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/payments/generate-ledger
// Bulk create rent entries for a month for all active tenants
router.post('/generate-ledger', async (req, res) => {
  const { property_id, billing_month, billing_year } = req.body;

  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('id, room_id, rent_amount, rent_due_day')
    .eq('property_id', property_id)
    .eq('status', 'active');

  if (tenantsError) return res.status(500).json({ error: tenantsError.message });
  if (!tenants?.length) return res.json({ created: 0, entries: [] });

  const entries = tenants.map(t => ({
    tenant_id: t.id,
    property_id,
    room_id: t.room_id,
    billing_month,
    billing_year,
    due_date: `${billing_year}-${String(billing_month).padStart(2, '0')}-${String(t.rent_due_day).padStart(2, '0')}`,
    rent_amount: t.rent_amount,
    payment_status: 'pending',
  }));

  const { data, error } = await supabase
    .from('rent_ledger')
    .upsert(entries, { onConflict: 'tenant_id,billing_month,billing_year' })
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ created: data.length, entries: data });
});

export default router;
