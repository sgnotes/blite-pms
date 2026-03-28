import { Router } from 'express'
import supabase from '../config/supabase.js'
const router = Router()

router.get('/', async (req, res) => {
  const { property_id, status } = req.query
  let q = supabase.from('maintenance_tickets').select('*, rooms(room_number)').order('created_at', { ascending: false })
  if (property_id) q = q.eq('property_id', property_id)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase.from('maintenance_tickets').select('*').eq('id', req.params.id).single()
  if (error) return res.status(404).json({ error: 'Not found' })
  res.json(data)
})
router.post('/', async (req, res) => {
  const { data, error } = await supabase.from('maintenance_tickets').insert(req.body).select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.status(201).json(data)
})
router.patch('/:id', async (req, res) => {
  const { data, error } = await supabase.from('maintenance_tickets').update(req.body).eq('id', req.params.id).select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})
export default router
