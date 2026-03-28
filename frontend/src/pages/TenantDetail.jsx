import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { uploadKycDoc } from '../lib/supabase'
import { tenantsApi } from '../lib/api'
import { toast } from 'sonner'
import { ArrowLeft, Upload, CheckCircle, Phone, Mail, Building } from 'lucide-react'

const fmt = n => '₹' + Number(n||0).toLocaleString('en-IN')
const kycDocs = ['aadhaar_front','aadhaar_back','pan_card','passport','driving_license','voter_id','company_id','student_id','photo']

export default function TenantDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tenant, setTenant] = useState(null)
  const [ledger, setLedger] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(null)

  const load = async () => {
    const [tr, lr] = await Promise.all([
      supabase.from('tenants').select('*, rooms(*), kyc_documents(*)').eq('id', id).single(),
      supabase.from('rent_ledger').select('*').eq('tenant_id', id).order('billing_year',{ascending:false}).order('billing_month',{ascending:false}).limit(12)
    ])
    setTenant(tr.data)
    setLedger(lr.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const handleKycUpload = async (docType, file) => {
    setUploading(docType)
    try {
      const { url } = await uploadKycDoc(id, docType, file)
      await tenantsApi.uploadKyc(id, { doc_type: docType, file_url: url, file_name: file.name })
      toast.success(`${docType.replace('_',' ')} uploaded!`)
      load()
    } catch (e) { toast.error('Upload failed: ' + e.message) }
    finally { setUploading(null) }
  }

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:300}}><div className="spinner"/></div>
  if (!tenant) return <div className="empty-state"><div className="empty-title">Tenant not found</div></div>

  const uploadedTypes = tenant.kyc_documents?.map(d => d.doc_type) || []
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/tenants')} style={{marginBottom:20}}>
        <ArrowLeft size={14}/> Back to tenants
      </button>

      <div className="page-header">
        <div>
          <div className="page-title">{tenant.full_name}</div>
          <div className="page-subtitle">
            Room {tenant.rooms?.room_number} · {tenant.occupation} · <span className={`badge badge-${tenant.status==='active'?'green':'gray'}`}>{tenant.status}</span>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{gap:20}}>
        {/* Left column */}
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {/* Contact */}
          <div className="card">
            <p className="section-title">Contact</p>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div style={{display:'flex',alignItems:'center',gap:10,fontSize:13}}>
                <Phone size={14} color="var(--text3)"/>
                <a href={`tel:${tenant.phone}`} style={{color:'var(--text)',textDecoration:'none',fontFamily:'var(--mono)'}}>{tenant.phone}</a>
              </div>
              {tenant.email && <div style={{display:'flex',alignItems:'center',gap:10,fontSize:13}}>
                <Mail size={14} color="var(--text3)"/>
                <a href={`mailto:${tenant.email}`} style={{color:'var(--text)',textDecoration:'none'}}>{tenant.email}</a>
              </div>}
              {tenant.company_or_college && <div style={{display:'flex',alignItems:'center',gap:10,fontSize:13}}>
                <Building size={14} color="var(--text3)"/>
                <span>{tenant.company_or_college}</span>
              </div>}
            </div>
          </div>

          {/* Stay details */}
          <div className="card">
            <p className="section-title">Stay details</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px 16px',fontSize:13}}>
              {[
                ['Check-in', new Date(tenant.check_in_date).toLocaleDateString('en-IN')],
                ['Monthly rent', fmt(tenant.rent_amount)],
                ['Security paid', fmt(tenant.security_deposit_paid)],
                ['Rent due', `${tenant.rent_due_day}th of month`],
                ['Meal plan', tenant.meal_plan],
                ['Expected stay', `${tenant.expected_stay_months} months`],
              ].map(([k,v]) => (
                <div key={k}><div style={{color:'var(--text3)',fontSize:11,marginBottom:2}}>{k}</div><div style={{fontWeight:500}}>{v}</div></div>
              ))}
            </div>
          </div>

          {/* Emergency contact */}
          {tenant.emergency_contact_name && (
            <div className="card">
              <p className="section-title">Emergency contact</p>
              <div style={{fontSize:13}}>
                <div style={{fontWeight:500}}>{tenant.emergency_contact_name}</div>
                <div style={{color:'var(--text2)'}}>{tenant.emergency_contact_relation}</div>
                <div style={{fontFamily:'var(--mono)',marginTop:4}}>{tenant.emergency_contact_phone}</div>
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {/* KYC */}
          <div className="card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <p className="section-title" style={{marginBottom:0}}>KYC documents</p>
              <span className={`badge badge-${tenant.kyc_status==='verified'?'green':tenant.kyc_status==='submitted'?'blue':'yellow'}`}>{tenant.kyc_status}</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {kycDocs.map(doc => {
                const uploaded = uploadedTypes.includes(doc)
                const isUploading = uploading === doc
                return (
                  <div key={doc} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px',background:'var(--bg3)',borderRadius:'var(--radius)'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      {uploaded ? <CheckCircle size={14} color="var(--green)"/> : <div style={{width:14,height:14,borderRadius:'50%',border:'1.5px solid var(--border2)'}}/>}
                      <span style={{fontSize:13,color:uploaded?'var(--text)':'var(--text2)'}}>{doc.replace(/_/g,' ')}</span>
                    </div>
                    {!uploaded && (
                      <label style={{cursor:'pointer'}}>
                        <input type="file" accept="image/*,.pdf" style={{display:'none'}} onChange={e => e.target.files[0] && handleKycUpload(doc, e.target.files[0])} />
                        <span className="btn btn-ghost btn-sm" style={{pointerEvents:'none'}}>
                          {isUploading ? <span className="spinner" style={{width:12,height:12}}/> : <><Upload size={11}/> Upload</>}
                        </span>
                      </label>
                    )}
                    {uploaded && <span style={{fontSize:11,color:'var(--green)'}}>✓ Done</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Rent history */}
          <div className="card">
            <p className="section-title">Rent history</p>
            {ledger.length === 0
              ? <div style={{textAlign:'center',color:'var(--text2)',fontSize:13,padding:'12px 0'}}>No rent entries yet</div>
              : <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {ledger.map(r => (
                    <div key={r.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                      <span style={{fontSize:13}}>{months[r.billing_month-1]} {r.billing_year}</span>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <span style={{fontFamily:'var(--mono)',fontSize:13}}>{fmt(r.total_due)}</span>
                        <span className={`badge badge-${r.payment_status==='paid'?'green':r.payment_status==='overdue'?'red':'yellow'}`}>{r.payment_status}</span>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
      </div>
    </div>
  )
}
