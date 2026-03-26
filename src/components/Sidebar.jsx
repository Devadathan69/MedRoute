import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Sidebar({ session }) {
  const location = useLocation()
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    if(session?.user?.id){
      supabase.from('user_profiles').select('role').eq('id', session.user.id).single().then(({data}) => setProfile(data))
    }
  }, [session])

  const role = profile?.role || 'phc_staff'

  const NavLink = ({ to, label, icon }) => {
    const isActive = location.pathname === to
    return (
      <li style={{ marginBottom: '0.5rem' }}>
        <Link to={to} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-md)',
          color: isActive ? 'var(--primary)' : 'var(--text-muted)',
          background: isActive ? 'var(--primary-light)' : 'transparent',
          fontWeight: isActive ? 600 : 500,
          transition: 'all 0.2s ease',
          textDecoration: 'none'
        }}
        onMouseEnter={(e) => { if(!isActive) { e.currentTarget.style.background = 'var(--bg-color)'; e.currentTarget.style.color = 'var(--text-main)'; } }}
        onMouseLeave={(e) => { if(!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
        >
          {icon && <span>{icon}</span>}
          {label}
        </Link>
      </li>
    )
  }

  return (
    <nav style={{ 
      width: '260px', 
      borderRight: '1px solid var(--border-color)', 
      padding: '1.5rem 1rem', 
      background: 'var(--surface-color)',
      minHeight: 'calc(100vh - 70px)'
    }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', paddingLeft: '1rem' }}>
        Menu
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        <NavLink to="/" label="PHC Dashboard" icon="🏥" />
        
        {role === 'phc_staff' && (
          <>
            <NavLink to="/log-inventory" label="Log Inventory" icon="📦" />
            <NavLink to="/redistribution" label="Request Transfer" icon="🔄" />
          </>
        )}
        
        {/* Approvals now accessible to supplying PHCs and Admins */}
        <NavLink to="/approval" label="Transfer Approvals" icon="✓" />
        
        <NavLink to="/analytics" label="Analytics & Reports" icon="📊" />

        {role === 'state_admin' && (
          <>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2rem', marginBottom: '1rem', paddingLeft: '1rem' }}>
              Administration
            </div>
            <NavLink to="/admin" label="State Admin DB" icon="🌍" />
            <NavLink to="/manage-medicines" label="Manage Medicines" icon="💊" />
            <NavLink to="/manage-phcs" label="Manage PHCs" icon="🏢" />
          </>
        )}
      </ul>
    </nav>
  )
}
