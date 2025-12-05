import React, { createContext, useContext, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Image from "next/image";
import Head from "next/head";

// Dashboard context for global state
type DashboardMode = "trader" | "developer";

interface DashboardContextType {
    mode: DashboardMode;
    setMode: (mode: DashboardMode) => void;
}

const DashboardContext = createContext<DashboardContextType>({
    mode: "trader",
    setMode: () => { }
});

export const useDashboard = () => useContext(DashboardContext);

export default function Layout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { publicKey } = useWallet();
    const [mode, setMode] = useState<DashboardMode>("trader");

    // Persist mode in localStorage
    useEffect(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("dashboardMode") as DashboardMode;
            if (saved) setMode(saved);
        }
    }, []);

    const handleModeChange = (newMode: DashboardMode) => {
        setMode(newMode);
        localStorage.setItem("dashboardMode", newMode);
        // Navigate to appropriate home
        if (newMode === "trader") {
            router.push("/");
        } else {
            router.push("/developer");
        }
    };

    // Navigation links based on mode
    const traderLinks = [
        { href: "/", label: "Discover" },
        { href: "/portfolio", label: "My Strategies" },
    ];

    const developerLinks = [
        { href: "/developer", label: "Dashboard" },
        { href: "/developer/create", label: "Create" },
        { href: "/developer/strategies", label: "My Strategies" },
    ];


    const navLinks = mode === "trader" ? traderLinks : developerLinks;

    return (
        <DashboardContext.Provider value={{ mode, setMode }}>
            <Head>
                <title>Polytrader - Algorithmic Strategy Marketplace</title>
                <meta name="description" content="Decentralized marketplace for algorithmic prediction strategies on Solana." />
            </Head>
            <div className="app-container">
                <nav className="nav">
                    {/* Left: Logo & Partners */}
                    <div className="nav-brand">
                        <div className="nav-partners">
                            <img
                                src="/images/polymarket-logo.png"
                                alt="Polymarket"
                                height={24}
                                style={{ height: "24px", width: "auto" }}
                            />
                            <span className="nav-partner-divider">×</span>
                            <img
                                src="/images/solana.png"
                                alt="Solana"
                                height={24}
                                style={{ height: "24px", width: "auto" }}
                            />
                        </div>

                        <Link href={mode === "trader" ? "/" : "/developer"} className="nav-logo-link">
                            <img
                                src="/images/polytrader-logo.png"
                                alt="Polytrader"
                                style={{ height: "40px", width: "auto" }}
                            />
                        </Link>
                    </div>

                    {/* Center: Mode Toggle */}
                    <div className="mode-toggle">
                        <button
                            className={`mode-btn ${mode === "trader" ? "active" : ""}`}
                            onClick={() => handleModeChange("trader")}
                        >
                            Trader
                        </button>
                        <button
                            className={`mode-btn ${mode === "developer" ? "active" : ""}`}
                            onClick={() => handleModeChange("developer")}
                        >
                            Developer
                        </button>
                    </div>

                    {/* Right: Nav Links + Settings + Wallet */}
                    <div className="nav-right">
                        <div className="nav-links">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`nav-link ${router.pathname === link.href ? "active" : ""}`}
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                        {publicKey && (
                            <Link
                                href={`/profile/${publicKey.toBase58()}`}
                                className="profile-btn"
                                title="View Profile"
                            >
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="10" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
                                    <path d="M4 16C4 13.2386 6.23858 11 9 11H11C13.7614 11 16 13.2386 16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                            </Link>
                        )}
                        <WalletMultiButton />
                    </div>
                </nav>

                <main className="main">
                    {children}
                </main>

                {/* User Profile Modal removed - now part of profile page */}
            </div>

            <style jsx>{`
                .mode-toggle {
                    display: flex;
                    background: var(--color-paper);
                    border: 1px solid var(--color-paper-warm);
                    padding: 4px;
                }
                .mode-btn {
                    width: 100px;
                    padding: 0.5rem 0;
                    font-size: 0.8125rem;
                    font-weight: 500;
                    background: transparent;
                    border: none;
                    color: var(--color-ink-muted);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    text-align: center;
                }
                .mode-btn.active {
                    background: var(--color-ink);
                    color: var(--color-cream);
                }
                .mode-btn:hover:not(.active) {
                    color: var(--color-ink);
                }
                .profile-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: none;
                    border: none;
                    padding: 0.5rem;
                    cursor: pointer;
                    color: var(--color-stone);
                    transition: color 0.2s ease;
                }
                .profile-btn:hover {
                    color: var(--color-ink);
                }
            `}</style>
        </DashboardContext.Provider>
    );
}
