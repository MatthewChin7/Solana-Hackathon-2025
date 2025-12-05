import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  Keypair,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

let program: anchor.Program | null = null;
let connection: Connection | null = null;

export async function getProgram(): Promise<anchor.Program> {
  if (program) {
    return program;
  }

  const rpcUrl = process.env.RPC_URL || "https://api.devnet.solana.com";
  connection = new Connection(rpcUrl, "confirmed");

  const programId = new PublicKey(
    process.env.PROGRAM_ID || "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"
  );

  const idlPath = path.join(
    __dirname,
    "../../../target/idl/strategy_marketplace.json"
  );
  if (!fs.existsSync(idlPath)) {
    throw new Error(
      `IDL not found at ${idlPath}. Please run 'anchor build' first.`
    );
  }

  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

  const dummyKeypair = Keypair.generate();
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(dummyKeypair),
    { commitment: "confirmed" }
  );

  program = new anchor.Program(idl, programId, provider);
  return program;
}

export async function getStrategyAccount(): Promise<any> {
  const program = await getProgram();
  const strategyPubkey = new PublicKey(
    process.env.STRATEGY_PUBKEY ||
      "11111111111111111111111111111111"
  );

  try {
    const account = await program.account.strategy.fetch(strategyPubkey);
    return account;
  } catch (error) {
    console.error("Error fetching strategy account:", error);
    throw error;
  }
}

export async function getNftBalance(
  owner: PublicKey
): Promise<number> {
  const strategyMint = new PublicKey(
    process.env.STRATEGY_MINT ||
      "11111111111111111111111111111111"
  );

  try {
    const ata = await getAssociatedTokenAddress(strategyMint, owner);
    const account = await getAccount(
      connection || new Connection(process.env.RPC_URL || "https://api.devnet.solana.com"),
      ata
    );
    return Number(account.amount);
  } catch (error) {
    return 0;
  }
}

