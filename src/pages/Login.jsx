import React, { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import { toast } from '../utils/toast'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }
    toast.success('Logged in successfully')
    navigate('/')
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <div style={{ fontWeight: 800, fontSize: '2rem', color: 'var(--primary)', letterSpacing: '-0.02em', marginBottom: '1rem' }}>
            Med<span style={{color: 'var(--text-main)'}}>Route</span>
          </div>
          <h2 className="auth-title">Welcome Back</h2>
          <p className="auth-subtitle">Sign in to access your dashboard</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input type="email" className="form-control" placeholder="name@example.com" value={email} onChange={e=>setEmail(e.target.value)} required />
          </div>
          <div className="form-group mb-6">
            <label className="form-label">Password</label>
            <input type="password" className="form-control" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '1rem' }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={()=>{
            supabase.auth.signInWithOtp({email}).then(()=>toast.success('Check email for magic link')).catch(e => toast.error(e.message))
          }}>
            Send Magic Link
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.875rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Don't have an account? </span>
          <a href="/signup" style={{ fontWeight: 600 }}>Sign up</a>
        </div>
      </div>
    </div>
  )
}
