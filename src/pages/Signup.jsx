import React, { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import { toast } from '../utils/toast'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('phc_staff')
  const [centerId, setCenterId] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }
    const userId = data.user?.id
    if (userId) {
      await supabase.from('user_profiles').insert({ id: userId, email, role, center_id: centerId || null })
    }
    toast.success('Account created! Please log in.')
    navigate('/login')
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ maxWidth: '500px' }}>
        <div className="auth-header">
          <div style={{ fontWeight: 800, fontSize: '2rem', color: 'var(--primary)', letterSpacing: '-0.02em', marginBottom: '1rem' }}>
            Med<span style={{color: 'var(--text-main)'}}>Route</span>
          </div>
          <h2 className="auth-title">Create Account</h2>
          <p className="auth-subtitle">Join the MedRoute network</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input type="email" className="form-control" placeholder="name@example.com" value={email} onChange={e=>setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="form-control" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">System Role</label>
            <select className="form-select" value={role} onChange={e=>setRole(e.target.value)}>
              <option value="phc_staff">PHC Staff</option>
              <option value="district_officer">District Officer</option>
              <option value="state_admin">State Admin</option>
            </select>
          </div>
          {role === 'phc_staff' && (
            <div className="form-group">
              <label className="form-label">Center ID</label>
              <input className="form-control" placeholder="UUID of your PHC" value={centerId} onChange={e=>setCenterId(e.target.value)} required />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Required for PHC staff to link with a specific clinic.</div>
            </div>
          )}
          <button type="submit" className="btn btn-primary mt-4" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.875rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Already have an account? </span>
          <a href="/login" style={{ fontWeight: 600 }}>Sign in</a>
        </div>
      </div>
    </div>
  )
}
