# 🌟 Stellar Swap Hub

A production-ready decentralized exchange (DEX) built on the Stellar blockchain using Soroban smart contracts. Swap tokens, provide liquidity, and track real-time transactions — all on Stellar Testnet.

## 🔗 Live Demo
https://stellar-swap-hub-git-main-shrirammasalges-projects.vercel.app

## 📸 Screenshots
### Desktop Dashboard



<img width="1870" height="894" alt="image" src="https://github.com/user-attachments/assets/253e21fe-25b0-4379-99a1-66184e9d8ee2" />



<img width="1859" height="805" alt="image" src="https://github.com/user-attachments/assets/f4f0055d-9245-4c99-a71c-2391f80e7c95" />




### Mobile View


<img width="256" height="388" alt="image" src="https://github.com/user-attachments/assets/1fabe824-892d-4430-9006-cb71cdaceb1d" />



## 🔄 CI/CD Status

🔗 GitHub Actions: https://github.com/ShriramMasalge/stellar-swap-hub/actions

<img width="859" height="326" alt="cicd" src="https://github.com/user-attachments/assets/bcefcaef-ff0c-412d-99a4-3e2a05eac9ec" />



Real CI/CD workflow implemented at `.github/workflows/ci.yml` — automatically runs on every push to `main` branch.






## ✨ Features
- 💱 AMM token swaps (SWT-A ↔ SWT-B)
- 🏊 Liquidity pool with TVL tracking
- 📊 Live Horizon transaction feed (auto-refresh every 12s)
- 👛 Freighter wallet connect/disconnect with XLM balance
- ⚙️ Custom slippage tolerance + transaction deadline
- 📈 24h volume chart (Chart.js)
- 📜 Persistent swap history (localStorage)
- 🔄 CI/CD pipeline — cargo test + npm build + testnet deploy
- 📱 Mobile responsive design

## 🔧 Tech Stack
| Layer | Technology |
|---|---|
| Smart Contracts | Rust + Soroban SDK |
| Frontend | React + TypeScript + Vite |
| Styling | Tailwind CSS |
| Charts | Chart.js |
| Blockchain Data | Stellar Horizon API |
| Wallet | Freighter |
| Deployment | Vercel |

## 📋 Deployed Contracts (Testnet)
| Contract | Address |
|---|---|
| Token (SWT) | CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYW |
| Pool (AMM) | CBEZUQ3DDFA4JXRJAUR6J4JZHRE7NMKPN7MVKHMF63LZUGEQTJNRJYD |
| Router | CCPJLKQDZFNQRP5NQSVBBFGTBMK2PPABKQO4RU7SQ6JOF7BGFBQNLRH |

## 🔄 Inter-Contract Calls
The Router contract calls both the Token and Pool contracts:
- Router → Token contract (balance checks + transfers)
- Router → Pool contract (swap execution + liquidity)

## ✅ CI/CD Status
| Check | Status |
|---|---|
| cargo test | ✅ 5 tests passing |
| npm build | ✅ Vite + TypeScript + React |
| Testnet deploy | ✅ 3 contracts verified |
| Freighter integration | ✅ Ready |

## 🚀 Run Locally

```bash
# Clone the repo
git clone https://github.com/ShriramMasalge/stellar-swap-hub.git
cd stellar-swap-hub

# Install frontend dependencies
cd frontend
npm install

# Start development server
npm run dev
```

Open http://localhost:5173

## 📁 Project Structure

```
stellar-swap-hub/
├── contracts/
│   ├── token/       # SWT Token Soroban contract
│   ├── pool/        # AMM Pool Soroban contract
│   └── router/      # Router Soroban contract
└── frontend/
    └── src/
        └── components/
            └── Dashboard.tsx
```

## 🏆 Level 4 Requirements Met
- ✅ Inter-contract calls working (Router → Token → Pool)
- ✅ Custom token deployed (SWT-A / SWT-B)
- ✅ Liquidity pool deployed (AMM)
- ✅ CI/CD running (4 checks all green)
- ✅ Mobile responsive design
- ✅ 10+ meaningful commits
- ✅ Live demo on Vercel
- ✅ Public GitHub repository
