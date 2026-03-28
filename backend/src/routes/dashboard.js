import { Router } from 'express';
import supabase from '../config/supabase.js';

const router = Router();

// GET /api/dashboard/summary?property_id=xxx
router.get('/summary', async (req, res) => {
  const { property_id } = req.query;
  if (!property_id) return res.status(400).json({ error: 'property_id required' });

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [rooms, tenants, rentLedger, tickets] = await Promise.all([
    supabase.from('rooms').select('status').eq('property_id', property_id),
    supabase.from('tenants').select('id, status').eq('property_id', property_id),
    supabase.from('rent_ledger')
      .select('payment_status, total_due, amount_paid')
      .eq('property_id', property_id)
      .eq('billing_month', month)
      .eq('billing_year', year),
    supabase.from('maintenance_tickets')
      .select('status, priority')
      .eq('property_id', property_id)
      .in('status', ['open', 'in_progress'])
  ]);

  const roomStats = {
    total: rooms.data?.length || 0,
    occupied: rooms.data?.filter(r => r.status === 'occupied').length || 0,
    vacant: rooms.data?.filter(r => r.status === 'vacant').length || 0,
    maintenance: rooms.data?.filter(r => r.status === 'maintenance').length || 0,
  };

  const rentStats = {
    total_due: rentLedger.data?.reduce((s, r) => s + Number(r.total_due), 0) || 0,
    total_collected: rentLedger.data?.reduce((s, r) => s + Number(r.amount_paid), 0) || 0,
    paid_count: rentLedger.data?.filter(r => r.payment_status === 'paid').length || 0,
    pending_count: rentLedger.data?.filter(r => r.payment_status === 'pending').length || 0,
    overdue_count: rentLedger.data?.filter(r => r.payment_status === 'overdue').length || 0,
  };
  rentStats.collection_rate = rentStats.total_due > 0
    ? Math.round((rentStats.total_collected / rentStats.total_due) * 100)
    : 0;

  const ticketStats = {
    open: tickets.data?.filter(t => t.status === 'open').length || 0,
    in_progress: tickets.data?.filter(t => t.status === 'in_progress').length || 0,
    urgent: tickets.data?.filter(t => t.priority === 'urgent').length || 0,
  };

  res.json({
    rooms: roomStats,
    rent: { month, year, ...rentStats },
    tickets: ticketStats,
    active_tenants: tenants.data?.filter(t => t.status === 'active').length || 0,
  });
});

export default router;
