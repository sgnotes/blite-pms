import { Router } from 'express';
import supabase from '../config/supabase.js';

const router = Router();

// GET /api/tenants?property_id=xxx&status=active
router.get('/', async (req, res) => {
  const { property_id, status, room_id } = req.query;
  let query = supabase
    .from('tenants')
    .select(`
      *,
      rooms ( room_number, floor, room_type, base_rent ),
      kyc_documents ( doc_type, is_verified )
    `)
    .order('created_at', { ascending: false });

  if (property_id) query = query.eq('property_id', property_id);
  if (status)      query = query.eq('status', status);
  if (room_id)     query = query.eq('room_id', room_id);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/tenants/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('tenants')
    .select(`
      *,
      rooms ( * ),
      kyc_documents ( * ),
      rent_ledger ( * ),
      rent_deeds ( id, deed_number, status, agreement_start, agreement_end )
    `)
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Tenant not found' });
  res.json(data);
});

// POST /api/tenants
router.post('/', async (req, res) => {
  const { data, error } = await supabase
    .from('tenants')
    .insert(req.body)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /api/tenants/:id
router.patch('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('tenants')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// DELETE /api/tenants/:id (soft delete — set status to vacated)
router.delete('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('tenants')
    .update({ status: 'vacated', check_out_date: new Date().toISOString().split('T')[0] })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Tenant marked as vacated', tenant: data });
});

// POST /api/tenants/:id/kyc — upload KYC doc reference
router.post('/:id/kyc', async (req, res) => {
  const { doc_type, file_url, file_name } = req.body;
  const { data, error } = await supabase
    .from('kyc_documents')
    .insert({ tenant_id: req.params.id, doc_type, file_url, file_name })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  // Update tenant KYC status to submitted
  await supabase.from('tenants').update({ kyc_status: 'submitted' }).eq('id', req.params.id);

  res.status(201).json(data);
});

export default router;
