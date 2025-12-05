import express from "express";
import * as dotenv from "dotenv";
import * as nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import { getCurrentSignal, updateFromPolymarket } from "./engine";
import { getNftBalance } from "./solanaClient";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;
const POLYMARKET_TOKEN_ID =
  process.env.POLYMARKET_TOKEN_ID || "0x1234567890123456789012345678901234567890";

function verifySignature(
  message: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Buffer.from(signature, "base64");
    const publicKeyBytes = new PublicKey(publicKey).toBytes();

    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    );
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

app.post("/signal", async (req, res) => {
  try {
    const { walletPubkey, signature, message } = req.body;

    if (!walletPubkey || !signature || !message) {
      return res.status(400).json({
        error: "Missing required fields: walletPubkey, signature, message",
      });
    }

    const configPath = path.join(__dirname, "../../../config/addresses.json");
    if (!fs.existsSync(configPath)) {
      return res.status(500).json({
        error: "Configuration not found. Please run bootstrap script.",
      });
    }

    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const expectedApiId = process.env.API_ID || "strategy-1";
    const expectedStrategyPubkey = process.env.STRATEGY_PUBKEY || config.strategy;

    if (
      !message.includes(expectedApiId) ||
      !message.includes(expectedStrategyPubkey)
    ) {
      return res.status(400).json({
        error: "Message does not contain required API_ID and STRATEGY_PUBKEY",
      });
    }

    if (!verifySignature(message, signature, walletPubkey)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const ownerPubkey = new PublicKey(walletPubkey);
    const balance = await getNftBalance(ownerPubkey);

    if (balance !== 1) {
      return res.status(403).json({
        error: "Wallet does not hold the Strategy NFT",
        balance,
      });
    }

    const signal = getCurrentSignal();
    if (!signal) {
      return res.status(503).json({
        error: "Signal not available. Engine may still be initializing.",
      });
    }

    res.json({
      apiId: signal.apiId,
      mid: signal.mid,
      signal: signal.signal,
      updatedAt: signal.updatedAt,
    });
  } catch (error) {
    console.error("Error in /signal endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/health", (req, res) => {
  const signal = getCurrentSignal();
  res.json({
    status: "ok",
    signalAvailable: signal !== null,
    signal: signal,
  });
});

async function startServer() {
  console.log("Starting server...");

  try {
    await updateFromPolymarket(POLYMARKET_TOKEN_ID);
  } catch (error) {
    console.error("Initial Polymarket update failed:", error);
    console.log("Server will continue, but signal may be unavailable");
  }

  setInterval(async () => {
    try {
      await updateFromPolymarket(POLYMARKET_TOKEN_ID);
    } catch (error) {
      console.error("Periodic Polymarket update failed:", error);
    }
  }, 60000);

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Polymarket token ID: ${POLYMARKET_TOKEN_ID}`);
    console.log("Signal updates every 60 seconds");
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

