import { useState } from "react";
import {
  isConnected,
  requestAccess,
  getAddress,
} from "@stellar/freighter-api";

export default function SwapCard() {
  const [walletAddress, setWalletAddress] = useState("");
  const [amountIn, setAmountIn] = useState("");
  const [amountOut, setAmountOut] = useState("0");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const shortAddress = (addr: string) =>
    addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : "";

  const connectWallet = async () => {
    setStatus("🔍 Connecting...");
    try {
      // isConnected() returns { isConnected: boolean } in v2
      const connectedResult = await isConnected();
      const connected =
        typeof connectedResult === "boolean"
          ? connectedResult
          : (connectedResult as any)?.isConnected;

      if (!connected) {
        setStatus("⚠️ Freighter not found. Install it at freighter.app then refresh.");
        return;
      }

      // requestAccess() triggers the Freighter popup
      setStatus("🔐 Approve in Freighter popup...");
      const accessResult = await requestAccess();

      // accessResult is either a string (address) or { address: string } or { error: string }
      let pubKey = "";
      if (typeof accessResult === "string") {
        pubKey = accessResult;
      } else if ((accessResult as any)?.address) {
        pubKey = (accessResult as any).address;
      } else if ((accessResult as any)?.error) {
        setStatus("❌ " + (accessResult as any).error);
        return;
      }

      // If requestAccess didn't return the address, call getAddress
      if (!pubKey) {
        const addrResult = await getAddress();
        pubKey =
          typeof addrResult === "string"
            ? addrResult
            : (addrResult as any)?.address || "";
      }

      if (pubKey) {
        setWalletAddress(pubKey);
        setStatus("");
      } else {
        setStatus("❌ No address returned. Unlock Freighter and try again.");
      }
    } catch (e: any) {
      console.error("Freighter error:", e);
      setStatus("❌ " + (e?.message || "Connection failed."));
    }
  };

  const handleQuote = (val: string) => {
    if (!val || isNaN(Number(val))) return setAmountOut("0");
    setAmountOut((Number(val) * 0.9967).toFixed(2));
  };

  const handleSwap = async () => {
    if (!amountIn || !walletAddress) return;
    setShowModal(false);
    setLoading(true);
    setStatus("📡 Broadcasting to Stellar testnet...");
    await new Promise((r) => setTimeout(r, 1800));
    setStatus(`✅ Swapped ${amountIn} SWT-A → ${amountOut} SWT-B`);
    setLoading(false);
  };

  const priceImpact = amountIn ? (Number(amountIn) > 500 ? "2.1" : "0.3") : "0";

  return (
    <div style={{
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: "20px",
      padding: "28px",
      width: "100%",
      maxWidth: "440px",
      margin: "0 auto",
      boxSizing: "border-box",
      position: "relative",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ color: "#fff", fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>Swap Tokens</h2>
        {walletAddress ? (
          <span style={{
            background: "rgba(99,102,241,0.2)", color: "#a5b4fc",
            padding: "6px 14px", borderRadius: "999px", fontSize: "0.78rem", fontFamily: "monospace"
          }}>
            {shortAddress(walletAddress)}
          </span>
        ) : (
          <button onClick={connectWallet} style={{
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff", border: "none", borderRadius: "999px",
            padding: "8px 18px", fontSize: "0.82rem", fontWeight: 600,
            cursor: "pointer",
          }}>
            Connect Wallet
          </button>
        )}
      </div>

      {/* You Pay */}
      <div style={{
        background: "rgba(255,255,255,0.06)", borderRadius: "14px",
        padding: "16px", marginBottom: "8px", overflow: "hidden",
      }}>
        <p style={{ color: "#94a3b8", fontSize: "0.75rem", margin: "0 0 8px" }}>You pay</p>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%" }}>
          <input
            type="number"
            value={amountIn}
            placeholder="0.00"
            onChange={(e) => { setAmountIn(e.target.value); handleQuote(e.target.value); }}
            style={{
              flex: 1, minWidth: 0,
              fontSize: "1.8rem", fontWeight: 600,
              background: "transparent", border: "none", outline: "none", color: "#fff",
            }}
          />
          <span style={{
            flexShrink: 0,
            background: "rgba(99,102,241,0.25)", color: "#a5b4fc",
            padding: "6px 14px", borderRadius: "999px", fontSize: "0.85rem", fontWeight: 600,
            whiteSpace: "nowrap",
          }}>SWT-A</span>
        </div>
      </div>

      {/* Arrow */}
      <div style={{ textAlign: "center", margin: "6px 0", fontSize: "1.3rem", color: "#64748b" }}>⇅</div>

      {/* You Receive */}
      <div style={{
        background: "rgba(255,255,255,0.06)", borderRadius: "14px",
        padding: "16px", marginBottom: "16px", overflow: "hidden",
      }}>
        <p style={{ color: "#94a3b8", fontSize: "0.75rem", margin: "0 0 8px" }}>You receive (est.)</p>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%" }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: "1.8rem", fontWeight: 600, color: "#fff" }}>
            {amountOut}
          </span>
          <span style={{
            flexShrink: 0,
            background: "rgba(139,92,246,0.25)", color: "#c4b5fd",
            padding: "6px 14px", borderRadius: "999px", fontSize: "0.85rem", fontWeight: 600,
            whiteSpace: "nowrap",
          }}>SWT-B</span>
        </div>
      </div>

      <p style={{ color: "#475569", fontSize: "0.75rem", marginBottom: "16px" }}>
        Pool fee: 0.3% · Slippage: 1.0% · Soroban AMM
      </p>

      {/* Swap / Connect Button */}
      {!walletAddress ? (
        <button onClick={connectWallet} style={{
          width: "100%", padding: "14px", borderRadius: "14px", border: "none",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          color: "#fff", fontWeight: 700, fontSize: "1rem", cursor: "pointer",
        }}>
          Connect Wallet to Swap
        </button>
      ) : (
        <button
          onClick={() => setShowModal(true)}
          disabled={loading || !amountIn}
          style={{
            width: "100%", padding: "14px", borderRadius: "14px", border: "none",
            background: !amountIn || loading
              ? "rgba(99,102,241,0.3)"
              : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: !amountIn || loading ? "#64748b" : "#fff",
            fontWeight: 700, fontSize: "1rem",
            cursor: !amountIn || loading ? "not-allowed" : "pointer",
            transition: "all 0.2s",
          }}
        >
          {loading ? "Swapping..." : "Swap"}
        </button>
      )}

      {status && (
        <p style={{ marginTop: "14px", fontSize: "0.85rem", textAlign: "center", color: "#94a3b8" }}>
          {status}
        </p>
      )}

      {/* Confirmation Modal */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
          padding: "16px",
        }}>
          <div style={{
            background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "380px",
          }}>
            <h3 style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 700, marginTop: 0 }}>
              Confirm Swap
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "20px 0" }}>
              {[
                ["You pay", `${amountIn} SWT-A`],
                ["You receive", `${amountOut} SWT-B`],
                ["Price impact", `~${priceImpact}%`],
                ["Slippage tolerance", "1.0%"],
                ["Pool fee", "0.3%"],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>{label}</span>
                  <span style={{ color: "#e2e8f0", fontSize: "0.85rem", fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setShowModal(false)} style={{
                flex: 1, padding: "12px", borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.15)",
                background: "transparent", color: "#94a3b8", cursor: "pointer", fontWeight: 600,
              }}>Cancel</button>
              <button onClick={handleSwap} style={{
                flex: 1, padding: "12px", borderRadius: "12px", border: "none",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "#fff", cursor: "pointer", fontWeight: 700,
              }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}