import { Router } from 'express'
import supabase from '../config/supabase.js'
import axios from 'axios'

const router = Router()

router.get('/', async (req, res) => {
  const { property_id, tenant_id } = req.query
  let q = supabase.from('rent_deeds').select('*, tenants(full_name, phone, email), rooms(room_number)').order('created_at', { ascending: false })
  if (property_id) q = q.eq('property_id', property_id)
  if (tenant_id) q = q.eq('tenant_id', tenant_id)
  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase.from('rent_deeds').select('*, tenants(*), rooms(*), properties(*)').eq('id', req.params.id).single()
  if (error) return res.status(404).json({ error: 'Deed not found' })
  res.json(data)
})

router.post('/', async (req, res) => {
  const { data, error } = await supabase.from('rent_deeds').insert(req.body).select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.status(201).json(data)
})

router.post('/:id/generate-pdf', async (req, res) => {
  const { data: deed, error } = await supabase.from('rent_deeds').select('*, tenants(*), rooms(*), properties(*)').eq('id', req.params.id).single()
  if (error || !deed) return res.status(404).json({ error: 'Deed not found' })
  await supabase.from('rent_deeds').update({ status: 'draft' }).eq('id', req.params.id)
  res.json({ success: true, message: 'Deed ready' })
})

router.post('/:id/send-for-sign', async (req, res) => {
  const { data: deed, error } = await supabase.from('rent_deeds').select('*, tenants(full_name,email,phone)').eq('id', req.params.id).single()
  if (error || !deed) return res.status(404).json({ error: 'Deed not found' })
  if (!process.env.LEEGALITY_API_TOKEN) return res.status(500).json({ error: 'LEEGALITY_API_TOKEN not set' })
  try {
    const baseUrl = process.env.LEEGALITY_BASE_URL || 'https://sandbox.leegality.com/api/v3.0'
    const uploadRes = await axios.post(`${baseUrl}/document`, {
      name: `Rent Agreement — ${deed.deed_number || deed.id}`,
      signatories: [{ name: deed.tenants?.full_name, email: deed.tenants?.email || '', phone: deed.tenants?.phone || '', signType: 'AADHAAR' }],
      settings: { expiry: 30, sendEmail: true }
    }, { headers: { 'X-Auth-Token': process.env.LEEGALITY_API_TOKEN } })
    await supabase.from('rent_deeds').update({ leegality_document_id: uploadRes.data.documentId, leegality_invite_url: uploadRes.data.inviteUrl, status: 'sent' }).eq('id', req.params.id)
    res.json({ success: true, invite_url: uploadRes.data.inviteUrl })
  } catch (err) {
    res.status(500).json({ error: 'Leegality error', details: err.response?.data || err.message })
  }
})

router.post('/webhook/leegality', async (req, res) => {
  const { documentId, status, signedDocumentUrl } = req.body
  if (status === 'SIGNED' && documentId) {
    await supabase.from('rent_deeds').update({ status: 'signed', tenant_signed_at: new Date().toISOString(), signed_pdf_url: signedDocumentUrl || null }).eq('leegality_document_id', documentId)
  }
  res.json({ received: true })
})

export default router
