import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'

import Header from './components/Header'
import Sidebar from './components/Sidebar'
import ToastContainer from './components/ToastContainer'

import Login from './pages/Login'
import Signup from './pages/Signup'
import CitizenPortal from './pages/CitizenPortal'
import PHCDashboard from './pages/PHCDashboard'
import LogInventory from './pages/LogInventory'
import RedistributionFinder from './pages/RedistributionFinder'
import DistrictApproval from './pages/DistrictApproval'
import AnalyticsDashboard from './pages/AnalyticsDashboard'
import StateAdminDashboard from './pages/StateAdminDashboard'
import ManageMedicines from './pages/ManageMedicines'
import ManagePHCs from './pages/ManagePHCs'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const location = useLocation()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if(data.session) fetchProfile(data.session.user.id)
      else setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if(s) fetchProfile(s.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data, error } = await supabase.from('user_profiles').select('*').eq('id', userId).single()
    if (error) console.log('Profile missing or error:', error.message)
    setProfile(data)
    setLoading(false)
  }

  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/public'

  if (loading) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', color: 'var(--text-muted)' }}>Loading...</div>
  }

  // Define Protected Route wrapper
  const ProtectedRoute = ({ children, allowedRoles }) => {
    if (!session) return <Navigate to="/login" replace />
    if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
      return <Navigate to="/" replace />
    }
    return children
  }

  if (isAuthPage) {
    return (
      <>
        <ToastContainer />
        <Routes>
          <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/public" element={<CitizenPortal />} />
        </Routes>
      </>
    )
  }

  return (
    <div className="app-container">
      <ToastContainer />
      <Header />
      <div className="app-body">
        <Sidebar session={session} />
        <main className="main-content">
          <Routes>
            {/* Common / Default */}
            <Route path="/" element={<ProtectedRoute><PHCDashboard session={session} /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><AnalyticsDashboard /></ProtectedRoute>} />

            {/* PHC Staff Features */}
            <Route path="/log-inventory" element={<ProtectedRoute allowedRoles={['phc_staff', 'state_admin']}><LogInventory session={session} /></ProtectedRoute>} />
            <Route path="/redistribution" element={<ProtectedRoute allowedRoles={['phc_staff', 'state_admin']}><RedistributionFinder session={session} /></ProtectedRoute>} />

            {/* Transfer Approvals (District / State / Supplying PHC) */}
            <Route path="/approval" element={<ProtectedRoute allowedRoles={['phc_staff', 'district_officer', 'state_admin']}><DistrictApproval session={session} /></ProtectedRoute>} />

            {/* State Admin Features */}
            <Route path="/admin" element={<ProtectedRoute allowedRoles={['state_admin']}><StateAdminDashboard /></ProtectedRoute>} />
            <Route path="/manage-medicines" element={<ProtectedRoute allowedRoles={['state_admin']}><ManageMedicines /></ProtectedRoute>} />
            <Route path="/manage-phcs" element={<ProtectedRoute allowedRoles={['state_admin']}><ManagePHCs /></ProtectedRoute>} />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
