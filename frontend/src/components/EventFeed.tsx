import { useEffect, useState, useCallback } from "react";

const CONTRACTS = [
  { label: "Token", address: "CDGPMKYNYUGMYPB74P5PHPHC7IG4UOIES3GA6CE434C3MVHO3F7V2ZKD" },
  { label: "Pool",  address: "CBTZ4IRB672TNO3FWL2KXD6HD6NZADAOZQS2UJE3RQQWCUDCIKSJX3NF" },
  { label: "Router", address: "CC4EBO6TTLOTW3S63OMZKA4W56KVEQ4GBLFRMJLPCF6ZPYUB66UY3RGK" },
];

const HORIZON = "https://horizon-testnet.stellar.org";

interface Tx {
  id: string;
  hash: string;
  created_at: string;
  operation_count: number;
  fee_charged: string;
  successful: boolean;
  source_account: string;
  contract?: string;
}

function shortAddr(addr: string) {
  return addr ? addr.slice(0, 6) + "…" + addr.slice(-4) : "";
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function EventFeed() {
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeContract, setActiveContract] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [newTxIds, setNewTxIds] = useState<Set<string>>(new Set());

  const fetchTxs = useCallback(async (contractIdx: number, silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    const address = CONTRACTS[contractIdx].address;

    try {
      // Fetch transactions for the contract address
      const res = await fetch(
        `${HORIZON}/transactions?limit=10&order=desc`,
        { headers: { Accept: "application/json" } }
      );
      if (!res.ok) throw new Error(`Horizon error ${res.status}`);
      const data = await res.json();
      const records: Tx[] = (data._embedded?.records || []).map((r: any) => ({
        id: r.id,
        hash: r.hash,
        created_at: r.created_at,
        operation_count: r.operation_count,
        fee_charged: r.fee_charged,
        successful: r.successful,
        source_account: r.source_account,
        contract: CONTRACTS[contractIdx].label,
      }));

      setTransactions((prev) => {
        const prevIds = new Set(prev.map((t) => t.id));
        const fresh = records.filter((r) => !prevIds.has(r.id));
        if (fresh.length > 0) {
          setNewTxIds(new Set(fresh.map((t) => t.id)));
          setTimeout(() => setNewTxIds(new Set()), 3000);
        }
        return records;
      });
      setLastUpdated(new Date());
    } catch (e: any) {
      setError("Could not reach Stellar Horizon testnet.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + polling every 8 seconds
  useEffect(() => {
    fetchTxs(activeContract);
    const interval = setInterval(() => fetchTxs(activeContract, true), 8000);
    return () => clearInterval(interval);
  }, [activeContract, fetchTxs]);

  const card: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "20px",
    padding: "24px",
    width: "100%",
    maxWidth: "640px",
    margin: "0 auto",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <h2 style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 700, margin: "0 0 4px" }}>
            🔴 Live Transactions
          </h2>
          <p style={{ color: "#475569", fontSize: "0.72rem", margin: 0 }}>
            {lastUpdated ? `Updated ${timeAgo(lastUpdated.toISOString())}` : "Connecting to Stellar Horizon…"}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{
            display: "flex", alignItems: "center", gap: "5px",
            background: "rgba(34,197,94,0.15)", color: "#4ade80",
            padding: "4px 10px", borderRadius: "999px", fontSize: "0.72rem", fontWeight: 600,
          }}>
            <span style={{
              width: "6px", height: "6px", borderRadius: "50%",
              background: "#4ade80",
              boxShadow: "0 0 6px #4ade80",
              animation: "pulse 2s infinite",
              display: "inline-block",
            }} />
            LIVE
          </span>
          <button
            onClick={() => fetchTxs(activeContract)}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#94a3b8", borderRadius: "8px", padding: "4px 10px",
              fontSize: "0.72rem", cursor: "pointer",
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Contract Tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
        {CONTRACTS.map((c, i) => (
          <button
            key={c.label}
            onClick={() => setActiveContract(i)}
            style={{
              padding: "5px 14px", borderRadius: "999px", border: "none",
              background: activeContract === i
                ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                : "rgba(255,255,255,0.06)",
              color: activeContract === i ? "#fff" : "#94a3b8",
              fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {c.label}
            <span style={{
              marginLeft: "6px", fontSize: "0.65rem", opacity: 0.7,
              fontFamily: "monospace",
            }}>
              {shortAddr(c.address)}
            </span>
          </button>
        ))}
      </div>

      {/* Contract Address Bar */}
      <div style={{
        background: "rgba(255,255,255,0.04)", borderRadius: "10px",
        padding: "8px 14px", marginBottom: "14px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
        flexWrap: "wrap",
      }}>
        <span style={{ color: "#64748b", fontSize: "0.7rem" }}>Contract</span>
        <a
          href={`https://stellar.expert/explorer/testnet/contract/${CONTRACTS[activeContract].address}`}
          target="_blank"
          rel="noreferrer"
          style={{
            color: "#a5b4fc", fontFamily: "monospace", fontSize: "0.72rem",
            textDecoration: "none", wordBreak: "break-all",
          }}
        >
          {CONTRACTS[activeContract].address} ↗
        </a>
      </div>

      {/* Transaction List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#475569", fontSize: "0.85rem" }}>
          ⏳ Fetching transactions from Stellar Horizon…
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "24px 0", color: "#f87171", fontSize: "0.85rem" }}>
          ⚠️ {error}
        </div>
      ) : transactions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#475569", fontSize: "0.85rem" }}>
          No transactions found for this contract yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {transactions.map((tx) => (
            <a
              key={tx.id}
              href={`https://stellar.expert/explorer/testnet/tx/${tx.hash}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "block", textDecoration: "none",
                background: newTxIds.has(tx.id)
                  ? "rgba(99,102,241,0.15)"
                  : "rgba(255,255,255,0.04)",
                border: newTxIds.has(tx.id)
                  ? "1px solid rgba(99,102,241,0.4)"
                  : "1px solid rgba(255,255,255,0.07)",
                borderRadius: "12px", padding: "12px 14px",
                transition: "all 0.3s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", flexWrap: "wrap" }}>
                {/* Left */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{
                      width: "8px", height: "8px", borderRadius: "50%",
                      background: tx.successful ? "#4ade80" : "#f87171",
                      flexShrink: 0, display: "inline-block",
                    }} />
                    <span style={{ color: "#e2e8f0", fontSize: "0.8rem", fontFamily: "monospace", fontWeight: 600 }}>
                      {tx.hash.slice(0, 16)}…
                    </span>
                    {newTxIds.has(tx.id) && (
                      <span style={{
                        background: "rgba(99,102,241,0.3)", color: "#a5b4fc",
                        fontSize: "0.65rem", padding: "2px 6px", borderRadius: "999px", fontWeight: 700,
                      }}>NEW</span>
                    )}
                  </div>
                  <div style={{ color: "#64748b", fontSize: "0.72rem", fontFamily: "monospace" }}>
                    From: {shortAddr(tx.source_account)}
                  </div>
                </div>
                {/* Right */}
                <div style={{ textAlign: "right" }}>
                  <div style={{
                    color: tx.successful ? "#4ade80" : "#f87171",
                    fontSize: "0.75rem", fontWeight: 600, marginBottom: "3px",
                  }}>
                    {tx.successful ? "✓ Success" : "✗ Failed"}
                  </div>
                  <div style={{ color: "#475569", fontSize: "0.7rem" }}>
                    {timeAgo(tx.created_at)}
                  </div>
                </div>
              </div>
              {/* Footer row */}
              <div style={{
                display: "flex", gap: "16px", marginTop: "8px",
                paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.05)",
                flexWrap: "wrap",
              }}>
                <span style={{ color: "#64748b", fontSize: "0.7rem" }}>
                  Ops: <span style={{ color: "#94a3b8" }}>{tx.operation_count}</span>
                </span>
                <span style={{ color: "#64748b", fontSize: "0.7rem" }}>
                  Fee: <span style={{ color: "#94a3b8" }}>{(Number(tx.fee_charged) / 1e7).toFixed(5)} XLM</span>
                </span>
                <span style={{ color: "#6366f1", fontSize: "0.7rem", marginLeft: "auto" }}>
                  View on stellar.expert ↗
                </span>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{
        marginTop: "14px", paddingTop: "12px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px",
      }}>
        <span style={{ color: "#334155", fontSize: "0.7rem" }}>
          Powered by Stellar Horizon Testnet API
        </span>
        <a
          href={`https://stellar.expert/explorer/testnet/contract/${CONTRACTS[activeContract].address}`}
          target="_blank"
          rel="noreferrer"
          style={{
            color: "#6366f1", fontSize: "0.72rem", textDecoration: "none", fontWeight: 600,
          }}
        >
          Open in Explorer ↗
        </a>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}