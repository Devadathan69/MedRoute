import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { toast } from '../utils/toast'

export default function ManagePHCs() {
  const [phcs, setPhcs] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', district: '', state: '', latitude: '', longitude: '', contact: '', in_charge_name: '' })

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('phc_centers').select('*').order('name')
    setPhcs(data || [])
  }

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    const payload = {
      ...form, 
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude)
    }
    const { error } = await supabase.from('phc_centers').insert(payload)
    if(error) {
      toast.error(error.message)
    } else {
      toast.success('PHC Center registered successfully')
      setForm({ name: '', district: '', state: '', latitude: '', longitude: '', contact: '', in_charge_name: '' })
      load()
    }
    setLoading(false)
  }

  return (
    <div>
      <h1>Manage PHC Centers</h1>
      <div className="flex gap-4">
        <div className="card" style={{ flex: 1, height: 'fit-content' }}>
          <h4>Add New PHC</h4>
          <p className="mb-6" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Register a new PHC facility in the system.</p>
          <form onSubmit={submit}>
            <div className="form-group">
              <label className="form-label">Center Name</label>
              <input className="form-control" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} required placeholder="e.g. Riverside PHC" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">State</label>
                <input className="form-control" value={form.state} onChange={e=>setForm({...form, state: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">District</label>
                <input className="form-control" value={form.district} onChange={e=>setForm({...form, district: e.target.value})} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Latitude</label>
                <input type="number" step="any" className="form-control" value={form.latitude} onChange={e=>setForm({...form, latitude: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Longitude</label>
                <input type="number" step="any" className="form-control" value={form.longitude} onChange={e=>setForm({...form, longitude: e.target.value})} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">In-Charge Name</label>
                <input className="form-control" value={form.in_charge_name} onChange={e=>setForm({...form, in_charge_name: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Contact</label>
                <input className="form-control" value={form.contact} onChange={e=>setForm({...form, contact: e.target.value})} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Registering...' : 'Register PHC'}
            </button>
          </form>
        </div>

        <div className="card" style={{ flex: 2 }}>
          <h4>Registered Centers</h4>
          <div className="table-container mt-4">
            <table className="table">
              <thead>
                <tr>
                  <th>Center Name</th>
                  <th>Location</th>
                  <th>In-Charge</th>
                  <th>Contact</th>
                  <th>Coordinates</th>
                </tr>
              </thead>
              <tbody>
                {phcs.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500, color: 'var(--primary)' }}>{p.name}</td>
                    <td>{p.district}, {p.state}</td>
                    <td>{p.in_charge_name || '-'}</td>
                    <td>{p.contact || '-'}</td>
                    <td style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}</td>
                  </tr>
                ))}
                {phcs.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No PHCs found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
