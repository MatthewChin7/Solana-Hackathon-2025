# Polytrader - Solana Hackathon 2025

**Live Deployment:** [View on Vercel](https://solana-hackathon-2025-frontend-j9j7xhvtf-matthewchin7s-projects.vercel.app/)

Polytrader is a decentralized marketplace for algorithmic trading strategies on Solana. It allows strategy developers to tokenize their trading logic as NFTs and sell access to investors. Investors hold the Strategy NFT to unlock real-time trading signals, which can be executed automatically on platforms like Polymarket.

## Architecture Overview
The project consists of three main components:

### 1. Solana Smart Contract (Anchor)
- **Program ID:** `71sBGrD8VytsD9EUnon83CiCmfHN41LMgoWt975AHewm`
- **Functionality:**
    - **Strategy Creation:** Mints a unique NFT representing the strategy.
    - **Marketplace:** Escrow-based listing and buying mechanism.
    - **Access Control:** Verifies NFT ownership for signal access.
    - **Oracle Integration:** Stores performance metrics (mid-price basis points) on-chain.

### 2. Frontend (Next.js)
- **Stack:** Next.js, React, TypeScript, Solana Wallet Adapter.
- **Features:**
    - **Trader Dashboard:** Discover, filter, and compare strategies.
    - **Developer Studio:** Write, test, and deploy strategies directly in the browser.
    - **Portfolio:** Manage owned strategies and view performance.
    - **Visualizations:** Real-time performance graphs (Sparklines).

### 3. Backend (Node.js/Express)
- **Stack:** Node.js, Express, SQLite, IPFS (simulated for demo).
- **Functionality:**
    - **Metadata Indexing:** Caches strategy metadata and performance history.
    - **Signal Engine:** Executes strategy logic (JavaScript) in a sandboxed environment.
    - **IPFS Integration:** Stores strategy source code and metadata (simulated with local storage for demo speed).

## Key Features
- **Tokenized Strategies:** Strategies are SPL Tokens (NFTs), enabling transferability and secondary markets.
- **Proof of Performance:** On-chain oracle updates ensure transparent and immutable performance tracking.
- **Sandboxed Execution:** Strategies are written in JavaScript and executed securely off-chain, with signals verified on-chain.
- **Polymarket Integration:** Designed to generate signals for prediction markets.

## Setup & Installation

### Prerequisites
- Node.js (v16+)
- Rust & Cargo
- Solana CLI
- Anchor CLI

### Running Locally

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Local Validator**
   ```bash
   solana-test-validator
   ```

3. **Deploy Program**
   ```bash
   anchor build
   anchor deploy
   ```

4. **Start Backend**
   ```bash
   cd packages/server
   npm run dev
   ```

5. **Start Frontend**
   ```bash
   cd packages/frontend
   npm run dev
   ```

## Contract Addresses
- **Program ID:** `71sBGrD8VytsD9EUnon83CiCmfHN41LMgoWt975AHewm`
- **Network:** Devnet / Localnet (Configurable)
