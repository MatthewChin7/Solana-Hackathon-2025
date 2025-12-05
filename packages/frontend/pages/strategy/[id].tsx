import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useWallet } from "@solana/wallet-adapter-react";
import axios from "axios";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";
import { solanaClient, StrategyData } from "../../lib/solanaClient";
import { useStrategyTransactions } from "../../hooks/useStrategyTransactions";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";

export default function StrategyDetail() {
    const router = useRouter();
    const { id } = router.query;
    const { publicKey, signMessage } = useWallet();

    const [strategy, setStrategy] = useState<StrategyData | null>(null);
    const [loading, setLoading] = useState(true);
    const [ownsNft, setOwnsNft] = useState(false);
    const [checkingAccess, setCheckingAccess] = useState(false);
    const [signalLoading, setSignalLoading] = useState(false);
    const [signalData, setSignalData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const { buyStrategy, states: { buy: buyState } } = useStrategyTransactions();

    useEffect(() => {
        if (id && typeof id === "string") {
            fetchStrategy(id);
        }
    }, [id]);

    useEffect(() => {
        if (publicKey && strategy) {
            checkNftOwnership();
        } else {
            setOwnsNft(false);
        }
    }, [publicKey, strategy]);

    const fetchStrategy = async (pubkey: string) => {
        setLoading(true);
        try {
            const data = await solanaClient.getStrategy(pubkey);
            setStrategy(data);
        } catch (e) {
            console.error("Error:", e);
        } finally {
            setLoading(false);
        }
    };

    const checkNftOwnership = async () => {
        if (!publicKey || !strategy) return;
        setCheckingAccess(true);
        try {
            const result = await solanaClient.checkNftBalance(
                publicKey.toBase58(),
                strategy.strategyMint
            );
            setOwnsNft(result.hasAccess);
        } catch (e) {
            console.error("Error:", e);
        } finally {
            setCheckingAccess(false);
        }
    };

    const getSignal = async () => {
        if (!publicKey || !signMessage) return;
        setSignalLoading(true);
        setError(null);

        try {
            const timestamp = Date.now();
            const message = `Login to Strategy Marketplace: ${timestamp}`;
            const messageBytes = new TextEncoder().encode(message);
            const signature = await signMessage(messageBytes);
            const signatureBase58 = bs58.encode(signature);

            const res = await axios.post(`${SERVER_URL}/signal`, {
                publicKey: publicKey.toBase58(),
                signature: signatureBase58,
                timestamp: timestamp
            });

            setSignalData(res.data);
        } catch (e: any) {
            setError(e.response?.data?.error || "Failed to fetch signal");
        } finally {
            setSignalLoading(false);
        }
    };

    const handleBuy = async () => {
        if (!strategy || !publicKey) return;

        // Check if demo strategy
        if (strategy.publicKey.startsWith("strat-")) {
            alert("This is a demo strategy on Devnet/Testnet. You cannot purchase it with real SOL/USDC.");
            return;
        }

        try {
            setError(null);
            await buyStrategy({
                strategyPublicKey: new PublicKey(strategy.publicKey)
            });
            // Refresh ownership check
            checkNftOwnership();
        } catch (e: any) {
            console.error("Buy error:", e);
            setError(e.message || "Failed to purchase strategy");
        }
    };

    const formatPrice = (price: number) => (price / 1_000_000).toFixed(0);
    const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

    if (loading) {
        return <p className="text-body">Loading strategy...</p>;
    }

    if (!strategy) {
        return (
            <div>
                <h1 className="page-title">Not Found</h1>
                <p className="text-body">This strategy doesn't exist.</p>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <header className="page-header">
                <span className="text-label">Strategy {strategy.strategyId}</span>
                <h1 className="page-title" style={{ marginBottom: "var(--space-md)" }}>
                    {strategy.apiId || `Strategy ${strategy.strategyId}`}
                </h1>
                <div style={{ display: "flex", gap: "var(--space-md)", alignItems: "center" }}>
                    <span className={`badge ${strategy.listed ? "badge-success" : "badge-warning"}`}>
                        {strategy.listed ? "Listed" : "Unlisted"}
                    </span>
                    {ownsNft && (
                        <span className="badge badge-success">NFT Owner</span>
                    )}
                </div>
            </header>

            <div className="grid-editorial">
                {/* Left — Details */}
                <div>
                    {/* Price */}
                    {strategy.listed && (
                        <div style={{ marginBottom: "var(--space-xl)" }}>
                            <span className="text-label">Price</span>
                            <div style={{ fontFamily: "var(--font-serif)", fontSize: "3rem", marginTop: "var(--space-xs)" }}>
                                {formatPrice(strategy.listPrice)} <span style={{ fontSize: "1.5rem" }}>USDC</span>
                            </div>
                        </div>
                    )}

                    {/* Details */}
                    <div className="card" style={{ marginBottom: "var(--space-lg)" }}>
                        <div className="card-title">On-Chain Data</div>

                        <div className="detail-row">
                            <span className="detail-label">Strategy ID</span>
                            <span className="detail-value">{strategy.strategyId}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Creator</span>
                            <span className="detail-value">{shortenAddress(strategy.creator)}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Current Owner</span>
                            <span className="detail-value">{shortenAddress(strategy.seller)}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Strategy Mint</span>
                            <span className="detail-value">{shortenAddress(strategy.strategyMint)}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Payment Mint</span>
                            <span className="detail-value">{shortenAddress(strategy.paymentMint)}</span>
                        </div>
                    </div>

                    {/* Oracle */}
                    <div className="card">
                        <div className="card-title">Oracle Data</div>

                        <div className="detail-row">
                            <span className="detail-label">Last Mid (bps)</span>
                            <span className="detail-value">{strategy.lastMidBps}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Last Update</span>
                            <span className="detail-value">
                                {strategy.lastUpdateTs > 0
                                    ? new Date(strategy.lastUpdateTs * 1000).toLocaleString()
                                    : "Never"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right — Signal */}
                <div>
                    <div className="card">
                        <div className="card-title">Live Signal</div>

                        {!publicKey && (
                            <p className="text-body">
                                Connect wallet to access signals.
                            </p>
                        )}

                        {publicKey && checkingAccess && (
                            <p className="text-body">Checking access...</p>
                        )}

                        {publicKey && !checkingAccess && !ownsNft && (
                            <div>
                                <p className="text-body" style={{ marginBottom: "var(--space-lg)" }}>
                                    You need the Strategy NFT to access live signals.
                                </p>
                                {strategy.listed && (
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleBuy}
                                        disabled={buyState.loading}
                                    >
                                        {buyState.loading ? "Purchasing..." : "Purchase NFT"}
                                    </button>
                                )}
                            </div>
                        )}

                        {publicKey && ownsNft && (
                            <div>
                                <button
                                    className="btn btn-primary"
                                    onClick={getSignal}
                                    disabled={signalLoading}
                                    style={{ width: "100%", marginBottom: "var(--space-lg)" }}
                                >
                                    {signalLoading ? "Fetching..." : "Get Signal"}
                                </button>

                                {error && (
                                    <p style={{ color: "var(--color-error)", fontSize: "0.875rem" }}>
                                        {error}
                                    </p>
                                )}

                                {signalData && (
                                    <div className="signal-display">
                                        <div className="signal-value">
                                            {signalData.signal}
                                        </div>
                                        <p className="signal-description">
                                            {signalData.description}
                                        </p>
                                        <span className="signal-time">
                                            {new Date(signalData.lastUpdate).toLocaleTimeString()}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
