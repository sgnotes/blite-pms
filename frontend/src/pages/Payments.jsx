import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { paymentsApi } from '../lib/api'
import { toast } from 'sonner'
import { Plus, CreditCard, CheckCircle, X, RefreshCw } from 'lucide-react'

const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN')
const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const statusColor = { paid:'green', pending:'yellow', overdue:'red', partial:'orange', waived:'gray' }

export default function Payments() {
  const [propertyId, setPropertyId] = useState(null)
  const [ledger, setLedger] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [payModal, setPayModal] = useState(null)
  const now = new Date()
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1)
  const [selYear, setSelYear] = useState(now.getFullYear())

  const load = async (pid, month, year) => {
    setLoading(true)
    const { data } = await supabase
      .from('rent_ledger')
      .select('*, tenants(full_name, phone), rooms(room_number)')
      .eq('property_id', pid)
      .eq('billing_month', month)
      .eq('billing_year', year)
      .order('payment_status')
    setLedger(data || [])
    setLoading(false)
  }

  useEffect(() => {
    const init = async () => {
      const { data: props } = await supabase.from('properties').select('id').limit(1)
      if (!props?.length) { setLoading(false); return }
      setPropertyId(props[0].id)
      await load(props[0].id, selMonth, selYear)
    }
    init()
  }, [])

  const changeMonth = async (m, y) => {
    setSelMonth(m); setSelYear(y)
    if (propertyId) await load(propertyId, m, y)
  }

  const handleGenerate = async () => {
    if (!propertyId) return
    setGenerating(true)
    try {
      const res = await paymentsApi.generateLedger({ property_id: propertyId, billing_month: selMonth, billing_year: selYear })
      toast.success(`Generated ${res.data.created} rent entries`)
      await load(propertyId, selMonth, selYear)
    } catch (e) { toast.error('Failed to generate ledger') }
    finally { setGenerating(false) }
  }

  const totalDue = ledger.reduce((s, r) => s + Number(r.total_due || 0), 0)
  const totalPaid = ledger.reduce((s, r) => s + Number(r.amount_paid || 0), 0)
  const pending = ledger.filter(r => r.payment_status === 'pending' || r.payment_status === 'overdue')

  const prevMonth = () => { const d = new Date(selYear, selMonth - 2); changeMonth(d.getMonth()+1, d.getFullYear()) }
  const nextMonth = () => { const d = new Date(selYear, selMonth); changeMonth(d.getMonth()+1, d.getFullYear()) }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Payments</div>
          <div className="page-subtitle">Rent ledger & collection tracking</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost" onClick={handleGenerate} disabled={generating}>
            <RefreshCw size={14} /> {generating ? 'Generating...' : 'Generate entries'}
          </button>
        </div>
      </div>

      {/* Month selector */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button className="btn btn-ghost btn-sm" onClick={prevMonth}>←</button>
        <div style={{ fontWeight:600, fontSize:16, minWidth:140, textAlign:'center' }}>
          {months[selMonth-1]} {selYear}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={nextMonth}>→</button>
      </div>

      {/* Summary */}
      <div className="grid-3" style={{ marginBottom:20 }}>
        <div className="stat-card">
          <div className="stat-label">Total due</div>
          <div className="stat-value">{fmt(totalDue)}</div>
          <div className="stat-sub">{ledger.length} tenants</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Collected</div>
          <div className="stat-value stat-green">{fmt(totalPaid)}</div>
          <div className="stat-sub">{totalDue > 0 ? Math.round(totalPaid/totalDue*100) : 0}% collected</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Outstanding</div>
          <div className="stat-value stat-red">{fmt(totalDue - totalPaid)}</div>
          <div className="stat-sub">{pending.length} pending</div>
        </div>
      </div>

      {/* Collection bar */}
      {totalDue > 0 && (
        <div style={{ height:6, background:'var(--bg4)', borderRadius:6, overflow:'hidden', marginBottom:20 }}>
          <div style={{ height:'100%', width:`${Math.round(totalPaid/totalDue*100)}%`, background:'var(--green)', borderRadius:6 }} />
        </div>
      )}

      <div className="card" style={{ padding:0 }}>
        {loading ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200 }}><div className="spinner" /></div>
        ) : ledger.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💰</div>
            <div className="empty-title">No entries for {months[selMonth-1]} {selYear}</div>
            <p style={{ marginBottom:16 }}>Click "Generate entries" to create rent dues for all active tenants.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Tenant</th><th>Room</th><th>Rent due</th><th>Paid</th><th>Outstanding</th><th>Status</th><th>Action</th>
              </tr></thead>
              <tbody>
                {ledger.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight:500 }}>{r.tenants?.full_name}</div>
                      <div style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>{r.tenants?.phone}</div>
                    </td>
                    <td><span className="badge badge-gray">{r.rooms?.room_number}</span></td>
                    <td style={{ fontFamily:'var(--mono)' }}>{fmt(r.total_due)}</td>
                    <td style={{ fontFamily:'var(--mono)', color:'var(--green)' }}>{fmt(r.amount_paid)}</td>
                    <td style={{ fontFamily:'var(--mono)', color: Number(r.total_due) - Number(r.amount_paid) > 0 ? 'var(--red)' : 'var(--text3)' }}>
                      {fmt(Math.max(0, Number(r.total_due) - Number(r.amount_paid)))}
                    </td>
                    <td><span className={`badge badge-${statusColor[r.payment_status]||'gray'}`}>{r.payment_status}</span></td>
                    <td>
                      {r.payment_status !== 'paid' && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setPayModal(r)}>
                          <CreditCard size={12} /> Record
                        </button>
                      )}
                      {r.payment_status === 'paid' && <span style={{ fontSize:12, color:'var(--green)' }}>✓ Paid</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {payModal && (
        <RecordPaymentModal
          entry={payModal}
          onClose={() => setPayModal(null)}
          onSaved={() => { setPayModal(null); load(propertyId, selMonth, selYear) }}
        />
      )}
    </div>
  )
}

function RecordPaymentModal({ entry, onClose, onSaved }) {
  const [method, setMethod] = useState('upi')
  const [amount, setAmount] = useState(String(Math.max(0, Number(entry.total_due) - Number(entry.amount_paid))))
  const [txnId, setTxnId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const outstanding = Math.max(0, Number(entry.total_due) - Number(entry.amount_paid))

  const handleSave = async () => {
    setSaving(true)
    try {
      await paymentsApi.recordManual({ ledger_id: entry.id, amount_paid: Number(amount), payment_method: method, payment_date: date, transaction_id: txnId })
      toast.success('Payment recorded!')
      onSaved()
    } catch (e) { toast.error('Failed to record payment') }
    finally { setSaving(false) }
  }

  const handleRazorpay = async () => {
    try {
      const res = await paymentsApi.createOrder(entry.id)
      const { order_id, amount: amt, key_id, tenant_name, tenant_email, tenant_phone } = res.data
      const options = {
        key: key_id, amount: amt, currency: 'INR',
        name: 'Blite PMS', description: `Rent — ${entry.rooms?.room_number}`,
        order_id,
        prefill: { name: tenant_name, email: tenant_email, contact: tenant_phone },
        theme: { color: '#f97316' },
        handler: async (response) => {
          await paymentsApi.verifyPayment({ ...response, ledger_id: entry.id })
          toast.success('Payment verified!')
          onSaved()
        }
      }
      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (e) { toast.error('Failed to create Razorpay order') }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Record payment</div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ background:'var(--bg3)', borderRadius:'var(--radius)', padding:'12px 16px', marginBottom:20 }}>
          <div style={{ fontWeight:600, marginBottom:4 }}>{entry.tenants?.full_name}</div>
          <div style={{ fontSize:12, color:'var(--text2)' }}>Room {entry.rooms?.room_number} · Due: <span style={{ color:'var(--red)', fontFamily:'var(--mono)' }}>₹{outstanding.toLocaleString('en-IN')}</span></div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="field">
            <label className="label">Payment method</label>
            <div style={{ display:'flex', gap:8 }}>
              {['upi','cash','bank_transfer','cheque'].map(m => (
                <button key={m} onClick={() => setMethod(m)}
                  style={{ flex:1, padding:'8px 4px', borderRadius:'var(--radius)', border:`1px solid ${method===m?'var(--accent)':'var(--border2)'}`, background: method===m?'var(--accent-bg)':'var(--bg3)', color: method===m?'var(--accent)':'var(--text2)', cursor:'pointer', fontSize:12, fontFamily:'var(--font)' }}>
                  {m.replace('_',' ')}
                </button>
              ))}
            </div>
          </div>
          <div className="grid-2">
            <div className="field"><label className="label">Amount (₹)</label><input className="input" type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
            <div className="field"><label className="label">Payment date</label><input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          </div>
          {method !== 'cash' && (
            <div className="field"><label className="label">Transaction / ref ID</label><input className="input" placeholder="UPI ref, NEFT ref etc." value={txnId} onChange={e => setTxnId(e.target.value)} /></div>
          )}
        </div>

        <div style={{ display:'flex', gap:8, marginTop:24 }}>
          <button className="btn btn-ghost" style={{ flex:1 }} onClick={handleRazorpay}>
            <CreditCard size={14} /> Collect via Razorpay
          </button>
          <button className="btn btn-primary" style={{ flex:1 }} onClick={handleSave} disabled={saving}>
            {saving ? <span className="spinner" style={{ width:14, height:14 }} /> : <><CheckCircle size={14} /> Mark paid</>}
          </button>
        </div>
      </div>
    </div>
  )
}
