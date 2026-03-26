import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { toast } from '../utils/toast'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

// Fix default icons in React Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

export default function RedistributionFinder({ session }) {
  const [centre, setCentre] = useState(null)
  const [medicines, setMedicines] = useState([])
  const [selectedMed, setSelectedMed] = useState('')
  const [surplus, setSurplus] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function loadInitial() {
      let center_id = session?.user?.user_metadata?.center_id || session?.user?.app_metadata?.center_id
      if (!center_id && session?.user?.id) {
        const { data: profile } = await supabase.from('user_profiles').select('center_id').eq('id', session.user.id).single()
        center_id = profile?.center_id
      }
      if (!center_id) return

      const { data: pc } = await supabase.from('phc_centers').select('*').eq('id', center_id).single()
      setCentre(pc || null)
      const { data: meds } = await supabase.from('medicines').select('*').order('name')
      setMedicines(meds || [])
    }
    loadInitial()
  }, [session])

  async function findSurplus() {
    if (!selectedMed || !centre) return toast.error('Please select a medicine and ensure your centre ID is valid.')
    setLoading(true)
    const { data, error } = await supabase.rpc('nearest_surplus_phcs', { 
      p_medicine_id: selectedMed, 
      p_lat: centre.latitude, 
      p_lon: centre.longitude, 
      p_radius_km: 50.0 
    })
    if (error) console.error(error)
    if (data) {
      setSurplus(data)
      if (data.length === 0) toast.error('No surplus found for this medicine in nearby centers.')
      else toast.success(`Found ${data.length} centers with surplus stock.`)
    } else {
      // Fallback
      toast.error('RPC failed, loading fallback data (all other centers)...')
      const { data: s } = await supabase.from('phc_centers').select('id,name,latitude,longitude,district').neq('id', centre.id)
      setSurplus(s || [])
    }
    setLoading(false)
  }

  async function requestTransfer(supplyingCenterId) {
    const center_id = centre?.id
    const { error } = await supabase.from('redistribution_requests').insert({
      requesting_center_id: center_id,
      supplying_center_id: supplyingCenterId,
      medicine_id: selectedMed,
      quantity: 1, // hardcoded for MVP, ideally should be an input form per request
      requested_by: session?.user?.id
    })
    if (error) toast.error(error.message)
    else toast.success('Transfer request successfully submitted to District Officer.')
  }

  return (
    <div>
      <div className="mb-6">
        <h1>Redistribution Finder</h1>
        <p style={{ color: 'var(--text-muted)' }}>Locate surplus medicines in nearby PHCs and request transfers.</p>
      </div>

      <div className="flex gap-6">
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="card">
            <h4 className="mb-4">Search Inventory</h4>
            <div className="form-group">
              <label className="form-label">Medicine Needed</label>
              <div className="flex gap-2">
                <select className="form-select" value={selectedMed} onChange={e => setSelectedMed(e.target.value)}>
                  <option value="">Choose medicine...</option>
                  {medicines.map(m => <option value={m.id} key={m.id}>{m.name}</option>)}
                </select>
                <button className="btn btn-primary" onClick={findSurplus} disabled={loading || !selectedMed}>
                  {loading ? 'Searching...' : 'Find Match'}
                </button>
              </div>
            </div>
          </div>

          <div className="card" style={{ flex: 1 }}>
            <h4 className="mb-4">Surplus Centers</h4>
            {surplus.length > 0 ? (
              <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="table">
                  <thead><tr><th>PHC Name</th><th>Distance</th><th>Action</th></tr></thead>
                  <tbody>
                    {surplus.map(s => (
                      <tr key={s.id}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{s.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.district}</div>
                        </td>
                        <td>{s.distance_meters ? `${(s.distance_meters / 1000).toFixed(1)} km` : '-'}</td>
                        <td><button className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }} onClick={() => requestTransfer(s.id)}>Request</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                Select a medicine and search to see results here.
              </div>
            )}
          </div>

        </div>

        <div className="card" style={{ flex: 1.2, height: '600px', padding: 0, overflow: 'hidden' }}>
          {centre ? (
            <MapContainer center={[centre.latitude, centre.longitude]} zoom={8} style={{ height: '100%', width: '100%', zIndex: 10 }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
              
              <Marker position={[centre.latitude, centre.longitude]}>
                <Popup><strong>{centre.name}</strong><br/>Your Location</Popup>
              </Marker>

              {surplus?.map(s => (
                <Marker key={s.id} position={[s.latitude, s.longitude]}>
                  <Popup><strong>{s.name}</strong><br/>{s.distance_meters ? `${(s.distance_meters/1000).toFixed(1)} km away` : 'Surplus Match'}</Popup>
                </Marker>
              ))}
            </MapContainer>
          ) : (
             <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: 'var(--text-muted)' }}>
               Loading Map Data...
             </div>
          )}
        </div>
      </div>
    </div>
  )
}
