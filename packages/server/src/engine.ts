import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

interface Signal {
  apiId: string;
  mid: number;
  signal: string;
  updatedAt: number;
}

let currentSignal: Signal | null = null;

export function getCurrentSignal(): Signal | null {
  return currentSignal;
}

export async function updateFromPolymarket(tokenId: string): Promise<void> {
  try {
    const apiKey = process.env.POLYMARKET_API_KEY;
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await axios.get(
      `https://clob.polymarket.com/midpoint?token_id=${tokenId}`,
      {
        headers,
        timeout: 10000,
      }
    );

    const mid = parseFloat(response.data.mid || response.data);
    if (isNaN(mid) || mid < 0 || mid > 1) {
      throw new Error(`Invalid mid price: ${mid}`);
    }

    const midBps = Math.round(mid * 10_000);

    let signal: string;
    if (mid < 0.45) {
      signal = "BUY_YES";
    } else if (mid > 0.55) {
      signal = "SELL_YES";
    } else {
      signal = "HOLD";
    }

    const configPath = path.join(__dirname, "../../../config/addresses.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const apiId = process.env.API_ID || "strategy-1";

    currentSignal = {
      apiId,
      mid,
      signal,
      updatedAt: Math.floor(Date.now() / 1000),
    };

    console.log(
      `[Engine] Updated signal: ${signal} (mid: ${mid.toFixed(4)}, mid_bps: ${midBps})`
    );
  } catch (error) {
    console.error("[Engine] Error updating from Polymarket:", error);
    throw error;
  }
}

