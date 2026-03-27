import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { supabase } from '../supabaseClient'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default icons
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

// Custom user icon (Red marker)
const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function CitizenPortal() {
  const [searchTerm, setSearchTerm] = useState('')
  const [location, setLocation] = useState(null)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    // Get user location natively via browser
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation([pos.coords.latitude, pos.coords.longitude]),
        (err) => {
          console.error("Location access denied or failed.", err)
          // Default to Kochi, Kerala if blocked so the MVP showcase still functions beautifully
          setLocation([9.9312, 76.2673])
          setErrorMsg("Using default location (Kochi) as location access was blocked by browser.")
        }
      )
    } else {
      setLocation([9.9312, 76.2673])
    }
  }, [])

  async function handleSearch(e) {
    e.preventDefault()
    if (!searchTerm || !location) return
    setLoading(true)
    setErrorMsg('')

    const { data, error } = await supabase.rpc('search_public_medicine', {
      search_term: searchTerm.trim(),
      user_lat: location[0],
      user_lon: location[1]
    })

    if (error) {
      setErrorMsg('Failed to search database.')
      console.error(error)
    } else {
      setResults(data || [])
      if (data && data.length === 0) {
        setErrorMsg('No nearby centers found with this medicine currently in stock.')
      }
    }
    setLoading(false)
  }

  function getGoogleMapsUrl(phcLat, phcLon) {
    if (!location) return '#'
    // Directs standard routing payload to GMaps natively linking origin to destination
    return `https://www.google.com/maps/dir/?api=1&origin=${location[0]},${location[1]}&destination=${phcLat},${phcLon}`
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-primary)' }}>
      <header className="citizen-header" style={{ padding: '1.5rem 2rem', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100 }}>
        <div style={{ fontWeight: 800, fontSize: '1.5rem', color: 'var(--primary)', letterSpacing: '-0.02em' }}>
          Med<span style={{color: 'var(--text-main)'}}>Route</span> <span style={{fontSize:'1rem', color:'#64748b', fontWeight:400, marginLeft:'8px'}}>| Citizen Portal</span>
        </div>
        <a href="/login" className="btn btn-secondary" style={{ background: '#f1f5f9', color: '#0f172a' }}>Staff Login</a>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '2rem', background: 'var(--surface-color)', zIndex: 20, boxShadow: '0 4px 12px -2px rgb(0 0 0 / 0.1)' }}>
          <h1 style={{ marginBottom: '0.5rem', fontSize:'2rem' }}>Find Essential Medicines Near You</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize:'1.1rem' }}>Instantly locate primary health centers carrying the life-saving supplies you need.</p>
          
          <form onSubmit={handleSearch} className="citizen-search-box" style={{ display: 'flex', gap: '1rem', maxWidth: '700px' }}>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. Paracetamol, Insulin, Amoxicillin..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              required 
              style={{ flex: 1, padding: '0.8rem 1.25rem', fontSize: '1.1rem', borderRadius: '8px' }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0.8rem 2.5rem', fontSize: '1.1rem', borderRadius: '8px' }} disabled={loading || !location}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
          {errorMsg && <div style={{ color: 'var(--danger)', marginTop: '1rem', fontSize: '0.9rem', fontWeight: 500 }}>{errorMsg}</div>}
        </div>

        <div className="portal-layout">
          {/* Sidebar Navigation Results */}
          <div className="portal-sidebar" style={{ display: results.length > 0 ? 'block' : 'none' }}>
            <div style={{ padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', color: 'var(--text-main)' }}>Nearest Matches</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {results.map((r, i) => (
                  <div key={r.center_id} className="card" style={{ padding: '1.25rem', cursor: 'pointer', borderLeft: i === 0 ? '4px solid var(--primary)' : '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontWeight: 600, fontSize: '1.15rem', marginBottom: '4px', color: 'var(--text-main)' }}>{r.center_name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>{r.district}, {r.state}</div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <span className={`badge ${r.stock_status === 'High Stock' ? 'badge-green' : r.stock_status === 'Adequate' ? 'badge-blue' : 'badge-amber'}`} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                        {r.stock_status}
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{r.distance_km.toFixed(1)} km away</span>
                    </div>

                    <a 
                      href={getGoogleMapsUrl(r.latitude, r.longitude)} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn btn-primary" 
                      style={{ width: '100%', textAlign: 'center', display: 'block', padding: '0.6rem', background: '#2563eb', border: 'none', borderRadius: '6px' }}
                    >
                      📍 Get Directions & ETA
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Map Layer Rendering */}
          <div className="portal-map">
            {location ? (
              <MapContainer center={location} zoom={11} style={{ height: '100%', width: '100%' }}>
                {/* Esri World Imagery (Stunning Satellite Map Output) */}
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                />
                
                {/* User Location Marker */}
                <Marker position={location} icon={userIcon}>
                  <Popup><strong>You are here</strong></Popup>
                </Marker>

                {/* PHC Destination Markers */}
                {results.map(r => (
                  <Marker key={r.center_id} position={[r.latitude, r.longitude]}>
                    <Popup>
                      <strong style={{ fontSize: '1rem' }}>{r.center_name}</strong><br/>
                      <span style={{ color: '#64748b' }}>{r.distance_km.toFixed(1)} km away</span><br/>
                      <span style={{ color: '#059669', fontWeight: 600, display: 'inline-block', margin: '4px 0' }}>{r.stock_status}</span><br/>
                      <a href={getGoogleMapsUrl(r.latitude, r.longitude)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '4px', color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
                        Get Directions ↗
                      </a>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Acquiring your location...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
