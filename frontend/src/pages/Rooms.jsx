import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { roomsApi } from '../lib/api'
import { toast } from 'sonner'
import { Plus, X } from 'lucide-react'

const statusColor = { vacant:'green', occupied:'blue', maintenance:'red' }
const fmt = n => '₹' + Number(n||0).toLocaleString('en-IN')

export default function Rooms() {
  const [rooms, setRooms] = useState([])
  const [propertyId, setPropertyId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const load = async () => {
    const { data: props } = await supabase.from('properties').select('id').limit(1)
    if (!props?.length) { setLoading(false); return }
    const pid = props[0].id
    setPropertyId(pid)
    const { data } = await supabase.from('rooms').select('*, tenants(id,full_name,status)').eq('property_id', pid).order('room_number')
    setRooms(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = filter === 'all' ? rooms : rooms.filter(r => r.status === filter)

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Rooms</div>
          <div className="page-subtitle">{rooms.filter(r=>r.status==='vacant').length} vacant of {rooms.length}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={15}/> Add room</button>
      </div>

      <div className="tabs">
        {['all','vacant','occupied','maintenance'].map(s => (
          <button key={s} className={`tab${filter===s?' active':''}`} onClick={() => setFilter(s)}>
            {s.charAt(0).toUpperCase()+s.slice(1)}
          </button>
        ))}
      </div>

      {loading
        ? <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:200}}><div className="spinner"/></div>
        : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:14}}>
            {filtered.map(r => (
              <div key={r.id} className="card" style={{borderTop:`2px solid ${r.status==='vacant'?'var(--green)':r.status==='occupied'?'var(--blue)':'var(--red)'}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                  <div>
                    <div style={{fontSize:20,fontWeight:700,letterSpacing:'-0.02em'}}>Room {r.room_number}</div>
                    <div style={{fontSize:12,color:'var(--text2)'}}>Floor {r.floor} · {r.room_type}</div>
                  </div>
                  <span className={`badge badge-${statusColor[r.status]}`}>{r.status}</span>
                </div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
                  {r.amenities?.map(a => <span key={a} className="badge badge-gray">{a}</span>)}
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
                  <div>
                    <div style={{color:'var(--text3)',fontSize:11}}>Occupancy</div>
                    <div style={{fontWeight:600}}>{r.occupied_beds}/{r.capacity} beds</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{color:'var(--text3)',fontSize:11}}>Base rent</div>
                    <div style={{fontWeight:600,fontFamily:'var(--mono)'}}>{fmt(r.base_rent)}</div>
                  </div>
                </div>
                {r.tenants?.filter(t=>t.status==='active').length > 0 && (
                  <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)'}}>
                    {r.tenants.filter(t=>t.status==='active').map(t => (
                      <div key={t.id} style={{fontSize:12,color:'var(--text2)'}}>· {t.full_name}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
      }

      {showModal && <AddRoomModal propertyId={propertyId} onClose={()=>setShowModal(false)} onSaved={()=>{setShowModal(false);load()}} />}
    </div>
  )
}

function AddRoomModal({ propertyId, onClose, onSaved }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ room_number:'', floor:'1', capacity:'1', room_type:'single', gender_preference:'any', meal_plan:'none', base_rent:'', security_deposit:'', amenities:[], notes:'' })
  const set = k => e => setForm(f => ({...f,[k]:e.target.value}))

  const amenityOpts = ['ac','wifi','attached_bath','tv','geyser','balcony','fridge']
  const toggleAmenity = a => setForm(f => ({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter(x=>x!==a) : [...f.amenities, a] }))

  const handleSave = async () => {
    if (!form.room_number || !form.base_rent) { toast.error('Room number and rent required'); return }
    setSaving(true)
    try {
      await roomsApi.create({ ...form, property_id: propertyId, floor: parseInt(form.floor), capacity: parseInt(form.capacity) })
      toast.success('Room added!')
      onSaved()
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to add room') }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Add new room</div>
          <button className="modal-close" onClick={onClose}><X size={18}/></button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div className="grid-3">
            <div className="field"><label className="label">Room no. *</label><input className="input" placeholder="101" value={form.room_number} onChange={set('room_number')}/></div>
            <div className="field"><label className="label">Floor</label><input className="input" type="number" min="0" value={form.floor} onChange={set('floor')}/></div>
            <div className="field"><label className="label">Beds</label><input className="input" type="number" min="1" max="10" value={form.capacity} onChange={set('capacity')}/></div>
          </div>
          <div className="grid-2">
            <div className="field"><label className="label">Type</label>
              <select className="input" value={form.room_type} onChange={set('room_type')}>
                {['single','double','triple','dormitory'].map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field"><label className="label">Gender preference</label>
              <select className="input" value={form.gender_preference} onChange={set('gender_preference')}>
                <option value="any">Any</option><option value="male">Male only</option><option value="female">Female only</option>
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="field"><label className="label">Base rent (₹/mo) *</label><input className="input" type="number" placeholder="12000" value={form.base_rent} onChange={set('base_rent')}/></div>
            <div className="field"><label className="label">Security deposit (₹)</label><input className="input" type="number" placeholder="24000" value={form.security_deposit} onChange={set('security_deposit')}/></div>
          </div>
          <div className="field">
            <label className="label">Amenities</label>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {amenityOpts.map(a => (
                <button key={a} type="button" onClick={()=>toggleAmenity(a)}
                  style={{ padding:'5px 10px', borderRadius:'var(--radius)', border:`1px solid ${form.amenities.includes(a)?'var(--accent)':'var(--border2)'}`, background:form.amenities.includes(a)?'var(--accent-bg)':'var(--bg3)', color:form.amenities.includes(a)?'var(--accent)':'var(--text2)', cursor:'pointer', fontSize:12, fontFamily:'var(--font)' }}>
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:24,paddingTop:20,borderTop:'1px solid var(--border)'}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving?<span className="spinner" style={{width:14,height:14}}/>:<><Plus size={14}/> Add room</>}
          </button>
        </div>
      </div>
    </div>
  )
}
