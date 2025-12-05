import type { NextApiRequest, NextApiResponse } from 'next';
import { SolanaClient } from '../../../lib/server/solanaClient';
import { mockStrategies } from '../../../lib/mockStrategyData';

const solanaClient = new SolanaClient();

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { id } = req.query;

    if (!id || Array.isArray(id)) {
        return res.status(400).json({ error: 'Invalid strategy ID' });
    }

    try {
        // 1. Check for Mock Data first
        const mockStrategy = mockStrategies.find(s => s.id === id);

        if (mockStrategy) {
            // Map mock data to StrategyData interface
            const strategyData = {
                publicKey: mockStrategy.id,
                strategyId: mockStrategy.id,
                apiId: mockStrategy.name,
                creator: mockStrategy.creator,
                strategyMint: "MockStrategyMint_" + mockStrategy.id,
                paymentMint: "MockPaymentMint_USDC",
                listed: mockStrategy.status === 'listed',
                listPrice: mockStrategy.listPrice,
                seller: mockStrategy.creator,
                lastMidBps: Math.floor(mockStrategy.returns["1M"] * 100), // Mock mid price from returns
                lastUpdateTs: Math.floor(Date.now() / 1000)
            };

            return res.status(200).json(strategyData);
        }

        // 2. Fetch from Solana if not mock
        const strategy = await solanaClient.getStrategy(id);

        if (!strategy) {
            return res.status(404).json({ error: 'Strategy not found' });
        }

        res.status(200).json(strategy);

    } catch (error: any) {
        console.error('API Strategy Fetch Error:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch strategy' });
    }
}
