import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  LayoutDashboard, Users, DoorOpen, IndianRupee,
  Wrench, FileText, LogOut, Menu, X, Building2
} from 'lucide-react'

const nav = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard',   end: true },
  { to: '/tenants',    icon: Users,           label: 'Tenants' },
  { to: '/rooms',      icon: DoorOpen,        label: 'Rooms' },
  { to: '/payments',   icon: IndianRupee,     label: 'Payments' },
  { to: '/maintenance',icon: Wrench,          label: 'Maintenance' },
  { to: '/deeds',      icon: FileText,        label: 'Rent Deeds' },
]

export default function Layout({ session }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Mobile overlay */}
      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40, display: 'none' }}
          className="mobile-overlay"
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width: 220, flexShrink: 0, background: 'var(--bg2)',
        borderRight: '1px solid var(--border)', display: 'flex',
        flexDirection: 'column', padding: '20px 12px',
        height: '100vh', overflowY: 'auto'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px', marginBottom: 32 }}>
          <div style={{
            width: 34, height: 34, background: 'var(--accent)',
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Building2 size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>Blite</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>PMS</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {nav.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end} style={{ textDecoration: 'none' }}>
              {({ isActive }) => (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 10px', borderRadius: 'var(--radius)',
                  background: isActive ? 'var(--accent-bg)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text2)',
                  fontSize: 14, fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.15s', cursor: 'pointer',
                }}>
                  <Icon size={16} />
                  {label}
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
          <div style={{ padding: '6px 10px', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
              {session?.user?.user_metadata?.full_name || 'Owner'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 2 }}>
              {session?.user?.email}
            </div>
          </div>
          <button onClick={handleSignOut} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', padding: '28px 32px', background: 'var(--bg)' }}>
        <Outlet />
      </main>
    </div>
  )
}
