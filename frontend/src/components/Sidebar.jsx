import { supabase } from '../lib/supabase'

const NAV = [
  { key: 'dashboard',   icon: '◈', label: 'Dashboard' },
  { key: 'tenants',     icon: '👥', label: 'Tenants' },
  { key: 'rooms',       icon: '🚪', label: 'Rooms' },
  { key: 'payments',    icon: '₹', label: 'Payments' },
  { key: 'maintenance', icon: '🔧', label: 'Maintenance' },
  { key: 'deeds',       icon: '📄', label: 'Rent Deeds' },
]

export default function Sidebar({ current, onChange, session }) {
  const name = session?.user?.user_metadata?.full_name || session?.user?.email || 'Owner'
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)

  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-dot">B</div>
        <span>Blite PMS</span>
      </div>

      <div className="nav-section">Manage</div>

      {NAV.map(({ key, icon, label }) => (
        <button
          key={key}
          className={`nav-item ${current === key ? 'active' : ''}`}
          onClick={() => onChange(key)}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>{icon}</span>
          {label}
        </button>
      ))}

      <div style={{ flex: 1 }} />

      <div style={{
        borderTop: '1px solid var(--b)', paddingTop: 14, marginTop: 8,
        display: 'flex', alignItems: 'center', gap: 10
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'var(--abg)', color: 'var(--a2)',
          display: 'grid', placeItems: 'center',
          fontSize: 12, fontWeight: 600, flexShrink: 0
        }}>{initials}</div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name}
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: 11, cursor: 'pointer', padding: 0 }}
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}
