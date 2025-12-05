import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";

// Dynamic import for Monaco editor (avoid SSR)
const StrategyEditor = dynamic(() => import("../../components/StrategyEditor"), {
    ssr: false,
    loading: () => <div style={{ padding: "2rem", color: "var(--color-stone)" }}>Loading editor...</div>
});

const DEFAULT_CODE = `// Trading Strategy for Polymarket
// Available: polymarket.getMarkets(), polymarket.getPrices(id), etc.

async function signal(polymarket) {
    // Fetch active markets
    const markets = await polymarket.getMarkets(5);
    
    // Example: Find markets with high volume
    const highVolumeMarket = markets.find(m => 
        parseFloat(m.volume) > 100000
    );
    
    if (highVolumeMarket) {
        const prices = await polymarket.getPrices(highVolumeMarket.id);
        
        // Simple momentum strategy
        if (prices.yes < 0.3) {
            log("Found undervalued YES at", prices.yes);
            return "BUY";
        }
        if (prices.yes > 0.7) {
            log("Found overvalued YES at", prices.yes);
            return "SELL";
        }
    }
    
    return "HOLD";
}
`;



export default function CreateStrategy() {
    const { publicKey } = useWallet();
    const router = useRouter();

    const [step, setStep] = useState<"info" | "code" | "confirm">("info");
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        price: "",
    });
    const [code, setCode] = useState(DEFAULT_CODE);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<any>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<{ cid?: string; error?: string } | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleTestStrategy = async () => {
        setTesting(true);
        setTestResult(null);

        try {
            const res = await fetch(`/api/strategy/test`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code })
            });
            const result = await res.json();
            setTestResult(result);
        } catch (e: any) {
            setTestResult({ success: false, error: e.message || "Test failed" });
        } finally {
            setTesting(false);
        }
    };

    const handleUploadAndCreate = async () => {
        if (!publicKey) {
            alert("Please connect your wallet");
            return;
        }

        setUploading(true);
        setUploadResult(null);

        try {
            // 1. Upload code to IPFS
            const uploadRes = await fetch(`/api/strategy/upload`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code,
                    metadata: {
                        name: formData.name,
                        description: formData.description,
                        creator: publicKey.toBase58()
                    }
                })
            });

            const uploadData = await uploadRes.json();

            if (!uploadData.success) {
                throw new Error(uploadData.error || "Upload failed");
            }

            setUploadResult({ cid: uploadData.cid });

            // 2. TODO: Call smart contract to create strategy with IPFS hash
            // For now, show success with CID
            alert(`Strategy uploaded to IPFS!\nCID: ${uploadData.cid}\n\nSmart contract integration coming soon.`);

            // router.push("/my-strategies");

        } catch (e: any) {
            setUploadResult({ error: e.message || "Failed to create strategy" });
        } finally {
            setUploading(false);
        }
    };

    const canProceed = () => {
        if (step === "info") {
            return formData.name && formData.description && formData.price;
        }
        if (step === "code") {
            return code.length > 0;
        }
        return true;
    };

    if (!publicKey) {
        return (
            <div>
                <header className="page-header">
                    <span className="text-label">New Strategy</span>
                    <h1 className="page-title">Create</h1>
                </header>
                <div className="card">
                    <p className="text-body">
                        Connect your wallet to create a strategy.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <header className="page-header">
                <span className="text-label">New Strategy</span>
                <h1 className="page-title">Create</h1>
                <p className="page-subtitle">
                    Write and deploy your trading strategy as an NFT.
                </p>
            </header>

            {/* Progress Steps */}
            <div className="steps" style={{ marginBottom: "var(--space-xl)" }}>
                <div className={`step ${step === "info" ? "active" : step === "code" || step === "confirm" ? "done" : ""}`}>
                    <span className="step-number">1</span>
                    <span className="step-label">Details</span>
                </div>
                <div className="step-divider" />
                <div className={`step ${step === "code" ? "active" : step === "confirm" ? "done" : ""}`}>
                    <span className="step-number">2</span>
                    <span className="step-label">Strategy Code</span>
                </div>
                <div className="step-divider" />
                <div className={`step ${step === "confirm" ? "active" : ""}`}>
                    <span className="step-number">3</span>
                    <span className="step-label">Confirm</span>
                </div>
            </div>

            {/* Step 1: Strategy Info */}
            {step === "info" && (
                <div style={{ maxWidth: "560px" }}>
                    <div className="form-group">
                        <label className="form-label">Strategy Name</label>
                        <input
                            type="text"
                            name="name"
                            className="form-input"
                            placeholder="Polymarket Momentum Alpha"
                            value={formData.name}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea
                            name="description"
                            className="form-input"
                            placeholder="Describe your strategy approach and methodology..."
                            value={formData.description}
                            onChange={handleChange}
                            rows={4}
                        />
                    </div>

                    <div className="divider" />

                    <div className="form-group">
                        <label className="form-label">List Price (USDC)</label>
                        <input
                            type="number"
                            name="price"
                            className="form-input"
                            placeholder="50"
                            value={formData.price}
                            onChange={handleChange}
                            min="1"
                        />
                    </div>

                    <div style={{ marginTop: "var(--space-xl)" }}>
                        <button
                            className="btn btn-primary"
                            onClick={() => setStep("code")}
                            disabled={!canProceed()}
                        >
                            Continue to Code Editor
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: Strategy Code */}
            {step === "code" && (
                <div>
                    <StrategyEditor
                        value={code}
                        onChange={setCode}
                        onTest={handleTestStrategy}
                        testResult={testResult}
                        testing={testing}
                    />

                    <div style={{ marginTop: "var(--space-xl)", display: "flex", gap: "var(--space-sm)" }}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setStep("info")}
                        >
                            Back
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={() => setStep("confirm")}
                            disabled={!canProceed()}
                        >
                            Review & Create
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Confirm */}
            {step === "confirm" && (
                <div style={{ maxWidth: "600px" }}>
                    <div className="card" style={{ marginBottom: "var(--space-lg)" }}>
                        <div className="card-title">Strategy Details</div>

                        <div className="detail-row">
                            <span className="detail-label">Name</span>
                            <span className="detail-value">{formData.name}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Description</span>
                            <span className="detail-value" style={{ maxWidth: "300px" }}>
                                {formData.description}
                            </span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Price</span>
                            <span className="detail-value">{formData.price} USDC</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Code Size</span>
                            <span className="detail-value">{code.length} bytes</span>
                        </div>
                    </div>

                    {uploadResult?.error && (
                        <div style={{
                            padding: "1rem",
                            background: "rgba(158, 90, 90, 0.1)",
                            marginBottom: "var(--space-lg)",
                            color: "var(--color-error)"
                        }}>
                            {uploadResult.error}
                        </div>
                    )}

                    {uploadResult?.cid && (
                        <div style={{
                            padding: "1rem",
                            background: "rgba(90, 122, 90, 0.1)",
                            marginBottom: "var(--space-lg)"
                        }}>
                            <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
                                ✓ Uploaded to IPFS
                            </div>
                            <div className="text-mono" style={{ fontSize: "0.75rem", wordBreak: "break-all" }}>
                                CID: {uploadResult.cid}
                            </div>
                        </div>
                    )}

                    <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setStep("code")}
                            disabled={uploading}
                        >
                            Back
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleUploadAndCreate}
                            disabled={uploading}
                        >
                            {uploading ? "Creating..." : "Create Strategy NFT"}
                        </button>
                    </div>
                </div>
            )}

            <style jsx>{`
                .steps {
                    display: flex;
                    align-items: center;
                    gap: 0;
                }
                .step {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--color-stone);
                }
                .step.active {
                    color: var(--color-ink);
                }
                .step.done {
                    color: var(--color-success);
                }
                .step-number {
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.75rem;
                    font-weight: 500;
                    border: 1px solid currentColor;
                }
                .step.active .step-number {
                    background: var(--color-ink);
                    color: var(--color-cream);
                    border-color: var(--color-ink);
                }
                .step.done .step-number {
                    background: var(--color-success);
                    color: white;
                    border-color: var(--color-success);
                }
                .step-label {
                    font-size: 0.875rem;
                }
                .step-divider {
                    width: 40px;
                    height: 1px;
                    background: var(--color-paper-warm);
                    margin: 0 var(--space-sm);
                }
            `}</style>
        </div>
    );
}
