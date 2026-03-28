import { Router } from 'express'
import supabase from '../config/supabase.js'
import axios from 'axios'
import puppeteer from 'puppeteer'

const router = Router()

// ── GET /api/rent-deeds?property_id=xxx ─────────────────────
router.get('/', async (req, res) => {
  const { property_id, tenant_id } = req.query
  let q = supabase
    .from('rent_deeds')
    .select('*, tenants(full_name, phone, email), rooms(room_number)')
    .order('created_at', { ascending: false })
  if (property_id) q = q.eq('property_id', property_id)
  if (tenant_id)   q = q.eq('tenant_id', tenant_id)
  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// ── GET /api/rent-deeds/:id ──────────────────────────────────
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('rent_deeds')
    .select('*, tenants(*), rooms(*), properties(*)')
    .eq('id', req.params.id)
    .single()
  if (error) return res.status(404).json({ error: 'Deed not found' })
  res.json(data)
})

// ── POST /api/rent-deeds ─────────────────────────────────────
router.post('/', async (req, res) => {
  const { data, error } = await supabase
    .from('rent_deeds')
    .insert(req.body)
    .select()
    .single()
  if (error) return res.status(400).json({ error: error.message })
  res.status(201).json(data)
})

// ── POST /api/rent-deeds/:id/generate-pdf ───────────────────
router.post('/:id/generate-pdf', async (req, res) => {
  const { data: deed, error } = await supabase
    .from('rent_deeds')
    .select('*, tenants(*), rooms(*), properties(*)')
    .eq('id', req.params.id)
    .single()

  if (error || !deed) return res.status(404).json({ error: 'Deed not found' })

  const html = buildDeedHtml(deed)

  // Generate PDF with Puppeteer
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  const pdfBuffer = await page.pdf({
    format: 'A4',
    margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
    printBackground: true
  })
  await browser.close()

  // Upload to Supabase Storage
  const fileName = `${deed.deed_number?.replace(/\//g, '-') || deed.id}.pdf`
  const { error: uploadError } = await supabase.storage
    .from(process.env.PDF_STORAGE_BUCKET || 'rent-deeds')
    .upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: true })

  if (uploadError) return res.status(500).json({ error: 'PDF upload failed: ' + uploadError.message })

  const { data: { publicUrl } } = supabase.storage
    .from(process.env.PDF_STORAGE_BUCKET || 'rent-deeds')
    .getPublicUrl(fileName)

  // Save PDF URL + deed HTML snapshot
  await supabase.from('rent_deeds').update({ pdf_url: publicUrl, deed_html: html }).eq('id', req.params.id)

  res.json({ success: true, pdf_url: publicUrl })
})

// ── POST /api/rent-deeds/:id/send-for-sign ──────────────────
router.post('/:id/send-for-sign', async (req, res) => {
  const { data: deed, error } = await supabase
    .from('rent_deeds')
    .select('*, tenants(full_name, email, phone), properties(name)')
    .eq('id', req.params.id)
    .single()

  if (error || !deed) return res.status(404).json({ error: 'Deed not found' })
  if (!deed.pdf_url)  return res.status(400).json({ error: 'Generate PDF first before sending for signature' })

  if (!process.env.LEEGALITY_API_TOKEN) {
    return res.status(500).json({ error: 'LEEGALITY_API_TOKEN not set in .env' })
  }

  const baseUrl = process.env.LEEGALITY_BASE_URL || 'https://sandbox.leegality.com/api/v3.0'

  try {
    // Step 1: Upload document to Leegality
    const uploadRes = await axios.post(`${baseUrl}/document`, {
      name: `Rent Agreement — ${deed.deed_number || deed.id}`,
      description: `PG Accommodation Agreement for ${deed.tenants?.full_name}`,
      file: {
        url: deed.pdf_url,
        name: `${deed.deed_number?.replace(/\//g, '-') || 'deed'}.pdf`
      },
      signatories: [
        {
          name: deed.tenants?.full_name,
          email: deed.tenants?.email || '',
          phone: deed.tenants?.phone || '',
          signType: 'AADHAAR',   // Aadhaar OTP e-sign — legally valid under IT Act
          sequenceNumber: 1
        }
      ],
      settings: {
        expiry: 30,              // days
        sendEmail: true,
        sendSms: !!deed.tenants?.phone
      }
    }, {
      headers: {
        'X-Auth-Token': process.env.LEEGALITY_API_TOKEN,
        'Content-Type': 'application/json'
      }
    })

    const { documentId, inviteUrl } = uploadRes.data

    await supabase.from('rent_deeds').update({
      leegality_document_id: documentId,
      leegality_invite_url: inviteUrl,
      status: 'sent'
    }).eq('id', req.params.id)

    res.json({ success: true, document_id: documentId, invite_url: inviteUrl })
  } catch (err) {
    console.error('Leegality error:', err.response?.data || err.message)
    res.status(500).json({
      error: 'Leegality API error',
      details: err.response?.data || err.message
    })
  }
})

// ── POST /api/rent-deeds/webhook/leegality ───────────────────
// Leegality calls this when the document is signed
router.post('/webhook/leegality', async (req, res) => {
  const { documentId, status, signedDocumentUrl } = req.body
  console.log('Leegality webhook:', documentId, status)

  if (status === 'SIGNED' && documentId) {
    await supabase
      .from('rent_deeds')
      .update({
        status: 'signed',
        tenant_signed_at: new Date().toISOString(),
        signed_pdf_url: signedDocumentUrl || null
      })
      .eq('leegality_document_id', documentId)
  }

  res.json({ received: true })
})

// ── Deed HTML template ───────────────────────────────────────
function buildDeedHtml(deed) {
  const t = deed.tenants || {}
  const p = deed.properties || {}
  const r = deed.rooms || {}

  const startDate = new Date(deed.agreement_start).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })
  const endDate   = new Date(deed.agreement_end).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })
  const today     = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })
  const rentWords = numberToWords(Number(deed.monthly_rent))

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.8; color: #111; max-width: 800px; margin: 0 auto; padding: 40px; }
  h1 { text-align: center; font-size: 18pt; text-decoration: underline; margin-bottom: 6px; }
  h2 { text-align: center; font-size: 13pt; margin-top: 0; margin-bottom: 32px; }
  .parties { margin: 24px 0; }
  .clause { margin-bottom: 14px; }
  .clause-num { font-weight: bold; }
  table.details { width: 100%; border-collapse: collapse; margin: 20px 0; }
  table.details td { padding: 6px 10px; border: 1px solid #999; }
  table.details td:first-child { font-weight: bold; width: 40%; background: #f5f5f5; }
  .signature-block { margin-top: 60px; display: flex; justify-content: space-between; }
  .sig-box { width: 45%; }
  .sig-line { border-top: 1px solid #111; margin-top: 50px; margin-bottom: 4px; }
  .watermark { text-align: center; color: #aaa; font-size: 10pt; margin-top: 40px; }
</style>
</head>
<body>

<h1>PAYING GUEST ACCOMMODATION AGREEMENT</h1>
<h2>Deed No: ${deed.deed_number || 'DRAFT'}</h2>

<p>This Paying Guest Accommodation Agreement (<strong>"Agreement"</strong>) is made and executed on <strong>${today}</strong> between:</p>

<div class="parties">
  <p><strong>LICENSOR (Owner):</strong><br>
  ${p.name || 'Blite Living'}, having its property at ${p.address || ''}, ${p.city || 'Gurgaon'}, ${p.state || 'Haryana'} – ${p.pincode || ''}
  ${p.pan ? `(PAN: ${p.pan})` : ''}<br>
  (hereinafter referred to as the <strong>"Owner"</strong>)</p>

  <p><strong>AND</strong></p>

  <p><strong>LICENSEE (Tenant):</strong><br>
  ${t.full_name || '___________'}, 
  ${t.gender ? `S/o or D/o,` : ''} 
  Phone: ${t.phone || '___________'},
  ${t.email ? `Email: ${t.email},` : ''}
  ${t.permanent_address ? `Permanent address: ${t.permanent_address}` : ''}<br>
  (hereinafter referred to as the <strong>"Tenant"</strong>)</p>
</div>

<p>Both parties have agreed to the following terms and conditions:</p>

<table class="details">
  <tr><td>Room Number</td><td>${r.room_number || '___'}</td></tr>
  <tr><td>Property Address</td><td>${p.address || ''}, ${p.city || 'Gurgaon'} – ${p.pincode || ''}</td></tr>
  <tr><td>Agreement Period</td><td>${startDate} to ${endDate}</td></tr>
  <tr><td>Monthly Rent</td><td>₹${Number(deed.monthly_rent).toLocaleString('en-IN')} (${rentWords} only)</td></tr>
  <tr><td>Security Deposit</td><td>₹${Number(deed.security_deposit || 0).toLocaleString('en-IN')}</td></tr>
  <tr><td>Rent Due Date</td><td>1st of every month</td></tr>
  <tr><td>Notice Period</td><td>${deed.notice_period_days || 30} days</td></tr>
  ${deed.lock_in_months > 0 ? `<tr><td>Lock-in Period</td><td>${deed.lock_in_months} months</td></tr>` : ''}
</table>

<p class="clause"><span class="clause-num">1. RENT PAYMENT.</span> The Tenant agrees to pay a monthly rent of ₹${Number(deed.monthly_rent).toLocaleString('en-IN')} on or before the 1st day of each calendar month. A late fee may be charged for payments delayed beyond 7 days.</p>

<p class="clause"><span class="clause-num">2. SECURITY DEPOSIT.</span> The Tenant has paid a refundable security deposit of ₹${Number(deed.security_deposit || 0).toLocaleString('en-IN')}. This deposit shall be refunded within 15 days of vacating, after deducting any dues or damages.</p>

<p class="clause"><span class="clause-num">3. UTILITIES.</span> Electricity charges, if applicable, shall be charged separately based on actual meter reading. Water, WiFi, and maintenance are included as per the agreed package.</p>

<p class="clause"><span class="clause-num">4. NOTICE PERIOD.</span> Either party wishing to terminate this agreement must give a written notice of ${deed.notice_period_days || 30} days. The Tenant shall vacate peacefully and return all keys and access cards.</p>

<p class="clause"><span class="clause-num">5. RULES OF STAY.</span> The Tenant agrees to: (a) maintain cleanliness of the room and common areas; (b) not damage property or fixtures; (c) not engage in any illegal activities; (d) respect quiet hours (11 PM – 7 AM); (e) not sublet or transfer occupancy to any third party.</p>

<p class="clause"><span class="clause-num">6. VISITORS.</span> Visitors are permitted in common areas only. Overnight guests require prior permission from the Owner/Manager.</p>

<p class="clause"><span class="clause-num">7. TERMINATION.</span> The Owner may immediately terminate this agreement if the Tenant: (a) fails to pay rent for more than 30 days; (b) causes damage to property; (c) violates house rules repeatedly; (d) engages in any illegal activity.</p>

<p class="clause"><span class="clause-num">8. GOVERNING LAW.</span> This agreement is subject to the laws of India. Any disputes shall be resolved in the courts of ${p.city || 'Gurgaon'}, Haryana.</p>

<p class="clause"><span class="clause-num">9. ENTIRE AGREEMENT.</span> This document constitutes the entire agreement between the parties and supersedes all prior understandings, oral or written.</p>

<p>IN WITNESS WHEREOF, both parties have agreed to and signed this Agreement on the date first written above.</p>

<div class="signature-block">
  <div class="sig-box">
    <div class="sig-line"></div>
    <strong>Owner / Authorized Signatory</strong><br>
    ${p.name || 'Blite Living'}<br>
    Date: _______________
  </div>
  <div class="sig-box">
    <div class="sig-line"></div>
    <strong>Tenant</strong><br>
    ${t.full_name || '___________'}<br>
    Date: _______________
  </div>
</div>

<div class="watermark">Generated by Blite PMS · ${deed.deed_number || 'DRAFT'} · This is a digitally generated document.</div>
</body>
</html>`
}

// Simple number to words (for rent amount in deed)
function numberToWords(n) {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
  if (n === 0) return 'Zero'
  if (n < 20) return ones[n]
  if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' ' + ones[n%10] : '')
  if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' ' + numberToWords(n%100) : '')
  if (n < 100000) return numberToWords(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' ' + numberToWords(n%1000) : '')
  if (n < 10000000) return numberToWords(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' ' + numberToWords(n%100000) : '')
  return numberToWords(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' ' + numberToWords(n%10000000) : '')
}

export default router
