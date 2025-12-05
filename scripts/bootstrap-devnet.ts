import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createMint,
  mintTo,
  createAssociatedTokenAccount,
  getMint,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";

const RPC_URL = "https://api.devnet.solana.com";
const DECIMALS = 6;
const MINT_AMOUNT = 1_000_000_000;
const LIST_PRICE = 100_000; // 0.1 tokens (6 decimals)
const STRATEGY_ID = 1;
const API_ID = "strategy-1";

async function main() {
  console.log("Starting devnet bootstrap...");

  const connection = new Connection(RPC_URL, "confirmed");

  const idlPath = path.join(__dirname, "../target/idl/strategy_marketplace.json");
  if (!fs.existsSync(idlPath)) {
    throw new Error(
      `IDL not found at ${idlPath}. Please run 'anchor build' first.`
    );
  }

  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const programId = new PublicKey(idl.metadata.address);

  const keysDir = path.join(__dirname, "../keys");
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }

  let creator: Keypair;
  let buyer: Keypair;

  const creatorPath = path.join(keysDir, "creator.json");
  const buyerPath = path.join(keysDir, "buyer.json");

  if (fs.existsSync(creatorPath) && fs.existsSync(buyerPath)) {
    console.log("Loading existing keypairs...");
    creator = Keypair.fromSecretKey(
      Buffer.from(JSON.parse(fs.readFileSync(creatorPath, "utf-8")))
    );
    buyer = Keypair.fromSecretKey(
      Buffer.from(JSON.parse(fs.readFileSync(buyerPath, "utf-8")))
    );
  } else {
    console.log("Generating new keypairs...");
    creator = Keypair.generate();
    buyer = Keypair.generate();

    fs.writeFileSync(creatorPath, JSON.stringify(Array.from(creator.secretKey)));
    fs.writeFileSync(buyerPath, JSON.stringify(Array.from(buyer.secretKey)));
  }

  console.log("Creator:", creator.publicKey.toString());
  console.log("Buyer:", buyer.publicKey.toString());

  const creatorBalance = await connection.getBalance(creator.publicKey);
  const buyerBalance = await connection.getBalance(buyer.publicKey);

  if (creatorBalance < 1 * anchor.web3.LAMPORTS_PER_SOL) {
    console.log("Requesting airdrop for creator...");
    const sig = await connection.requestAirdrop(
      creator.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig);
  }

  if (buyerBalance < 1 * anchor.web3.LAMPORTS_PER_SOL) {
    console.log("Requesting airdrop for buyer...");
    const sig = await connection.requestAirdrop(
      buyer.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(sig);
  }

  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(creator),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  const program = new anchor.Program(idl, programId, provider);

  console.log("Creating payment mint...");
  const paymentMint = await createMint(
    connection,
    creator,
    creator.publicKey,
    null,
    DECIMALS
  );
  console.log("Payment mint:", paymentMint.toString());

  const creatorPaymentAta = await getAssociatedTokenAddress(
    paymentMint,
    creator.publicKey
  );
  await createAssociatedTokenAccount(
    connection,
    creator,
    paymentMint,
    creator.publicKey
  );
  await mintTo(
    connection,
    creator,
    paymentMint,
    creatorPaymentAta,
    creator,
    MINT_AMOUNT
  );

  const buyerPaymentAta = await getAssociatedTokenAddress(
    paymentMint,
    buyer.publicKey
  );
  await createAssociatedTokenAccount(
    connection,
    creator,
    paymentMint,
    buyer.publicKey
  );
  await mintTo(
    connection,
    creator,
    paymentMint,
    buyerPaymentAta,
    creator,
    MINT_AMOUNT
  );

  const strategyId = new anchor.BN(STRATEGY_ID);
  const strategyHash = Array.from(
    createHash("sha256")
      .update("polymarket-strategy-v1")
      .digest()
  ).slice(0, 32);

  const [strategyPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("strategy"),
      creator.publicKey.toBuffer(),
      strategyId.toArrayLike(Buffer, "le", 8),
    ],
    programId
  );

  const [strategyMintPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("strategy_mint"), strategyPda.toBuffer()],
    programId
  );

  console.log("Strategy PDA:", strategyPda.toString());
  console.log("Strategy Mint PDA:", strategyMintPda.toString());

  const strategyAccount = await connection.getAccountInfo(strategyPda);
  if (!strategyAccount) {
    console.log("Creating strategy...");
    const creatorNftAta = await getAssociatedTokenAddress(
      strategyMintPda,
      creator.publicKey
    );

    const tx = await program.methods
      .createStrategy(strategyId, strategyHash, API_ID)
      .accounts({
        creator: creator.publicKey,
        strategy: strategyPda,
        strategyMint: strategyMintPda,
        creatorNftAta: creatorNftAta,
        paymentMint: paymentMint,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([creator])
      .rpc();

    await connection.confirmTransaction(tx);
    console.log("Strategy created:", tx);
  } else {
    console.log("Strategy already exists, skipping creation...");
  }

  const currentStrategy = await program.account.strategy.fetch(strategyPda);
  if (!currentStrategy.listed) {
    console.log("Listing strategy...");
    const sellerNftAta = await getAssociatedTokenAddress(
      strategyMintPda,
      creator.publicKey
    );
    const escrowNftAta = await getAssociatedTokenAddress(
      strategyMintPda,
      strategyPda,
      true
    );

    const tx = await program.methods
      .listStrategy(new anchor.BN(LIST_PRICE))
      .accounts({
        seller: creator.publicKey,
        strategy: strategyPda,
        strategyMint: strategyMintPda,
        sellerNftAta: sellerNftAta,
        escrowNftAta: escrowNftAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    await connection.confirmTransaction(tx);
    console.log("Strategy listed:", tx);
  } else {
    console.log("Strategy already listed, skipping listing...");
  }

  const buyerNftAta = await getAssociatedTokenAddress(
    strategyMintPda,
    buyer.publicKey
  );
  const buyerNftAccount = await connection.getAccountInfo(buyerNftAta);
  const buyerNftBalance = buyerNftAccount
    ? await connection.getTokenAccountBalance(buyerNftAta)
    : null;

  if (!buyerNftBalance || Number(buyerNftBalance.value.amount) === 0) {
    console.log("Buying strategy...");
    const escrowNftAta = await getAssociatedTokenAddress(
      strategyMintPda,
      strategyPda,
      true
    );

    const tx = await program.methods
      .buyStrategy()
      .accounts({
        buyer: buyer.publicKey,
        strategy: strategyPda,
        strategyMint: strategyMintPda,
        paymentMint: paymentMint,
        buyerPaymentAta: buyerPaymentAta,
        sellerPaymentAta: await getAssociatedTokenAddress(
          paymentMint,
          creator.publicKey
        ),
        escrowNftAta: escrowNftAta,
        buyerNftAta: buyerNftAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    await connection.confirmTransaction(tx);
    console.log("Strategy bought:", tx);
  } else {
    console.log("Buyer already owns strategy NFT, skipping purchase...");
  }

  const configDir = path.join(__dirname, "../config");
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const addressesJson = {
    creator: creator.publicKey.toString(),
    buyer: buyer.publicKey.toString(),
    paymentMint: paymentMint.toString(),
    strategy: strategyPda.toString(),
    strategyMint: strategyMintPda.toString(),
    programId: programId.toString(),
  };

  fs.writeFileSync(
    path.join(configDir, "addresses.json"),
    JSON.stringify(addressesJson, null, 2)
  );

  const serverEnvPath = path.join(__dirname, "../packages/server/.env");
  const serverEnvDir = path.dirname(serverEnvPath);
  if (!fs.existsSync(serverEnvDir)) {
    fs.mkdirSync(serverEnvDir, { recursive: true });
  }

  const serverEnv = `RPC_URL=${RPC_URL}
PROGRAM_ID=${programId.toString()}
STRATEGY_PUBKEY=${strategyPda.toString()}
STRATEGY_MINT=${strategyMintPda.toString()}
PAYMENT_MINT=${paymentMint.toString()}
API_ID=${API_ID}
POLYMARKET_TOKEN_ID=0x1234567890123456789012345678901234567890
PORT=4000
`;

  fs.writeFileSync(serverEnvPath, serverEnv);

  const frontendEnvPath = path.join(
    __dirname,
    "../packages/frontend/.env.local"
  );
  const frontendEnvDir = path.dirname(frontendEnvPath);
  if (!fs.existsSync(frontendEnvDir)) {
    fs.mkdirSync(frontendEnvDir, { recursive: true });
  }

  const frontendEnv = `NEXT_PUBLIC_RPC_URL=${RPC_URL}
NEXT_PUBLIC_PROGRAM_ID=${programId.toString()}
NEXT_PUBLIC_STRATEGY_PUBKEY=${strategyPda.toString()}
NEXT_PUBLIC_STRATEGY_MINT=${strategyMintPda.toString()}
NEXT_PUBLIC_PAYMENT_MINT=${paymentMint.toString()}
NEXT_PUBLIC_SERVER_URL=http://localhost:4000
`;

  fs.writeFileSync(frontendEnvPath, frontendEnv);

  console.log("\n=== Bootstrap Complete ===");
  console.log(JSON.stringify(addressesJson, null, 2));
  console.log("\nConfiguration files written:");
  console.log(`- ${serverEnvPath}`);
  console.log(`- ${frontendEnvPath}`);
  console.log(`- ${path.join(configDir, "addresses.json")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

