import { Router } from 'express'
import supabase from '../config/supabase.js'

const router = Router()

// GET /api/rent-ledger?property_id=xxx&month=3&year=2025&tenant_id=xxx
router.get('/', async (req, res) => {
  const { property_id, billing_month, billing_year, tenant_id, status } = req.query
  let q = supabase
    .from('rent_ledger')
    .select('*, tenants(full_name, phone), rooms(room_number)')
    .order('due_date', { ascending: false })

  if (property_id)    q = q.eq('property_id', property_id)
  if (billing_month)  q = q.eq('billing_month', billing_month)
  if (billing_year)   q = q.eq('billing_year', billing_year)
  if (tenant_id)      q = q.eq('tenant_id', tenant_id)
  if (status)         q = q.eq('payment_status', status)

  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// GET /api/rent-ledger/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('rent_ledger')
    .select('*, tenants(full_name, phone, email), rooms(room_number)')
    .eq('id', req.params.id)
    .single()
  if (error) return res.status(404).json({ error: 'Not found' })
  res.json(data)
})

// POST /api/rent-ledger
router.post('/', async (req, res) => {
  const { data, error } = await supabase
    .from('rent_ledger')
    .insert(req.body)
    .select()
    .single()
  if (error) return res.status(400).json({ error: error.message })
  res.status(201).json(data)
})

// PATCH /api/rent-ledger/:id
router.patch('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('rent_ledger')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

export default router
