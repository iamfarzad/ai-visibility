export const metadata = {
  title: 'AI Visibility — Autonomous SEO Remediation',
  description: 'Monitor, detect, fix, and verify — safely through GitHub PRs and CMS drafts',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0a0a0a', color: '#e4e4e4' }}>
        {children}
      </body>
    </html>
  );
}
