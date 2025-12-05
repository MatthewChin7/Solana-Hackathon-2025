import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

let program: anchor.Program | null = null;
let connection: Connection | null = null;

export function getConnection(): Connection {
  if (connection) {
    return connection;
  }

  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
  connection = new Connection(rpcUrl, "confirmed");
  return connection;
}

export async function getProgram(): Promise<anchor.Program> {
  if (program) {
    return program;
  }

  const programId = new PublicKey(
    process.env.NEXT_PUBLIC_PROGRAM_ID ||
      "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"
  );

  let idl: anchor.Idl;
  try {
    if (typeof window === "undefined") {
      const idlPath = path.join(
        process.cwd(),
        "idl/strategy_marketplace.json"
      );
      const idlJson = fs.readFileSync(idlPath, "utf-8");
      idl = JSON.parse(idlJson);
    } else {
      const response = await fetch("/idl/strategy_marketplace.json");
      idl = await response.json();
    }
  } catch (error) {
    throw new Error(
      `Failed to load IDL. Please ensure the IDL file exists at idl/strategy_marketplace.json`
    );
  }

  const conn = getConnection();
  const provider = new anchor.AnchorProvider(
    conn,
    {} as anchor.Wallet,
    { commitment: "confirmed" }
  );

  program = new anchor.Program(
    idl as anchor.Idl,
    programId,
    provider
  ) as anchor.Program;
  return program;
}

export async function getStrategy(): Promise<any> {
  const program = await getProgram();
  const strategyPubkey = new PublicKey(
    process.env.NEXT_PUBLIC_STRATEGY_PUBKEY ||
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

export async function getNftBalance(owner: PublicKey): Promise<number> {
  const strategyMint = new PublicKey(
    process.env.NEXT_PUBLIC_STRATEGY_MINT ||
      "11111111111111111111111111111111"
  );

  try {
    const conn = getConnection();
    const ata = await getAssociatedTokenAddress(strategyMint, owner);
    const account = await getAccount(conn, ata);
    return Number(account.amount);
  } catch (error) {
    return 0;
  }
}

