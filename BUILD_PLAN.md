# 3-Step Build Plan

This document outlines the complete build plan for the Strategy Marketplace project, designed to satisfy:

- ✅ **Solana main track**: Real program on devnet, Anchor, wallet integration
- ✅ **Polymarket bounty**: Real use of Polymarket's public APIs for prediction data
- ✅ **Code quality**: No TODOs, no placeholders, no dead code - production-ready

## Step 1: On-chain Program (Anchor)

### Prompt for Antigravity

```
You are an expert Solana smart contract engineer using Anchor (Rust).

Goal: Create an Anchor program called `strategy_marketplace` that:
- Mints transferable Strategy NFTs (1-of-1 SPL tokens) representing ownership/licensing of a trading strategy
- Lets owners list and sell these NFTs for an SPL payment token
- Stores a cryptographic commitment to the strategy (strategy_hash) and an api_id so an off-chain black-box service can be tied to each strategy

[Full requirements provided in README.md]
```

### Infrastructure Setup

```bash
# Install toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install latest
avm use latest

# Configure devnet
solana config set --url https://api.devnet.solana.com
solana-keygen new -o ~/.config/solana/id.json
solana airdrop 2

# Build and test
anchor build
anchor test
```

### Target State

✅ Green test suite  
✅ Program deployed to devnet  
✅ Strategy NFTs can be minted, listed, and sold  
✅ Oracle updates work

---

## Step 2: Off-chain Server + Bootstrap

### Prompt for Antigravity

```
You are now a full-stack engineer extending the strategy_marketplace repo.

Goal: Add:
1) A devnet bootstrap script that deploys a real strategy on devnet and writes config files with concrete addresses
2) A Node.js/TypeScript server that:
   - Runs a black-box Polymarket-based strategy engine
   - Exposes an NFT-gated /signal API that only responds if the caller owns the Strategy NFT

[Full requirements provided in README.md]
```

### Infrastructure Setup

```bash
# Install Node.js and pnpm
nvm install --lts
npm install -g pnpm

# Bootstrap workspace
pnpm install
pnpm bootstrap:devnet  # Deploys strategy, creates configs

# Start server
cd packages/server
pnpm dev
```

### Target State

✅ Real Strategy NFT on devnet  
✅ Real buyer wallet owns the NFT  
✅ Server running with Polymarket integration  
✅ NFT-gated `/signal` endpoint working  
✅ Config files generated with real addresses

---

## Step 3: Frontend (Next.js)

### Prompt for Antigravity

```
You are now building the frontend for the strategy_marketplace protocol and the NFT-gated signal API.

Goal: Create a Next.js + TypeScript app in packages/frontend that:
- Connects to Solana devnet with Phantom
- Displays the live Strategy created by the bootstrap script
- Lets an NFT owner click "Get Signal" to fetch the Polymarket-driven signal from the server
- Uses only concrete configuration values read from env/config files, not placeholder strings

[Full requirements provided in README.md]
```

### Infrastructure Setup

```bash
cd packages/frontend
pnpm install

# Copy IDL
mkdir -p public/idl
cp ../../target/idl/strategy_marketplace.json public/idl/strategy_marketplace.json

# Start frontend
pnpm dev
```

### Target State

✅ Frontend running on http://localhost:3000  
✅ Wallet connection working (Phantom/Solflare)  
✅ Strategy details displayed from devnet  
✅ NFT ownership verification working  
✅ "Get Signal" button returns real Polymarket signals

---

## Full System Test

### Run All Services

**Terminal 1 - Server:**
```bash
cd packages/server
pnpm dev
```

**Terminal 2 - Frontend:**
```bash
cd packages/frontend
pnpm dev
```

**Terminal 3 - (Optional) Re-bootstrap:**
```bash
pnpm bootstrap:devnet
```

### Test Flow

1. Open http://localhost:3000
2. Connect Phantom wallet (switch to Devnet)
3. Import buyer keypair from `keys/buyer.json` (or send NFT to your wallet)
4. Verify "You own this strategy" appears
5. Click "Get Signal"
6. See real Polymarket-driven signal (BUY_YES/SELL_YES/HOLD)

---

## Key Files Generated

After running bootstrap:
- `keys/creator.json` - Creator keypair
- `keys/buyer.json` - Buyer keypair  
- `config/addresses.json` - All addresses summary
- `packages/server/.env` - Server configuration
- `packages/frontend/.env.local` - Frontend environment variables

## Verification Checklist

- [ ] `anchor test` passes
- [ ] `pnpm bootstrap:devnet` completes successfully
- [ ] Server starts and shows Polymarket updates
- [ ] Frontend loads and shows strategy from devnet
- [ ] Wallet connects successfully
- [ ] NFT ownership is correctly detected
- [ ] "Get Signal" returns valid response
- [ ] No TODOs or placeholders in code
- [ ] All addresses are real devnet addresses

---

## Notes

- The bootstrap script is idempotent (safe to run multiple times)
- All configuration is generated automatically
- No manual address entry required
- Strategy signals update every 60 seconds
- NFT ownership verified on-chain before serving signals

