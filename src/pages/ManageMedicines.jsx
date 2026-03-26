import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { toast } from '../utils/toast'

export default function ManageMedicines() {
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', category: '', unit: '', min_stock_threshold: '', standard_dosage: '', unit_price: '' })

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('medicines').select('*').order('name')
    setMedicines(data || [])
  }

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    const payload = {
      ...form, 
      min_stock_threshold: parseInt(form.min_stock_threshold, 10),
      unit_price: parseFloat(form.unit_price) || 0
    }
    const { error } = await supabase.from('medicines').insert(payload)
    if(error) {
      toast.error(error.message)
    } else {
      toast.success('Medicine added successfully')
      setForm({ name: '', category: '', unit: '', min_stock_threshold: '', standard_dosage: '', unit_price: '' })
      load()
    }
    setLoading(false)
  }

  return (
    <div>
      <h1>Manage Medicines</h1>
      <div className="flex gap-4">
        <div className="card" style={{ flex: 1, height: 'fit-content' }}>
          <h4>Add New Medicine</h4>
          <p className="mb-6" style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Add a new medicine to the central registry.</p>
          <form onSubmit={submit}>
            <div className="form-group">
              <label className="form-label">Medicine Name</label>
              <input className="form-control" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} required placeholder="e.g. Paracetamol 500mg" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Category</label>
                <input className="form-control" value={form.category} onChange={e=>setForm({...form, category: e.target.value})} placeholder="e.g. Analgesic" />
              </div>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <input className="form-control" value={form.unit} onChange={e=>setForm({...form, unit: e.target.value})} required placeholder="e.g. Tablets" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Min Stock Threshold</label>
                <input type="number" className="form-control" value={form.min_stock_threshold} onChange={e=>setForm({...form, min_stock_threshold: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Unit Price (₹)</label>
                <input type="number" step="0.01" className="form-control" value={form.unit_price} onChange={e=>setForm({...form, unit_price: e.target.value})} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Standard Dosage</label>
              <input className="form-control" value={form.standard_dosage} onChange={e=>setForm({...form, standard_dosage: e.target.value})} placeholder="e.g. 1 tab thrice daily" />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Adding...' : 'Add Medicine'}
            </button>
          </form>
        </div>

        <div className="card" style={{ flex: 2 }}>
          <h4>Medicine Registry</h4>
          <div className="table-container mt-4">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Threshold</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {medicines.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 500 }}>{m.name}</td>
                    <td>{m.category || '-'}</td>
                    <td>{m.unit}</td>
                    <td>{m.min_stock_threshold}</td>
                    <td>₹{m.unit_price}</td>
                  </tr>
                ))}
                {medicines.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No medicines found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
