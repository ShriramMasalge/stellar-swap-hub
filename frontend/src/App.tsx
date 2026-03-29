import Dashboard from "./components/Dashboard";

export default function App() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#080c14",
      color: "#f1f5f9",
      fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
    }}>
      {/* Top nav */}
      <nav style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 56,
        background: "rgba(8,12,20,0.95)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 800, color: "#fff",
          }}>S</div>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>Stellar Swap Hub</span>
          <span style={{
            fontSize: 10, background: "rgba(99,102,241,0.2)", color: "#a5b4fc",
            padding: "2px 8px", borderRadius: 999, fontWeight: 600, letterSpacing: "0.05em",
          }}>TESTNET</span>
        </div>

        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          {["Swap", "Contracts", "Docs"].map((item) => (
            <span key={item} style={{ fontSize: 13, color: "#475569", cursor: "pointer" }}>
              {item}
            </span>
          ))}
          <a
            href="https://github.com/YOUR_USERNAME/stellar-swap-hub"
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 12, padding: "6px 14px",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, color: "#94a3b8", textDecoration: "none",
            }}
          >GitHub ↗</a>
        </div>
      </nav>

      {/* Page header */}
      <div style={{
        padding: "32px 32px 24px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>
          Dashboard
        </h1>
        <p style={{ fontSize: 13, color: "#475569", margin: "4px 0 0" }}>
          Live data from Stellar Testnet · Soroban AMM · 3 contracts deployed
        </p>
      </div>

      {/* Main content */}
      <main style={{ padding: "24px 32px 48px" }}>
        <Dashboard />
      </main>
    </div>
  );
}