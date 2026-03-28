import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { dashboardApi } from '../lib/api'
import { Users, IndianRupee, Wrench } from 'lucide-react'

const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN')

export default function Dashboard() {
  const [propertyId, setPropertyId] = useState(null)
  const [stats, setStats] = useState(null)
  const [recentTenants, setRecentTenants] = useState([])
  const [overdueRent, setOverdueRent] = useState([])
  const [openTickets, setOpenTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      const { data: props } = await supabase.from('properties').select('id,name').limit(1)
      if (!props?.length) { setLoading(false); return }
      const pid = props[0].id
      setPropertyId(pid)
      const now = new Date()
      const month = now.getMonth() + 1
      const year = now.getFullYear()
      const [statsRes, tenantsRes, overdueRes, ticketsRes] = await Promise.all([
        dashboardApi.getSummary(pid).catch(() => ({ data: null })),
        supabase.from('tenants').select('id,full_name,phone,check_in_date,rent_amount,rooms(room_number)').eq('property_id', pid).eq('status', 'active').order('created_at', { ascending: false }).limit(5),
        supabase.from('rent_ledger').select('*, tenants(full_name), rooms(room_number)').eq('property_id', pid).eq('billing_month', month).eq('billing_year', year).in('payment_status', ['pending', 'overdue']),
        supabase.from('maintenance_tickets').select('*').eq('property_id', pid).in('status', ['open', 'in_progress']).order('created_at', { ascending: false }).limit(5)
      ])
      setStats(statsRes.data)
      setRecentTenants(tenantsRes.data || [])
      setOverdueRent(overdueRes.data || [])
      setOpenTickets(ticketsRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300 }}><div className="spinner" /></div>

  if (!propertyId) return (
    <div className="empty-state">
      <div className="empty-icon">🏠</div>
      <div className="empty-title">No property yet</div>
      <p>Run the seed SQL or add your property first.</p>
    </div>
  )

  const s = stats
  const occupancyPct = s?.rooms?.total ? Math.round((s.rooms.occupied / s.rooms.total) * 100) : 0

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">{new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</div>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom:24 }}>
        <div className="stat-card">
          <div className="stat-label">Occupancy</div>
          <div className="stat-value stat-accent">{occupancyPct}%</div>
          <div className="stat-sub">{s?.rooms?.occupied || 0} of {s?.rooms?.total || 0} rooms</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Rent collected</div>
          <div className="stat-value stat-green">{fmt(s?.rent?.total_collected)}</div>
          <div className="stat-sub">{s?.rent?.collection_rate || 0}% of {fmt(s?.rent?.total_due)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending</div>
          <div className="stat-value stat-red">{s?.rent?.pending_count || 0}</div>
          <div className="stat-sub">tenants unpaid</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Open tickets</div>
          <div className="stat-value stat-blue">{(s?.tickets?.open || 0) + (s?.tickets?.in_progress || 0)}</div>
          <div className="stat-sub">{s?.tickets?.urgent || 0} urgent</div>
        </div>
      </div>

      {s?.rent?.total_due > 0 && (
        <div className="card" style={{ marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
            <span style={{ fontSize:13, fontWeight:600 }}>Rent collection — {new Date().toLocaleDateString('en-IN', { month:'long' })}</span>
            <span style={{ fontSize:13, color:'var(--text2)', fontFamily:'var(--mono)' }}>{fmt(s.rent.total_collected)} / {fmt(s.rent.total_due)}</span>
          </div>
          <div style={{ height:8, background:'var(--bg4)', borderRadius:8, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${s.rent.collection_rate}%`, background:'var(--accent)', borderRadius:8 }} />
          </div>
          <div style={{ display:'flex', gap:20, marginTop:10 }}>
            <span style={{ fontSize:12, color:'var(--green)' }}>✓ {s.rent.paid_count} paid</span>
            <span style={{ fontSize:12, color:'var(--yellow)' }}>⏳ {s.rent.pending_count} pending</span>
            <span style={{ fontSize:12, color:'var(--red)' }}>⚠ {s.rent.overdue_count} overdue</span>
          </div>
        </div>
      )}

      <div className="grid-2" style={{ gap:20, marginBottom:20 }}>
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <IndianRupee size={15} color="var(--yellow)" />
              <span style={{ fontWeight:600, fontSize:14 }}>Pending payments</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/payments')}>View all</button>
          </div>
          {overdueRent.length === 0
            ? <div style={{ textAlign:'center', padding:'20px 0', color:'var(--text2)', fontSize:13 }}>All paid up! 🎉</div>
            : overdueRent.slice(0,5).map(r => (
              <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:500 }}>{r.tenants?.full_name}</div>
                  <div style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>Room {r.rooms?.room_number}</div>
                </div>
                <span style={{ fontSize:13, fontWeight:600, color:'var(--yellow)' }}>{fmt(r.total_due)}</span>
              </div>
            ))
          }
        </div>

        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Wrench size={15} color="var(--blue)" />
              <span style={{ fontWeight:600, fontSize:14 }}>Open tickets</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/maintenance')}>View all</button>
          </div>
          {openTickets.length === 0
            ? <div style={{ textAlign:'center', padding:'20px 0', color:'var(--text2)', fontSize:13 }}>No open tickets</div>
            : openTickets.map(t => (
              <div key={t.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:500 }}>{t.title}</div>
                  <div style={{ fontSize:11, color:'var(--text3)' }}>{t.category}</div>
                </div>
                <span className={`badge badge-${t.priority==='urgent'||t.priority==='high'?'red':t.priority==='medium'?'yellow':'gray'}`}>{t.priority}</span>
              </div>
            ))
          }
        </div>
      </div>

      <div className="card">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Users size={15} color="var(--accent)" />
            <span style={{ fontWeight:600, fontSize:14 }}>Active tenants</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/tenants')}>View all</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Room</th><th>Phone</th><th>Rent/mo</th><th>Check-in</th></tr></thead>
            <tbody>
              {recentTenants.map(t => (
                <tr key={t.id} style={{ cursor:'pointer' }} onClick={() => navigate(`/tenants/${t.id}`)}>
                  <td style={{ fontWeight:500 }}>{t.full_name}</td>
                  <td><span className="badge badge-gray">{t.rooms?.room_number}</span></td>
                  <td style={{ fontFamily:'var(--mono)', color:'var(--text2)' }}>{t.phone}</td>
                  <td style={{ fontFamily:'var(--mono)' }}>{fmt(t.rent_amount)}</td>
                  <td style={{ color:'var(--text2)', fontSize:12 }}>{new Date(t.check_in_date).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
