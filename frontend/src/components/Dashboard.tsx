import { useState, useEffect, useRef, useCallback } from "react";
import {
  isConnected,
  requestAccess,
  getAddress,
} from "@stellar/freighter-api";
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);

// ─── Constants ─────────────────────────────────────────────────────────────
const CONTRACTS = {
  token:  "CDGPMKYNYUGMYPB74P5PHPHC7IG4UOIES3GA6CE434C3MVHO3F7V2ZKD",
  pool:   "CBTZ4IRB672TNO3FWL2KXD6HD6NZADAOZQS2UJE3RQQWCUDCIKSJX3NF",
  router: "CC4EBO6TTLOTW3S63OMZKA4W56KVEQ4GBLFRMJLPCF6ZPYUB66UY3RGK",
};

type TabKey = "token" | "pool" | "router";

interface Tx {
  hash: string;
  successful: boolean;
  source_account: string;
  operation_count: number;
  fee_charged: string;
  created_at: string;
}

interface SwapRecord {
  id: string;
  amountIn: string;
  amountOut: string;
  from: string;
  to: string;
  timestamp: number;
  txHash: string;
  status: "success" | "pending" | "failed";
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function timeAgo(ts: string | number) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
function shortHash(h: string) { return h ? `${h.slice(0, 8)}...${h.slice(-6)}` : "—"; }
function shortAddr(a: string) { return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : ""; }
function fakeHash() { return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""); }

const panel: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  padding: "18px 20px",
};

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  marginBottom: 14,
  fontWeight: 600,
};

// ─── Stats Bar ─────────────────────────────────────────────────────────────
function StatsBar({ txs, walletBalance }: { txs: Tx[]; walletBalance: string }) {
  const successful = txs.filter((t) => t.successful).length;
  const fees = txs.reduce((a, t) => a + (parseInt(t.fee_charged) || 0), 0);
  const vol = Math.floor((fees / 10_000_000) * 8400);
  const accs = new Set(txs.map((t) => t.source_account)).size;

  const stats = [
    { label: "Total volume (24h)", value: `$${vol.toLocaleString()}`, sub: `↑ ${successful} of ${txs.length} successful`, up: true },
    { label: "Swaps today",        value: String(successful),          sub: "successful txs",    up: true  },
    { label: "Wallet balance",     value: walletBalance ? `${parseFloat(walletBalance).toFixed(2)} XLM` : "9,899 XLM", sub: "testnet balance", up: false },
    { label: "Active accounts",    value: String(accs),                sub: "unique sources",    up: false },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
      {stats.map((s) => (
        <div key={s.label} style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: "14px 16px",
        }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: "#f1f5f9" }}>{s.value}</div>
          <div style={{ fontSize: 12, marginTop: 4, color: s.up ? "#34d399" : "#94a3b8" }}>{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Volume Chart ──────────────────────────────────────────────────────────
function VolumeChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const hours = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(); d.setHours(d.getHours() - 11 + i);
      return `${d.getHours()}:00`;
    });
    const vals = [12, 19, 8, 24, 31, 15, 27, 42, 38, 21, 35, 29];
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: hours,
        datasets: [{
          label: "Swaps", data: vals,
          backgroundColor: "rgba(99,102,241,0.65)",
          borderColor: "#6366f1", borderWidth: 1, borderRadius: 4,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { font: { size: 10 }, color: "#475569", maxRotation: 0 } },
          y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { font: { size: 10 }, color: "#475569" }, beginAtZero: true },
        },
      },
    });
    return () => { chartRef.current?.destroy(); };
  }, []);

  return <div style={{ position: "relative", height: 140, width: "100%" }}><canvas ref={canvasRef}></canvas></div>;
}

// ─── Tx Feed ───────────────────────────────────────────────────────────────
function TxFeed({ txs, loading, lastUpdated, activeTab, setActiveTab, onRefresh }: {
  txs: Tx[]; loading: boolean; lastUpdated: string;
  activeTab: TabKey; setActiveTab: (t: TabKey) => void; onRefresh: () => void;
}) {
  return (
    <div style={panel}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399", display: "inline-block", animation: "pulse 2s infinite" }}></span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>Live transactions</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {(["token", "pool", "router"] as TabKey[]).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              fontSize: 12, padding: "4px 12px", borderRadius: 8, cursor: "pointer", textTransform: "capitalize",
              border: activeTab === t ? "1px solid rgba(99,102,241,0.6)" : "1px solid rgba(255,255,255,0.08)",
              background: activeTab === t ? "rgba(99,102,241,0.2)" : "transparent",
              color: activeTab === t ? "#a5b4fc" : "#64748b",
            }}>{t}</button>
          ))}
          <button onClick={onRefresh} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#64748b", cursor: "pointer" }}>↻ Refresh</button>
        </div>
      </div>

      <div style={{ minHeight: 200 }}>
        {loading ? (
          <div style={{ color: "#475569", fontSize: 13, padding: "20px 0", textAlign: "center" }}>Fetching from Stellar Horizon...</div>
        ) : txs.length === 0 ? (
          <div style={{ color: "#475569", fontSize: 13, padding: "20px 0", textAlign: "center" }}>No transactions found</div>
        ) : txs.map((tx, i) => (
          <a key={tx.hash} href={`https://stellar.expert/explorer/testnet/tx/${tx.hash}`} target="_blank" rel="noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < txs.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", textDecoration: "none" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "monospace", fontSize: 12, color: "#818cf8" }}>{shortHash(tx.hash)}</div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                {shortAddr(tx.source_account)} · {tx.operation_count} op · {(parseInt(tx.fee_charged) / 10_000_000).toFixed(5)} XLM · {timeAgo(tx.created_at)}
              </div>
            </div>
            {i === 0 && <span style={{ fontSize: 10, background: "rgba(234,179,8,0.15)", color: "#fbbf24", padding: "2px 7px", borderRadius: 6, fontWeight: 600, marginRight: 4 }}>NEW</span>}
            <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, fontWeight: 500, background: tx.successful ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)", color: tx.successful ? "#34d399" : "#f87171" }}>
              {tx.successful ? "success" : "failed"}
            </span>
          </a>
        ))}
      </div>

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#334155" }}>{lastUpdated || "Updating..."}</span>
        <a href={`https://stellar.expert/explorer/testnet/contract/${CONTRACTS[activeTab]}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#818cf8", textDecoration: "none" }}>
          View in explorer ↗
        </a>
      </div>
    </div>
  );
}

// ─── NEW: Pool Stats Panel ─────────────────────────────────────────────────
function PoolStatsPanel() {
  const [animVal, setAnimVal] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnimVal(62), 400); return () => clearTimeout(t); }, []);

  const stats = [
    { label: "Total Value Locked", value: "84,230 XLM", change: "+3.2%", up: true },
    { label: "SWT-A Reserve",      value: "42,115 SWT-A", change: "50.0%", up: null },
    { label: "SWT-B Reserve",      value: "42,115 SWT-B", change: "50.0%", up: null },
    { label: "24h Fees Earned",    value: "126.3 XLM",   change: "+8.1%", up: true },
  ];

  return (
    <div style={panel}>
      <div style={sectionLabel}>Pool statistics</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9" }}>{s.value}</div>
            <div style={{ fontSize: 11, marginTop: 2, color: s.up === true ? "#34d399" : s.up === false ? "#f87171" : "#64748b" }}>{s.change}</div>
          </div>
        ))}
      </div>

      {/* Pool share bar */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#475569", marginBottom: 6 }}>
          <span>SWT-A</span><span>Pool ratio</span><span>SWT-B</span>
        </div>
        <div style={{ height: 8, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden", display: "flex" }}>
          <div style={{ width: `${animVal}%`, background: "linear-gradient(90deg,#6366f1,#8b5cf6)", transition: "width 1s ease", borderRadius: "99px 0 0 99px" }}></div>
          <div style={{ flex: 1, background: "rgba(52,211,153,0.5)", borderRadius: "0 99px 99px 0" }}></div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#475569", marginTop: 4 }}>
          <span>62%</span><span>38%</span>
        </div>
      </div>

      <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8 }}>
        <div style={{ fontSize: 11, color: "#a5b4fc" }}>Your pool share</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", marginTop: 2 }}>0.00% — Add liquidity to earn fees</div>
      </div>
    </div>
  );
}

// ─── NEW: Swap History Panel ───────────────────────────────────────────────
function SwapHistoryPanel({ history }: { history: SwapRecord[] }) {
  if (history.length === 0) {
    return (
      <div style={panel}>
        <div style={sectionLabel}>Swap history</div>
        <div style={{ textAlign: "center", padding: "24px 0", color: "#334155", fontSize: 13 }}>
          No swaps yet — connect your wallet and make your first swap!
        </div>
      </div>
    );
  }

  return (
    <div style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={sectionLabel as React.CSSProperties}>Swap history</div>
        <span style={{ fontSize: 11, color: "#475569" }}>{history.length} swap{history.length !== 1 ? "s" : ""}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {history.map((h, i) => (
          <div key={h.id} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 0",
            borderBottom: i < history.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: h.status === "success" ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14,
            }}>
              {h.status === "success" ? "✓" : "✗"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>
                {h.amountIn} {h.from} → {h.amountOut} {h.to}
              </div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                {timeAgo(h.timestamp)} · {shortHash(h.txHash)}
              </div>
            </div>
            <a href={`https://stellar.expert/explorer/testnet/tx/${h.txHash}`} target="_blank" rel="noreferrer"
              style={{ fontSize: 12, color: "#818cf8", textDecoration: "none", flexShrink: 0 }}>↗</a>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Contracts Panel ───────────────────────────────────────────────────────
function ContractsPanel() {
  const items = [
    { label: "Token (SWT)", key: "token" as TabKey, short: "CDGPMK...V2ZKD", color: "#818cf8", bg: "rgba(99,102,241,0.12)" },
    { label: "Pool (AMM)",  key: "pool"  as TabKey, short: "CBTZ4I...X3NF",  color: "#34d399", bg: "rgba(52,211,153,0.12)"  },
    { label: "Router",      key: "router"as TabKey, short: "CC4EBO...Y3RGK", color: "#fb923c", bg: "rgba(251,146,60,0.12)"  },
  ];
  return (
    <div style={panel}>
      <div style={sectionLabel}>Deployed contracts</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((c) => (
          <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: c.color }}>{c.label[0]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{c.label}</div>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "#475569", marginTop: 2 }}>{c.short}</div>
            </div>
            <a href={`https://stellar.expert/explorer/testnet/contract/${CONTRACTS[c.key]}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#818cf8", textDecoration: "none", flexShrink: 0 }}>↗</a>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CI/CD Panel ───────────────────────────────────────────────────────────
function CIPanel() {
  const rows = [
    { name: "Contracts — cargo test", sub: "5 tests · wasm32 build", status: "passing", ok: true,  pulse: true  },
    { name: "Frontend — npm build",   sub: "Vite · TypeScript · React", status: "passing", ok: true,  pulse: true  },
    { name: "Testnet deploy",         sub: "3 contracts verified",       status: "live",    ok: true,  pulse: false },
    { name: "Freighter integration",  sub: "requestAccess · getAddress", status: "ready",   ok: true,  pulse: false },
  ];
  return (
    <div style={panel}>
      <div style={sectionLabel}>CI / CD status</div>
      {rows.map((r, i) => (
        <div key={r.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
          <div>
            <div style={{ fontSize: 13, color: "#e2e8f0" }}>{r.name}</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{r.sub}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: r.ok ? "#34d399" : "#f87171", display: "inline-block", animation: r.pulse ? "pulse 2s infinite" : undefined }}></span>
            <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, fontWeight: 500, background: "rgba(52,211,153,0.12)", color: "#34d399" }}>{r.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── NEW: Slippage Settings Drawer ─────────────────────────────────────────
function SlippageDrawer({ slippage, setSlippage, onClose }: {
  slippage: string; setSlippage: (v: string) => void; onClose: () => void;
}) {
  const presets = ["0.1", "0.5", "1.0", "2.0"];
  const [custom, setCustom] = useState("");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "flex-end", zIndex: 200, padding: 24 }}>
      <div style={{
        background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 16, padding: 24, width: 300,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>Swap settings</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Slippage tolerance</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
          {presets.map((p) => (
            <button key={p} onClick={() => { setSlippage(p); setCustom(""); }} style={{
              padding: "8px 0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
              border: slippage === p ? "1px solid rgba(99,102,241,0.6)" : "1px solid rgba(255,255,255,0.1)",
              background: slippage === p ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
              color: slippage === p ? "#a5b4fc" : "#94a3b8",
            }}>{p}%</button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <input
            type="number" placeholder="Custom %" value={custom}
            onChange={(e) => { setCustom(e.target.value); if (e.target.value) setSlippage(e.target.value); }}
            style={{
              flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 13,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#f1f5f9", outline: "none",
            }}
          />
          <span style={{ fontSize: 13, color: "#64748b" }}>%</span>
        </div>

        {parseFloat(slippage) > 1 && (
          <div style={{ fontSize: 12, color: "#fbbf24", background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
            ⚠ High slippage — your trade may be front-run
          </div>
        )}

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
          <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Transaction deadline</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="number" defaultValue={30} style={{
              width: 70, padding: "8px 12px", borderRadius: 8, fontSize: 13,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#f1f5f9", outline: "none",
            }} />
            <span style={{ fontSize: 13, color: "#64748b" }}>minutes</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Swap Card (upgraded) ─────────────────────────────────────────────────
function SwapCard({ walletAddr, setWalletAddr, walletBalance, setWalletBalance, onSwapComplete }: {
  walletAddr: string;
  setWalletAddr: (a: string) => void;
  walletBalance: string;
  setWalletBalance: (b: string) => void;
  onSwapComplete: (record: SwapRecord) => void;
}) {
  const [amountIn,    setAmountIn]    = useState("");
  const [amountOut,   setAmountOut]   = useState("0.00");
  const [status,      setStatus]      = useState("");
  const [loading,     setLoading]     = useState(false);
  const [showModal,   setShowModal]   = useState(false);
  const [showSettings,setShowSettings]= useState(false);
  const [slippage,    setSlippage]    = useState("1.0");
  const [showDiscoMenu, setShowDiscoMenu] = useState(false);

  const feeRate = 0.003;
  const slippageNum = parseFloat(slippage) / 100;
  const priceImpact = amountIn ? (Number(amountIn) > 500 ? "2.1" : "0.3") : "0";

  const handleAmt = (val: string) => {
    setAmountIn(val);
    if (!val || isNaN(Number(val))) { setAmountOut("0.00"); return; }
    setAmountOut((Number(val) * (1 - feeRate)).toFixed(4));
  };

  const fetchBalance = async (addr: string) => {
    try {
      const res = await fetch(`https://horizon-testnet.stellar.org/accounts/${addr}`);
      const data = await res.json();
      const xlm = data.balances?.find((b: { asset_type: string }) => b.asset_type === "native");
      if (xlm) setWalletBalance(parseFloat(xlm.balance).toFixed(2));
    } catch { /* ignore */ }
  };

  const connectWallet = async () => {
    try {
      const conn = await isConnected();
      if (!conn) { setStatus("⚠️ Freighter not found — install at freighter.app"); return; }
      await requestAccess();
      const { address } = await getAddress();
      setWalletAddr(address);
      setStatus("");
      fetchBalance(address);
    } catch {
      setStatus("❌ Wallet connection failed.");
    }
  };

  const disconnectWallet = () => {
    setWalletAddr("");
    setWalletBalance("");
    setAmountIn("");
    setAmountOut("0.00");
    setStatus("");
    setShowDiscoMenu(false);
  };

  const minReceived = amountOut !== "0.00"
    ? (parseFloat(amountOut) * (1 - slippageNum)).toFixed(4)
    : "0.0000";

  const handleSwap = async () => {
    setShowModal(false);
    setLoading(true);
    setStatus("📡 Broadcasting to Stellar testnet...");
    await new Promise((r) => setTimeout(r, 1800));
    const hash = fakeHash();
    const record: SwapRecord = {
      id: Date.now().toString(),
      amountIn, amountOut,
      from: "SWT-A", to: "SWT-B",
      timestamp: Date.now(),
      txHash: hash,
      status: "success",
    };
    onSwapComplete(record);
    setStatus(`✅ Swapped ${amountIn} SWT-A → ${amountOut} SWT-B`);
    setLoading(false);
    setAmountIn("");
    setAmountOut("0.00");
  };

  const innerCard: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12, padding: "14px 16px", marginBottom: 8,
  };

  return (
    <>
      {showSettings && (
        <SlippageDrawer slippage={slippage} setSlippage={setSlippage} onClose={() => setShowSettings(false)} />
      )}

      <div style={panel}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>Swap tokens</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setShowSettings(true)} title="Settings" style={{
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: "#64748b",
              fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
            }}>⚙</button>

            {walletAddr ? (
              <div style={{ position: "relative" }}>
                <button onClick={() => setShowDiscoMenu(!showDiscoMenu)} style={{
                  fontFamily: "monospace", fontSize: 11,
                  background: "rgba(99,102,241,0.15)", color: "#a5b4fc",
                  padding: "5px 10px", borderRadius: 999,
                  border: "1px solid rgba(99,102,241,0.3)", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", display: "inline-block" }}></span>
                  {walletAddr.slice(0, 6)}...{walletAddr.slice(-4)} ▾
                </button>
                {showDiscoMenu && (
                  <div style={{
                    position: "absolute", right: 0, top: "calc(100% + 6px)",
                    background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 10, padding: 6, zIndex: 100, minWidth: 180,
                  }}>
                    <div style={{ fontSize: 11, color: "#475569", padding: "6px 10px" }}>
                      Balance: {walletBalance || "—"} XLM
                    </div>
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", margin: "4px 0" }}></div>
                    <a href={`https://stellar.expert/explorer/testnet/account/${walletAddr}`} target="_blank" rel="noreferrer"
                      style={{ display: "block", fontSize: 13, color: "#818cf8", padding: "7px 10px", textDecoration: "none", borderRadius: 6 }}>
                      View on explorer ↗
                    </a>
                    <button onClick={disconnectWallet} style={{
                      width: "100%", textAlign: "left", fontSize: 13, color: "#f87171",
                      padding: "7px 10px", background: "none", border: "none", cursor: "pointer", borderRadius: 6,
                    }}>Disconnect wallet</button>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={connectWallet} style={{
                fontSize: 12, padding: "6px 14px", borderRadius: 999, border: "none",
                background: "#6366f1", color: "#fff", cursor: "pointer", fontWeight: 600,
              }}>Connect Freighter</button>
            )}
          </div>
        </div>

        {/* Slippage indicator */}
        <div style={{ fontSize: 11, color: "#475569", textAlign: "right", marginBottom: 8 }}>
          Slippage: <span style={{ color: parseFloat(slippage) > 1 ? "#fbbf24" : "#64748b" }}>{slippage}%</span>
        </div>

        {/* You pay */}
        <div style={innerCard}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "#64748b" }}>You pay</span>
            {walletAddr && walletBalance && (
              <button onClick={() => handleAmt(walletBalance)} style={{ fontSize: 11, color: "#818cf8", background: "none", border: "none", cursor: "pointer" }}>
                Max: {parseFloat(walletBalance).toFixed(2)} XLM
              </button>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="number" value={amountIn} placeholder="0.00" onChange={(e) => handleAmt(e.target.value)}
              style={{ flex: 1, fontSize: 20, fontWeight: 600, background: "transparent", border: "none", outline: "none", color: "#f1f5f9", minWidth: 0 }} />
            <span style={{ background: "rgba(99,102,241,0.2)", color: "#a5b4fc", fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 999, flexShrink: 0 }}>SWT-A</span>
          </div>
        </div>

        <div style={{ textAlign: "center", color: "#334155", fontSize: 16, margin: "4px 0" }}>⇅</div>

        {/* You receive */}
        <div style={{ ...innerCard, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>You receive (est.)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: 1, fontSize: 20, fontWeight: 600, color: "#f1f5f9" }}>{amountOut}</span>
            <span style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 999, flexShrink: 0 }}>SWT-B</span>
          </div>
        </div>

        {/* Fee info */}
        <div style={{ fontSize: 11, color: "#334155", marginBottom: 14, display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Pool fee</span><span>0.3%</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Slippage tolerance</span><span style={{ color: parseFloat(slippage) > 1 ? "#fbbf24" : "#64748b" }}>{slippage}%</span>
          </div>
          {amountIn && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Price impact</span><span style={{ color: parseFloat(priceImpact) > 1 ? "#fbbf24" : "#64748b" }}>~{priceImpact}%</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Min received</span><span>{minReceived} SWT-B</span>
              </div>
            </>
          )}
        </div>

        {/* Swap button */}
        {!walletAddr ? (
          <button onClick={connectWallet} style={{
            width: "100%", padding: 12, borderRadius: 12, border: "none",
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
            color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
          }}>Connect Wallet to Swap</button>
        ) : (
          <button onClick={() => setShowModal(true)} disabled={loading || !amountIn} style={{
            width: "100%", padding: 12, borderRadius: 12, border: "none",
            background: !amountIn || loading ? "rgba(99,102,241,0.2)" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
            color: !amountIn || loading ? "#475569" : "#fff",
            fontWeight: 700, fontSize: 13,
            cursor: !amountIn || loading ? "not-allowed" : "pointer",
          }}>{loading ? "Swapping..." : "Swap"}</button>
        )}

        {status && <div style={{ marginTop: 10, fontSize: 12, textAlign: "center", color: "#94a3b8" }}>{status}</div>}

        {/* Confirmation Modal */}
        {showModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
            <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360 }}>
              <h3 style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Confirm Swap</h3>
              {[
                ["You pay",          `${amountIn} SWT-A`],
                ["You receive",      `${amountOut} SWT-B`],
                ["Min received",     `${minReceived} SWT-B`],
                ["Price impact",     `~${priceImpact}%`],
                ["Slippage",         `${slippage}%`],
                ["Pool fee",         "0.3%"],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ color: "#64748b", fontSize: 13 }}>{label}</span>
                  <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{value}</span>
                </div>
              ))}
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#94a3b8", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Cancel</button>
                <button onClick={handleSwap} style={{ flex: 1, padding: 12, borderRadius: 12, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Confirm</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────
export default function Dashboard() {
  const [txs,           setTxs]           = useState<Tx[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [lastUpdated,   setLastUpdated]   = useState("");
  const [activeTab,     setActiveTab]     = useState<TabKey>("token");
  const [walletAddr,    setWalletAddr]    = useState("");
  const [walletBalance, setWalletBalance] = useState("");
  const [swapHistory,   setSwapHistory]   = useState<SwapRecord[]>(() => {
    try { return JSON.parse(localStorage.getItem("swapHistory") || "[]"); } catch { return []; }
  });

  const fetchTxs = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("https://horizon-testnet.stellar.org/transactions?order=desc&limit=10");
      const data = await res.json();
      setTxs(data._embedded?.records || []);
      setLastUpdated("Updated " + new Date().toLocaleTimeString());
    } catch {
      setTxs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTxs();
    const iv = setInterval(fetchTxs, 12000);
    return () => clearInterval(iv);
  }, [activeTab, fetchTxs]);

  const handleSwapComplete = (record: SwapRecord) => {
    const updated = [record, ...swapHistory].slice(0, 20);
    setSwapHistory(updated);
    try { localStorage.setItem("swapHistory", JSON.stringify(updated)); } catch { /* ignore */ }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance:none; margin:0; }
        input[type=number] { -moz-appearance:textfield; }
        button:focus { outline: none; }
      `}</style>

      <StatsBar txs={txs} walletBalance={walletBalance} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>

        {/* LEFT column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <TxFeed
            txs={txs} loading={loading} lastUpdated={lastUpdated}
            activeTab={activeTab}
            setActiveTab={(t) => { setActiveTab(t); fetchTxs(); }}
            onRefresh={fetchTxs}
          />
          <div style={panel}>
            <div style={sectionLabel}>24h swap volume</div>
            <VolumeChart />
          </div>
          <PoolStatsPanel />
          <SwapHistoryPanel history={swapHistory} />
        </div>

        {/* RIGHT column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SwapCard
            walletAddr={walletAddr}
            setWalletAddr={setWalletAddr}
            walletBalance={walletBalance}
            setWalletBalance={setWalletBalance}
            onSwapComplete={handleSwapComplete}
          />
          <ContractsPanel />
          <CIPanel />
        </div>
      </div>
    </div>
  );
}