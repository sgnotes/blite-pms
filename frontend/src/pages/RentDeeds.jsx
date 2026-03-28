import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { deedsApi } from '../lib/api'
import { toast } from 'sonner'
import { Plus, X, FileText, Send, ExternalLink } from 'lucide-react'

const statusColor = { draft:'gray', sent:'blue', signed:'green', expired:'red' }

export default function RentDeeds() {
  const [deeds, setDeeds] = useState([])
  const [tenants, setTenants] = useState([])
  const [rooms, setRooms] = useState([])
  const [propertyId, setPropertyId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)

  const load = async () => {
    const { data: props } = await supabase.from('properties').select('id').limit(1)
    if (!props?.length) { setLoading(false); return }
    const pid = props[0].id
    setPropertyId(pid)
    const [dr, tr, rr] = await Promise.all([
      supabase.from('rent_deeds').select('*, tenants(full_name,phone), rooms(room_number)').eq('property_id', pid).order('created_at',{ascending:false}),
      supabase.from('tenants').select('id,full_name,room_id,rent_amount,check_in_date').eq('property_id',pid).eq('status','active'),
      supabase.from('rooms').select('id,room_number').eq('property_id',pid)
    ])
    setDeeds(dr.data || [])
    setTenants(tr.data || [])
    setRooms(rr.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleGeneratePdf = async (id) => {
    setActionLoading(id + '_pdf')
    try {
      await deedsApi.generatePdf(id)
      toast.success('PDF generated!')
      load()
    } catch { toast.error('PDF generation failed — check backend Puppeteer setup') }
    finally { setActionLoading(null) }
  }

  const handleSendForSign = async (id) => {
    setActionLoading(id + '_sign')
    try {
      const res = await deedsApi.sendForSign(id)
      toast.success('Sent for e-signature via Leegality!')
      load()
    } catch { toast.error('Failed to send — check Leegality API token in backend .env') }
    finally { setActionLoading(null) }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Rent deeds</div>
          <div className="page-subtitle">{deeds.filter(d=>d.status==='signed').length} signed · {deeds.filter(d=>d.status==='draft').length} draft</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={15}/> New deed</button>
      </div>

      {loading
        ? <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:200}}><div className="spinner"/></div>
        : deeds.length === 0
          ? <div className="empty-state">
              <div className="empty-icon">📄</div>
              <div className="empty-title">No rent deeds yet</div>
              <p>Create your first rent agreement for a tenant.</p>
            </div>
          : <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {deeds.map(d => (
                <div key={d.id} className="card">
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                        <FileText size={14} color="var(--text2)"/>
                        <span style={{fontWeight:600,fontFamily:'var(--mono)',fontSize:13}}>{d.deed_number || 'Draft'}</span>
                        <span className={`badge badge-${statusColor[d.status]}`}>{d.status}</span>
                      </div>
                      <div style={{fontWeight:500,fontSize:15,marginBottom:4}}>{d.tenants?.full_name}</div>
                      <div style={{fontSize:12,color:'var(--text2)',display:'flex',gap:12}}>
                        <span>Room {d.rooms?.room_number}</span>
                        <span>₹{Number(d.monthly_rent).toLocaleString('en-IN')}/mo</span>
                        <span>{new Date(d.agreement_start).toLocaleDateString('en-IN')} → {new Date(d.agreement_end).toLocaleDateString('en-IN')}</span>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:6,flexShrink:0,marginLeft:12}}>
                      {d.status === 'draft' && (
                        <>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleGeneratePdf(d.id)} disabled={actionLoading===d.id+'_pdf'}>
                            {actionLoading===d.id+'_pdf' ? <span className="spinner" style={{width:12,height:12}}/> : 'Gen PDF'}
                          </button>
                          {d.pdf_url && (
                            <button className="btn btn-primary btn-sm" onClick={() => handleSendForSign(d.id)} disabled={actionLoading===d.id+'_sign'}>
                              {actionLoading===d.id+'_sign' ? <span className="spinner" style={{width:12,height:12}}/> : <><Send size={12}/> Send for sign</>}
                            </button>
                          )}
                        </>
                      )}
                      {d.status === 'sent' && d.leegality_invite_url && (
                        <a href={d.leegality_invite_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                          <ExternalLink size={12}/> View invite
                        </a>
                      )}
                      {d.signed_pdf_url && (
                        <a href={d.signed_pdf_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                          <ExternalLink size={12}/> Signed PDF
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
      }

      {showModal && <NewDeedModal propertyId={propertyId} tenants={tenants} rooms={rooms} onClose={()=>setShowModal(false)} onSaved={()=>{setShowModal(false);load()}} />}
    </div>
  )
}

function NewDeedModal({ propertyId, tenants, rooms, onClose, onSaved }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    tenant_id:'', room_id:'', agreement_start: new Date().toISOString().split('T')[0],
    agreement_end:'', monthly_rent:'', security_deposit:'',
    notice_period_days:'30', lock_in_months:'0'
  })
  const set = k => e => setForm(f => ({...f,[k]:e.target.value}))

  const selectedTenant = tenants.find(t => t.id === form.tenant_id)
  useEffect(() => {
    if (selectedTenant) {
      const end = new Date(selectedTenant.check_in_date)
      end.setFullYear(end.getFullYear() + 1)
      setForm(f => ({
        ...f,
        room_id: selectedTenant.room_id || f.room_id,
        monthly_rent: String(selectedTenant.rent_amount || ''),
        agreement_start: selectedTenant.check_in_date,
        agreement_end: end.toISOString().split('T')[0]
      }))
    }
  }, [form.tenant_id])

  const handleSave = async () => {
    if (!form.tenant_id || !form.monthly_rent || !form.agreement_end) { toast.error('Please fill all required fields'); return }
    setSaving(true)
    try {
      await deedsApi.create({ ...form, property_id: propertyId, monthly_rent: Number(form.monthly_rent), security_deposit: Number(form.security_deposit||0), notice_period_days: Number(form.notice_period_days), lock_in_months: Number(form.lock_in_months) })
      toast.success('Deed created!')
      onSaved()
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to create deed') }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">New rent deed</div>
          <button className="modal-close" onClick={onClose}><X size={18}/></button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div className="field"><label className="label">Tenant *</label>
            <select className="input" value={form.tenant_id} onChange={set('tenant_id')}>
              <option value="">Select tenant</option>
              {tenants.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </div>
          <div className="field"><label className="label">Room</label>
            <select className="input" value={form.room_id} onChange={set('room_id')}>
              <option value="">Select room</option>
              {rooms.map(r=><option key={r.id} value={r.id}>Room {r.room_number}</option>)}
            </select>
          </div>
          <div className="grid-2">
            <div className="field"><label className="label">Start date *</label><input className="input" type="date" value={form.agreement_start} onChange={set('agreement_start')}/></div>
            <div className="field"><label className="label">End date *</label><input className="input" type="date" value={form.agreement_end} onChange={set('agreement_end')}/></div>
          </div>
          <div className="grid-2">
            <div className="field"><label className="label">Monthly rent (₹) *</label><input className="input" type="number" placeholder="12000" value={form.monthly_rent} onChange={set('monthly_rent')}/></div>
            <div className="field"><label className="label">Security deposit (₹)</label><input className="input" type="number" placeholder="24000" value={form.security_deposit} onChange={set('security_deposit')}/></div>
          </div>
          <div className="grid-2">
            <div className="field"><label className="label">Notice period (days)</label><input className="input" type="number" value={form.notice_period_days} onChange={set('notice_period_days')}/></div>
            <div className="field"><label className="label">Lock-in (months)</label><input className="input" type="number" value={form.lock_in_months} onChange={set('lock_in_months')}/></div>
          </div>
          <div style={{background:'var(--accent-bg)',border:'1px solid rgba(249,115,22,0.2)',borderRadius:'var(--radius)',padding:'10px 14px',fontSize:12,color:'var(--accent)'}}>
            After creating, click "Gen PDF" to generate the rent agreement PDF, then "Send for sign" to dispatch via Leegality e-signature.
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:24,paddingTop:20,borderTop:'1px solid var(--border)'}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving?<span className="spinner" style={{width:14,height:14}}/>:<><FileText size={14}/> Create deed</>}
          </button>
        </div>
      </div>
    </div>
  )
}
