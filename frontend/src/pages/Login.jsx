import { useState } from 'react'
import { signIn, signUp } from '../lib/supabase'
import { toast } from 'sonner'
import { Building2, Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '' })
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await signIn(form.email, form.password)
        if (error) throw error
      } else {
        const { error } = await signUp(form.email, form.password, form.full_name, form.phone)
        if (error) throw error
        toast.success('Account created! You can now sign in.')
        setMode('login')
      }
    } catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', padding:20 }}>
      <div style={{ position:'fixed', inset:0, zIndex:0, backgroundImage:'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)', backgroundSize:'48px 48px', opacity:0.4 }} />
      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:52, height:52, background:'var(--accent)', borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <Building2 size={26} color="#fff" />
          </div>
          <h1 style={{ fontSize:26, fontWeight:700, letterSpacing:'-0.03em' }}>Blite PMS</h1>
          <p style={{ color:'var(--text2)', marginTop:6, fontSize:14 }}>{mode==='login'?'Sign in to your dashboard':'Create your owner account'}</p>
        </div>
        <div className="card" style={{ padding:28 }}>
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {mode==='signup' && <>
              <div className="field"><label className="label">Full name</label><input className="input" placeholder="Your name" value={form.full_name} onChange={set('full_name')} required /></div>
              <div className="field"><label className="label">Phone</label><input className="input" placeholder="10-digit mobile" value={form.phone} onChange={set('phone')} /></div>
            </>}
            <div className="field"><label className="label">Email</label><input className="input" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required /></div>
            <div className="field">
              <label className="label">Password</label>
              <div style={{ position:'relative' }}>
                <input className="input" type={showPw?'text':'password'} placeholder="••••••••" value={form.password} onChange={set('password')} required style={{ paddingRight:40 }} />
                <button type="button" onClick={()=>setShowPw(p=>!p)} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--text3)', cursor:'pointer' }}>
                  {showPw?<EyeOff size={15}/>:<Eye size={15}/>}
                </button>
              </div>
            </div>
            <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', marginTop:4, padding:'11px 0' }} disabled={loading}>
              {loading?<span className="spinner" style={{ width:16, height:16 }}/>:mode==='login'?'Sign in':'Create account'}
            </button>
          </form>
          <div style={{ textAlign:'center', marginTop:18, fontSize:13, color:'var(--text2)' }}>
            {mode==='login'
              ? <>No account? <button onClick={()=>setMode('signup')} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontFamily:'var(--font)', fontSize:13 }}>Sign up</button></>
              : <>Have account? <button onClick={()=>setMode('login')} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontFamily:'var(--font)', fontSize:13 }}>Sign in</button></>}
          </div>
        </div>
      </div>
    </div>
  )
}
