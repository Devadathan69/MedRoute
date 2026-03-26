import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { toast } from '../utils/toast'
import { format } from 'date-fns'

export default function LogInventory({ session }) {
  const [medicines, setMedicines] = useState([])
  const [inventory, setInventory] = useState([])
  const [form, setForm] = useState({ medicine_id: '', quantity: '', batch_number: '', expiry_date: '' })
  const [loading, setLoading] = useState(false)
  const [centerId, setCenterId] = useState(null)

  async function loadData() {
    // 1. Resolve Center ID
    let cid = session?.user?.user_metadata?.center_id || session?.user?.app_metadata?.center_id
    if (!cid && session?.user?.id) {
      const { data: profile } = await supabase.from('user_profiles').select('center_id').eq('id', session.user.id).single()
      cid = profile?.center_id
    }
    setCenterId(cid)

    // 2. Fetch Medicines for Dropdown
    const { data: meds } = await supabase.from('medicines').select('*').order('name')
    setMedicines(meds || [])

    // 3. Fetch Current Inventory for this Center
    if (cid) {
      const { data: inv } = await supabase.from('inventory')
        .select('id, quantity_available, batch_number, expiry_date, medicine:medicine_id(name, unit, category)')
        .eq('center_id', cid)
        .order('expiry_date', { ascending: true })
      setInventory(inv || [])
    }
  }

  useEffect(() => {
    loadData()
  }, [session])

  async function submit(e) {
    e.preventDefault()
    setLoading(true)

    if (!centerId) {
      setLoading(false)
      return toast.error('No center verified in session. Profile might be lacking center_id.')
    }

    const payload = {
      center_id: centerId,
      medicine_id: form.medicine_id,
      quantity_available: parseInt(form.quantity, 10),
      batch_number: form.batch_number || null,
      expiry_date: form.expiry_date
    }
    
    const { error } = await supabase.from('inventory').upsert(payload, { onConflict: 'center_id, medicine_id, batch_number' })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Inventory logged/updated successfully')
      setForm({ medicine_id: '', quantity: '', batch_number: '', expiry_date: '' })
      await loadData() // Refresh inventory table
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h1>Log & View Inventory</h1>
      <p className="mb-6" style={{ color: 'var(--text-muted)' }}>Add new stock shipments or oversee the current availability of medicines in your PHC.</p>
      
      <div className="flex gap-6 wrap" style={{ flexDirection: 'column' }}>
        
        {/* Left/Top side: Input Form */}
        <form onSubmit={submit} className="card" style={{ width: '100%' }}>
          <h4 className="mb-4">Add New Shipment</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Medicine</label>
              <select className="form-select" value={form.medicine_id} onChange={e=>setForm({...form, medicine_id: e.target.value})} required>
                <option value="" disabled>Select a medicine...</option>
                {medicines.map(m => <option value={m.id} key={m.id}>{m.name} ({m.unit})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Quantity Received (+)</label>
              <input type="number" className="form-control" placeholder="Enter amount" value={form.quantity} onChange={e=>setForm({...form, quantity:e.target.value})} required min="1" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="form-group">
              <label className="form-label">Batch Number (Optional)</label>
              <input className="form-control" placeholder="Supplier batch code" value={form.batch_number} onChange={e=>setForm({...form, batch_number:e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Expiry Date</label>
              <input type="date" className="form-control" value={form.expiry_date} onChange={e=>setForm({...form, expiry_date:e.target.value})} required />
            </div>
          </div>

          <div className="mt-4 flex justify-between items-center border-t" style={{ borderColor: 'var(--border-color)', paddingTop: '1.5rem' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Ensure expiry date is accurate as it automatically triggers system alerts.</span>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Inventory'}
            </button>
          </div>
        </form>

        {/* Right/Bottom side: Current Inventory View */}
        <div className="card" style={{ width: '100%' }}>
          <h4 className="mb-4">Current Available Stock</h4>
          
          {inventory.length > 0 ? (
            <div className="table-container" style={{ maxHeight: '450px', overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Category</th>
                    <th>Batch #</th>
                    <th>Quantity Available</th>
                    <th>Expiry Date</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map(item => {
                    const isExpiring = new Date(item.expiry_date) <= new Date(new Date().setDate(new Date().getDate() + 30))
                    return (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 600 }}>{item.medicine?.name}</td>
                        <td>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-color)', padding: '2px 8px', borderRadius: '4px' }}>
                            {item.medicine?.category}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{item.batch_number || 'N/A'}</td>
                        <td>
                          <span className="badge badge-blue" style={{ fontSize: '0.85rem' }}>
                            {item.quantity_available} {item.medicine?.unit}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: isExpiring ? 'var(--danger)' : 'var(--text-main)', fontWeight: isExpiring ? 600 : 400 }}>
                            {format(new Date(item.expiry_date), 'MMM dd, yyyy')}
                            {isExpiring && <span style={{display:'block', fontSize:'0.7rem'}}>Expiring soon!</span>}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
              No medicines currently stocked in this PHC.
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
