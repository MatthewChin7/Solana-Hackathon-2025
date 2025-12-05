import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";



const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL!;

export interface StrategyData {
    publicKey: string;
    strategyId: string;
    apiId: string;
    creator: string;
    strategyMint: string;
    paymentMint: string;
    listed: boolean;
    listPrice: number;
    seller: string;
    lastMidBps: number;
    lastUpdateTs: number;
}

export interface MarketplaceStats {
    totalStrategies: number;
    listedStrategies: number;
    totalVolume: number;
    avgPerformance: string;
}

export class FrontendSolanaClient {
    connection: Connection;

    constructor() {
        this.connection = new Connection(RPC_URL, "confirmed");
    }

    // Fetch all strategies from backend API
    async getAllStrategies(): Promise<StrategyData[]> {
        try {
            const res = await fetch(`/api/strategies`);
            if (!res.ok) throw new Error("Failed to fetch strategies");
            return await res.json();
        } catch (e) {
            console.error("Error fetching strategies:", e);
            return [];
        }
    }

    // Fetch single strategy from backend API
    async getStrategy(pubkey: string): Promise<StrategyData | null> {
        try {
            const res = await fetch(`/api/strategies/${pubkey}`);
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            console.error("Error fetching strategy:", e);
            return null;
        }
    }

    // Fetch marketplace stats from backend API
    async getMarketplaceStats(): Promise<MarketplaceStats> {
        try {
            const res = await fetch(`/api/stats`);
            if (!res.ok) throw new Error("Failed to fetch stats");
            return await res.json();
        } catch (e) {
            console.error("Error fetching stats:", e);
            return {
                totalStrategies: 0,
                listedStrategies: 0,
                totalVolume: 0,
                avgPerformance: "0",
            };
        }
    }

    // Check NFT balance via backend API
    async checkNftBalance(wallet: string, mint: string): Promise<{ balance: number; hasAccess: boolean }> {
        try {
            const res = await fetch(`/api/nft-balance/${wallet}/${mint}`);
            if (!res.ok) throw new Error("Failed to check balance");
            return await res.json();
        } catch (e) {
            console.error("Error checking NFT balance:", e);
            return { balance: 0, hasAccess: false };
        }
    }

    // Direct on-chain NFT balance check (fallback)
    async getNftBalance(owner: PublicKey, mint: PublicKey): Promise<number> {
        try {
            const ata = await getAssociatedTokenAddress(mint, owner);
            const account = await getAccount(this.connection, ata);
            return Number(account.amount);
        } catch (e) {
            return 0;
        }
    }
}

// Singleton instance
export const solanaClient = new FrontendSolanaClient();
