import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { tenantsApi } from '../lib/api'
import { toast } from 'sonner'
import { Plus, Search, X, UserPlus } from 'lucide-react'

const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN')

const kycColor = { pending:'yellow', submitted:'blue', verified:'green', rejected:'red' }
const statusColor = { active:'green', notice_period:'yellow', vacated:'gray' }

export default function Tenants() {
  const [tenants, setTenants] = useState([])
  const [rooms, setRooms] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('active')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [propertyId, setPropertyId] = useState(null)
  const navigate = useNavigate()

  const load = async () => {
    const { data: props } = await supabase.from('properties').select('id').limit(1)
    if (!props?.length) { setLoading(false); return }
    const pid = props[0].id
    setPropertyId(pid)
    const [tr, rr] = await Promise.all([
      supabase.from('tenants').select('*, rooms(room_number, floor)').eq('property_id', pid).order('created_at', { ascending: false }),
      supabase.from('rooms').select('id, room_number, floor, capacity, occupied_beds, status').eq('property_id', pid).order('room_number')
    ])
    setTenants(tr.data || [])
    setRooms(rr.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = tenants.filter(t => {
    const matchStatus = filter === 'all' || t.status === filter
    const matchSearch = !search || t.full_name.toLowerCase().includes(search.toLowerCase()) || t.phone.includes(search) || t.rooms?.room_number?.includes(search)
    return matchStatus && matchSearch
  })

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Tenants</div>
          <div className="page-subtitle">{tenants.filter(t => t.status === 'active').length} active</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={15} /> Add tenant
        </button>
      </div>

      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text3)' }} />
          <input className="input" placeholder="Search name, phone, room..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft:32 }} />
        </div>
        <div className="tabs" style={{ marginBottom:0 }}>
          {['active','notice_period','vacated','all'].map(s => (
            <button key={s} className={`tab${filter===s?' active':''}`} onClick={() => setFilter(s)}>
              {s === 'notice_period' ? 'Notice' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding:0 }}>
        {loading ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200 }}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👤</div>
            <div className="empty-title">No tenants found</div>
            <p>Try a different filter or add a new tenant.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Name</th><th>Room</th><th>Phone</th><th>Rent</th><th>Check-in</th><th>KYC</th><th>Status</th>
              </tr></thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} style={{ cursor:'pointer' }} onClick={() => navigate(`/tenants/${t.id}`)}>
                    <td>
                      <div style={{ fontWeight:500 }}>{t.full_name}</div>
                      <div style={{ fontSize:11, color:'var(--text3)' }}>{t.occupation} · {t.company_or_college}</div>
                    </td>
                    <td><span className="badge badge-gray">{t.rooms?.room_number}</span></td>
                    <td style={{ fontFamily:'var(--mono)', color:'var(--text2)' }}>{t.phone}</td>
                    <td style={{ fontFamily:'var(--mono)' }}>{fmt(t.rent_amount)}</td>
                    <td style={{ color:'var(--text2)', fontSize:12 }}>{new Date(t.check_in_date).toLocaleDateString('en-IN')}</td>
                    <td><span className={`badge badge-${kycColor[t.kyc_status]||'gray'}`}>{t.kyc_status}</span></td>
                    <td><span className={`badge badge-${statusColor[t.status]||'gray'}`}>{t.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <AddTenantModal
          propertyId={propertyId}
          rooms={rooms.filter(r => r.status !== 'maintenance')}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

function AddTenantModal({ propertyId, rooms, onClose, onSaved }) {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name:'', phone:'', email:'', gender:'male', date_of_birth:'',
    occupation:'working', company_or_college:'',
    permanent_address:'', home_city:'', home_state:'',
    emergency_contact_name:'', emergency_contact_phone:'', emergency_contact_relation:'',
    room_id:'', check_in_date: new Date().toISOString().split('T')[0],
    rent_amount:'', security_deposit_paid:'', rent_due_day:'1',
    meal_plan:'none', expected_stay_months:'12', notes:''
  })
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const selectedRoom = rooms.find(r => r.id === form.room_id)

  const handleSave = async () => {
    if (!form.full_name || !form.phone || !form.room_id || !form.rent_amount) {
      toast.error('Please fill all required fields')
      return
    }
    setSaving(true)
    try {
      await tenantsApi.create({ ...form, property_id: propertyId, rent_due_day: parseInt(form.rent_due_day) })
      toast.success('Tenant added successfully!')
      onSaved()
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to add tenant') }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div>
            <div className="modal-title">Add new tenant</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>Step {step} of 3</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Step indicator */}
        <div style={{ display:'flex', gap:6, marginBottom:24 }}>
          {['Personal','Stay details','Emergency'].map((s,i) => (
            <div key={i} style={{ flex:1, height:3, borderRadius:3, background: step > i ? 'var(--accent)' : 'var(--bg4)', transition:'background 0.2s' }} />
          ))}
        </div>

        {step === 1 && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <p className="section-title">Personal info</p>
            <div className="grid-2">
              <div className="field"><label className="label">Full name *</label><input className="input" placeholder="Amit Sharma" value={form.full_name} onChange={set('full_name')} /></div>
              <div className="field"><label className="label">Phone *</label><input className="input" placeholder="9811234567" value={form.phone} onChange={set('phone')} /></div>
            </div>
            <div className="grid-2">
              <div className="field"><label className="label">Email</label><input className="input" type="email" placeholder="amit@email.com" value={form.email} onChange={set('email')} /></div>
              <div className="field"><label className="label">Gender</label>
                <select className="input" value={form.gender} onChange={set('gender')}>
                  <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="field"><label className="label">Occupation</label>
                <select className="input" value={form.occupation} onChange={set('occupation')}>
                  <option value="working">Working professional</option><option value="student">Student</option>
                </select>
              </div>
              <div className="field"><label className="label">Company / College</label><input className="input" placeholder="Infosys, MDU etc." value={form.company_or_college} onChange={set('company_or_college')} /></div>
            </div>
            <div className="field"><label className="label">Permanent address</label><textarea className="input" placeholder="Full address with city, state, PIN" value={form.permanent_address} onChange={set('permanent_address')} style={{ minHeight:64 }} /></div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <p className="section-title">Stay details</p>
            <div className="field">
              <label className="label">Room *</label>
              <select className="input" value={form.room_id} onChange={set('room_id')}>
                <option value="">Select a room</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id} disabled={r.occupied_beds >= r.capacity && r.id !== form.room_id}>
                    Room {r.room_number} (Floor {r.floor}) — {r.occupied_beds}/{r.capacity} beds {r.occupied_beds >= r.capacity ? '· FULL' : ''}
                  </option>
                ))}
              </select>
              {selectedRoom && <div style={{ fontSize:12, color:'var(--text2)', marginTop:4 }}>Base rent: ₹{selectedRoom.base_rent?.toLocaleString('en-IN')}/mo</div>}
            </div>
            <div className="grid-2">
              <div className="field"><label className="label">Check-in date *</label><input className="input" type="date" value={form.check_in_date} onChange={set('check_in_date')} /></div>
              <div className="field"><label className="label">Expected stay (months)</label><input className="input" type="number" min="1" value={form.expected_stay_months} onChange={set('expected_stay_months')} /></div>
            </div>
            <div className="grid-2">
              <div className="field"><label className="label">Monthly rent (₹) *</label><input className="input" type="number" placeholder="12000" value={form.rent_amount} onChange={set('rent_amount')} /></div>
              <div className="field"><label className="label">Security deposit paid (₹)</label><input className="input" type="number" placeholder="24000" value={form.security_deposit_paid} onChange={set('security_deposit_paid')} /></div>
            </div>
            <div className="grid-2">
              <div className="field"><label className="label">Rent due day</label>
                <select className="input" value={form.rent_due_day} onChange={set('rent_due_day')}>
                  {[1,5,7,10,15].map(d => <option key={d} value={d}>{d}th of every month</option>)}
                </select>
              </div>
              <div className="field"><label className="label">Meal plan</label>
                <select className="input" value={form.meal_plan} onChange={set('meal_plan')}>
                  <option value="none">No meals</option>
                  <option value="breakfast">Breakfast only</option>
                  <option value="two_meals">2 meals</option>
                  <option value="three_meals">3 meals</option>
                </select>
              </div>
            </div>
            <div className="field"><label className="label">Notes</label><textarea className="input" placeholder="Any special arrangements, notes..." value={form.notes} onChange={set('notes')} style={{ minHeight:60 }} /></div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <p className="section-title">Emergency contact</p>
            <div className="grid-2">
              <div className="field"><label className="label">Contact name</label><input className="input" placeholder="Father / Mother name" value={form.emergency_contact_name} onChange={set('emergency_contact_name')} /></div>
              <div className="field"><label className="label">Relation</label><input className="input" placeholder="Father, Mother, Spouse..." value={form.emergency_contact_relation} onChange={set('emergency_contact_relation')} /></div>
            </div>
            <div className="field"><label className="label">Contact phone</label><input className="input" placeholder="Emergency phone number" value={form.emergency_contact_phone} onChange={set('emergency_contact_phone')} /></div>

            <div style={{ background:'var(--bg3)', borderRadius:'var(--radius)', padding:16, marginTop:8 }}>
              <p className="section-title" style={{ marginBottom:10 }}>Summary</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 16px', fontSize:13 }}>
                <div style={{ color:'var(--text2)' }}>Name</div><div style={{ fontWeight:500 }}>{form.full_name}</div>
                <div style={{ color:'var(--text2)' }}>Room</div><div>{rooms.find(r=>r.id===form.room_id)?.room_number || '—'}</div>
                <div style={{ color:'var(--text2)' }}>Monthly rent</div><div style={{ fontFamily:'var(--mono)' }}>₹{Number(form.rent_amount||0).toLocaleString('en-IN')}</div>
                <div style={{ color:'var(--text2)' }}>Check-in</div><div>{form.check_in_date}</div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display:'flex', justifyContent:'space-between', marginTop:24, paddingTop:20, borderTop:'1px solid var(--border)' }}>
          <button className="btn btn-ghost" onClick={() => step > 1 ? setStep(s => s-1) : onClose()}>
            {step > 1 ? '← Back' : 'Cancel'}
          </button>
          {step < 3
            ? <button className="btn btn-primary" onClick={() => setStep(s => s+1)}>Continue →</button>
            : <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" style={{ width:14, height:14 }} /> : <><UserPlus size={14} /> Add tenant</>}
              </button>
          }
        </div>
      </div>
    </div>
  )
}
