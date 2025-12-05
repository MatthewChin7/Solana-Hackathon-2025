import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { getStrategy, getNftBalance } from "../lib/solanaClient";
import axios from "axios";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

interface StrategyData {
  creator: PublicKey;
  strategyMint: PublicKey;
  paymentMint: PublicKey;
  listed: boolean;
  listPrice: anchor.BN;
  seller: PublicKey;
  strategyHash: number[];
  apiId: string;
  lastMidBps: number;
  lastUpdateTs: anchor.BN;
}

interface SignalResponse {
  apiId: string;
  mid: number;
  signal: string;
  updatedAt: number;
}

export default function Home() {
  const { connection } = useConnection();
  const { publicKey, signMessage } = useWallet();
  const [strategy, setStrategy] = useState<StrategyData | null>(null);
  const [nftBalance, setNftBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signal, setSignal] = useState<SignalResponse | null>(null);
  const [fetchingSignal, setFetchingSignal] = useState(false);

  const strategyPubkey =
    process.env.NEXT_PUBLIC_STRATEGY_PUBKEY ||
    "11111111111111111111111111111111";
  const apiId = process.env.NEXT_PUBLIC_API_ID || "strategy-1";
  const serverUrl =
    process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000";

  useEffect(() => {
    loadStrategy();
  }, []);

  useEffect(() => {
    if (publicKey) {
      loadNftBalance();
    } else {
      setNftBalance(0);
    }
  }, [publicKey, connection]);

  async function loadStrategy() {
    try {
      setLoading(true);
      setError(null);
      const data = await getStrategy();
      setStrategy(data);
    } catch (err: any) {
      setError(err.message || "Failed to load strategy");
    } finally {
      setLoading(false);
    }
  }

  async function loadNftBalance() {
    if (!publicKey) return;
    try {
      const balance = await getNftBalance(publicKey);
      setNftBalance(balance);
    } catch (err) {
      console.error("Error loading NFT balance:", err);
    }
  }

  async function handleGetSignal() {
    if (!publicKey || !signMessage) {
      setError("Wallet not connected or does not support message signing");
      return;
    }

    try {
      setFetchingSignal(true);
      setError(null);

      const timestamp = Math.floor(Date.now() / 1000);
      const message = JSON.stringify({
        strategyPubkey,
        apiId,
        timestamp,
      });

      const messageBytes = new TextEncoder().encode(message);
      const signature = await signMessage(messageBytes);
      const signatureBase64 = Buffer.from(signature).toString("base64");

      const response = await axios.post(`${serverUrl}/signal`, {
        walletPubkey: publicKey.toString(),
        message: message,
        signature: signatureBase64,
      });

      setSignal(response.data);
    } catch (err: any) {
      setError(
        err.response?.data?.error || err.message || "Failed to fetch signal"
      );
    } finally {
      setFetchingSignal(false);
    }
  }

  function formatPrice(price: anchor.BN, decimals: number = 6): string {
    const divisor = new anchor.BN(10).pow(new anchor.BN(decimals));
    const whole = price.div(divisor).toNumber();
    const fractional = price.mod(divisor).toNumber();
    const fractionalStr = fractional.toString().padStart(decimals, "0");
    return `${whole}.${fractionalStr}`;
  }

  function formatTimestamp(timestamp: anchor.BN): string {
    const date = new Date(timestamp.toNumber() * 1000);
    return date.toLocaleString();
  }

  function formatMid(midBps: number): string {
    return (midBps / 10_000).toFixed(4);
  }

  if (loading) {
    return (
      <div>
        <div className="header">
          <h1>Strategy Marketplace</h1>
          <WalletMultiButton />
        </div>
        <div className="container">
          <div className="loading">Loading strategy...</div>
        </div>
      </div>
    );
  }

  if (error && !strategy) {
    return (
      <div>
        <div className="header">
          <h1>Strategy Marketplace</h1>
          <WalletMultiButton />
        </div>
        <div className="container">
          <div className="error">{error}</div>
          <button className="button" onClick={loadStrategy}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="header">
        <h1>Strategy Marketplace</h1>
        <WalletMultiButton />
      </div>
      <div className="container">
        {error && <div className="error">{error}</div>}

        <div className="card">
          <h2>Strategy Details</h2>
          <div className="field">
            <label>Strategy Address</label>
            <value>{strategyPubkey}</value>
          </div>
          {strategy && (
            <>
              <div className="field">
                <label>Creator</label>
                <value>{strategy.creator.toString()}</value>
              </div>
              <div className="field">
                <label>Payment Mint</label>
                <value>{strategy.paymentMint.toString()}</value>
              </div>
              <div className="field">
                <label>Listed</label>
                <value>{strategy.listed ? "Yes" : "No"}</value>
              </div>
              {strategy.listed && (
                <div className="field">
                  <label>List Price</label>
                  <value>
                    {formatPrice(strategy.listPrice)} tokens (6 decimals)
                  </value>
                </div>
              )}
              <div className="field">
                <label>Last Mid Price</label>
                <value>
                  {strategy.lastMidBps > 0
                    ? formatMid(strategy.lastMidBps)
                    : "Not updated"}
                </value>
              </div>
              <div className="field">
                <label>Last Update</label>
                <value>
                  {strategy.lastUpdateTs.toNumber() > 0
                    ? formatTimestamp(strategy.lastUpdateTs)
                    : "Never"}
                </value>
              </div>
            </>
          )}
        </div>

        {publicKey && (
          <div className="card">
            <h2>Your Wallet</h2>
            <div className="field">
              <label>Address</label>
              <value>{publicKey.toString()}</value>
            </div>
            <div className="field">
              <label>NFT Ownership</label>
              <value>
                {nftBalance === 1
                  ? "✓ You own this strategy"
                  : "✗ You do not own this strategy NFT"}
              </value>
            </div>
            {nftBalance === 1 && (
              <div>
                <button
                  className="button"
                  onClick={handleGetSignal}
                  disabled={fetchingSignal || !signMessage}
                >
                  {fetchingSignal ? "Fetching..." : "Get Signal"}
                </button>
                {signal && (
                  <div className="signal-display">
                    <h3>Signal Response</h3>
                    <div className="signal-value">{signal.signal}</div>
                    <div className="field">
                      <label>Mid Price</label>
                      <value>{signal.mid.toFixed(4)}</value>
                    </div>
                    <div className="field">
                      <label>Updated At</label>
                      <value>
                        {new Date(signal.updatedAt * 1000).toLocaleString()}
                      </value>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!publicKey && (
          <div className="card">
            <div className="status info">
              Connect your wallet to view ownership status and get signals
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

