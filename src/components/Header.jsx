import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Header() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(r => setUser(r.data.session?.user ?? null))
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    async function loadProfile() {
      if (!user) return setProfile(null)
      const { data, error } = await supabase.from('user_profiles').select('*').eq('id', user.id).single()
      if (error) console.error(error)
      setProfile(data)
    }
    loadProfile()
  }, [user])

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
    window.location.href = '/login'
  }

  return (
    <header className="app-header" style={{
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      padding: '1rem 2rem', 
      background: 'var(--surface-color)', 
      borderBottom: '1px solid var(--border-color)',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      <div style={{ fontWeight: 800, fontSize: '1.5rem', color: 'var(--primary)', letterSpacing: '-0.02em' }}>
        Med<span style={{color: 'var(--text-main)'}}>Route</span>
      </div>
      <div>
        {user ? (
          <div className="flex items-center gap-4">
            <div className="header-user-info" style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {profile?.role ? profile.role.replace('_', ' ').toUpperCase() : 'USER'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.email}</span>
            </div>
            <button className="btn btn-secondary" onClick={signOut}>Sign out</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <a href="/login" className="btn btn-secondary">Staff Login</a>
          </div>
        )}
      </div>
    </header>
  )
}
