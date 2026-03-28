import { Router } from 'express'
import supabase from '../config/supabase.js'
const router = Router()

router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('properties').select('*').order('created_at')
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase.from('properties').select('*').eq('id', req.params.id).single()
  if (error) return res.status(404).json({ error: 'Not found' })
  res.json(data)
})
router.post('/', async (req, res) => {
  const { data, error } = await supabase.from('properties').insert(req.body).select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.status(201).json(data)
})
router.patch('/:id', async (req, res) => {
  const { data, error } = await supabase.from('properties').update(req.body).eq('id', req.params.id).select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})
export default router
