export default function DashboardPage() {
  const stats = [
    { label: 'Projects', value: 1 },
    { label: 'Findings (Open)', value: 3 },
    { label: 'Handoffs Pending', value: 1 },
    { label: 'Verifications', value: 0 },
  ];

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 20px' }}>
      <h1>Dashboard</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ padding: 24, borderRadius: 12, background: 'rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{s.value}</div>
            <div style={{ opacity: 0.6, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <section style={{ marginTop: 40 }}>
        <h2>Project Status</h2>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={thStyle}>Domain</th>
              <th style={thStyle}>Track A</th>
              <th style={thStyle}>Track B</th>
              <th style={thStyle}>Last Scan</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>farzadbayat.com</td>
              <td style={tdStyle}><span style={{ color: '#4ade80' }}>✓ Healthy</span></td>
              <td style={tdStyle}><span style={{ color: '#fbbf24' }}>⏳ Pending</span></td>
              <td style={tdStyle}>—</td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  );
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' };
