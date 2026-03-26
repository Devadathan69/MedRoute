import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import StatCard from '../components/StatCard'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function StateAdminDashboard() {
  const [stats, setStats] = useState({ phcs: 0, medicines: 0, flags: 0, transfers: 0 })
  const [chronic, setChronic] = useState([])

  useEffect(() => {
    async function load() {
      const { count: phcs } = await supabase.from('phc_centers').select('*', { count: 'exact', head: true })
      const { count: meds } = await supabase.from('medicines').select('*', { count: 'exact', head: true })
      const { count: flags } = await supabase.from('shortage_flags').select('*', { count: 'exact', head: true }).eq('resolved', false)
      const { count: transfers } = await supabase.from('transfer_logs').select('*', { count: 'exact', head: true })

      setStats({
        phcs: phcs || 0,
        medicines: meds || 0,
        flags: flags || 0,
        transfers: transfers || 0
      })

      // Fetch chronic shortages via RPC
      const { data, error } = await supabase.rpc('phcs_chronic_shortage')
      if (error) console.error(error)
      setChronic(data || [])
    }
    load()
  }, [])

  const chartData = {
    labels: chronic.map(c => c.center_name),
    datasets: [{
      label: 'Unresolved Shortages Last 6 Months',
      data: chronic.map(c => c.flag_count),
      backgroundColor: 'rgba(239, 68, 68, 0.7)',
      borderRadius: 4
    }]
  }

  return (
    <div>
      <h1>State Admin View</h1>
      <p className="mb-6" style={{ color: 'var(--text-muted)' }}>Overview of all PHC centers, medicine registry, and statewide shortages.</p>
      
      <div className="flex gap-4 mb-6">
        <StatCard title="Total PHCs" value={stats.phcs} icon="🏥" color="var(--primary)" />
        <StatCard title="Registered Medicines" value={stats.medicines} icon="💊" color="var(--primary)" />
        <StatCard title="Active Shortage Flags" value={stats.flags} icon="⚠️" color="var(--warning)" />
        <StatCard title="Successful Transfers" value={stats.transfers} icon="🔄" color="var(--success)" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="card">
          <h4>Chronic Shortage Centers</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>Centers with 3 or more frequent shortages over 6 months.</p>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Center ID / Name</th>
                  <th>Flag Count</th>
                </tr>
              </thead>
              <tbody>
                {chronic.map(c => (
                  <tr key={c.center_id}>
                    <td style={{ fontWeight: 500 }}>{c.center_name}</td>
                    <td><span className="badge badge-red">{c.flag_count} alerts</span></td>
                  </tr>
                ))}
                {chronic.length === 0 && <tr><td colSpan="2" style={{ textAlign: 'center', padding: '1rem' }}>No chronic shortages detected.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h4>Shortage Analysis</h4>
          <div style={{ padding: '1rem' }}>
            <Bar data={chartData} options={{ maintainAspectRatio: true, plugins: { legend: { display: false } } }} />
          </div>
        </div>
      </div>
    </div>
  )
}
