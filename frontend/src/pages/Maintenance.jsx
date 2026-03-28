import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { maintenanceApi } from '../lib/api'
import { toast } from 'sonner'
import { Plus, X, Wrench } from 'lucide-react'

const priorityColor = { low:'gray', medium:'yellow', high:'orange', urgent:'red' }
const statusColor   = { open:'blue', in_progress:'orange', resolved:'green', closed:'gray' }

export default function Maintenance() {
  const [tickets, setTickets] = useState([])
  const [rooms, setRooms] = useState([])
  const [tenants, setTenants] = useState([])
  const [propertyId, setPropertyId] = useState(null)
  const [filter, setFilter] = useState('open')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const load = async () => {
    const { data: props } = await supabase.from('properties').select('id').limit(1)
    if (!props?.length) { setLoading(false); return }
    const pid = props[0].id
    setPropertyId(pid)
    const [tr, rr, tenr] = await Promise.all([
      supabase.from('maintenance_tickets').select('*, rooms(room_number), tenants(full_name)').eq('property_id', pid).order('created_at', { ascending: false }),
      supabase.from('rooms').select('id,room_number').eq('property_id', pid),
      supabase.from('tenants').select('id,full_name,room_id').eq('property_id', pid).eq('status','active')
    ])
    setTickets(tr.data || [])
    setRooms(rr.data || [])
    setTenants(tenr.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter)

  const updateStatus = async (id, status) => {
    await supabase.from('maintenance_tickets').update({ status, ...(status==='resolved'?{resolved_at:new Date().toISOString()}:{}) }).eq('id', id)
    toast.success('Status updated')
    load()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Maintenance</div>
          <div className="page-subtitle">{tickets.filter(t=>t.status==='open').length} open tickets</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={15} /> New ticket</button>
      </div>

      <div className="tabs">
        {['open','in_progress','resolved','closed','all'].map(s => (
          <button key={s} className={`tab${filter===s?' active':''}`} onClick={() => setFilter(s)}>
            {s==='in_progress'?'In progress':s.charAt(0).toUpperCase()+s.slice(1)}
          </button>
        ))}
      </div>

      {loading
        ? <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:200}}><div className="spinner"/></div>
        : filtered.length === 0
          ? <div className="empty-state"><div className="empty-icon">🔧</div><div className="empty-title">No tickets here</div></div>
          : <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {filtered.map(t => (
                <div key={t.id} className="card">
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                        <span style={{fontWeight:600,fontSize:14}}>{t.title}</span>
                        <span className={`badge badge-${priorityColor[t.priority]}`}>{t.priority}</span>
                        <span className={`badge badge-${statusColor[t.status]}`}>{t.status.replace('_',' ')}</span>
                      </div>
                      {t.description && <div style={{fontSize:12,color:'var(--text2)',marginBottom:6}}>{t.description}</div>}
                      <div style={{display:'flex',gap:12,fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)'}}>
                        <span>Room {t.rooms?.room_number||'—'}</span>
                        {t.tenants?.full_name && <span>· {t.tenants.full_name}</span>}
                        <span>· {t.category}</span>
                        <span>· {new Date(t.created_at).toLocaleDateString('en-IN')}</span>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:6,flexShrink:0,marginLeft:12}}>
                      {t.status==='open' && <button className="btn btn-ghost btn-sm" onClick={()=>updateStatus(t.id,'in_progress')}>Start →</button>}
                      {t.status==='in_progress' && <button className="btn btn-ghost btn-sm" style={{color:'var(--green)'}} onClick={()=>updateStatus(t.id,'resolved')}>Resolve ✓</button>}
                      {t.status==='resolved' && <button className="btn btn-ghost btn-sm" onClick={()=>updateStatus(t.id,'closed')}>Close</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
      }

      {showModal && <NewTicketModal propertyId={propertyId} rooms={rooms} tenants={tenants} onClose={()=>setShowModal(false)} onSaved={()=>{setShowModal(false);load()}} />}
    </div>
  )
}

function NewTicketModal({ propertyId, rooms, tenants, onClose, onSaved }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title:'', description:'', category:'plumbing', priority:'medium', room_id:'', tenant_id:'' })
  const set = k => e => setForm(f => ({...f,[k]:e.target.value}))

  const handleSave = async () => {
    if (!form.title) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      await maintenanceApi.create({...form, property_id: propertyId})
      toast.success('Ticket raised!')
      onSaved()
    } catch { toast.error('Failed to raise ticket') }
    finally { setSaving(false) }
  }

  const roomTenants = form.room_id ? tenants.filter(t => t.room_id === form.room_id) : tenants

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">New maintenance ticket</div>
          <button className="modal-close" onClick={onClose}><X size={18}/></button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div className="field"><label className="label">Title *</label><input className="input" placeholder="AC not cooling in room 101" value={form.title} onChange={set('title')}/></div>
          <div className="field"><label className="label">Description</label><textarea className="input" placeholder="More details..." value={form.description} onChange={set('description')}/></div>
          <div className="grid-2">
            <div className="field"><label className="label">Category</label>
              <select className="input" value={form.category} onChange={set('category')}>
                {['plumbing','electrical','appliance','furniture','cleaning','internet','ac','other'].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field"><label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={set('priority')}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="field"><label className="label">Room</label>
              <select className="input" value={form.room_id} onChange={set('room_id')}>
                <option value="">Any room</option>
                {rooms.map(r=><option key={r.id} value={r.id}>Room {r.room_number}</option>)}
              </select>
            </div>
            <div className="field"><label className="label">Tenant</label>
              <select className="input" value={form.tenant_id} onChange={set('tenant_id')}>
                <option value="">No specific tenant</option>
                {roomTenants.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:24,paddingTop:20,borderTop:'1px solid var(--border)'}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving?<span className="spinner" style={{width:14,height:14}}/>:<><Wrench size={14}/> Raise ticket</>}
          </button>
        </div>
      </div>
    </div>
  )
}
