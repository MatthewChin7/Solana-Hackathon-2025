import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StrategyMarketplace } from "../target/types/strategy_marketplace";
import {
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
  getAccount,
  createAssociatedTokenAccount,
} from "@solana/spl-token";
import { expect } from "chai";

describe("strategy_marketplace", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .StrategyMarketplace as Program<StrategyMarketplace>;
  const connection = provider.connection;

  let creator: Keypair;
  let buyer: Keypair;
  let paymentMint: PublicKey;
  let strategyId: anchor.BN;
  let strategyHash: number[];
  let apiId: number[];
  let strategyPda: PublicKey;
  let strategyMintPda: PublicKey;

  const DECIMALS = 6;
  const MINT_AMOUNT = 1_000_000_000;
  const LIST_PRICE = 100_000; // 0.1 tokens (6 decimals)

  before(async () => {
    creator = Keypair.generate();
    buyer = Keypair.generate();

    const airdrop1 = await connection.requestAirdrop(
      creator.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    const airdrop2 = await connection.requestAirdrop(
      buyer.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(airdrop1);
    await connection.confirmTransaction(airdrop2);

    paymentMint = await createMint(
      connection,
      creator,
      creator.publicKey,
      null,
      DECIMALS
    );

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

    strategyId = new anchor.BN(1);
    strategyHash = Array.from(
      anchor.utils.sha256(Buffer.from("polymarket-strategy-v1"))
    ).slice(0, 32);
    // Convert api_id string to fixed 32-byte array
    const apiIdBytes = Buffer.from("strategy-1");
    const apiIdArray = new Array(32).fill(0);
    apiIdBytes.copy(Buffer.from(apiIdArray), 0);
    apiId = apiIdArray;

    const [strategyPdaKey, strategyBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("strategy"),
        creator.publicKey.toBuffer(),
        strategyId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    strategyPda = strategyPdaKey;

    const [strategyMintPdaKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("strategy_mint"), strategyPda.toBuffer()],
      program.programId
    );
    strategyMintPda = strategyMintPdaKey;
  });

  it("Creates a strategy", async () => {
    const creatorNftAta = await getAssociatedTokenAddress(
      strategyMintPda,
      creator.publicKey
    );

    const tx = await program.methods
      .createStrategy(
        strategyId,
        strategyHash,
        apiId
      )
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

    const strategyAccount = await program.account.strategy.fetch(strategyPda);
    expect(strategyAccount.creator.toString()).to.equal(
      creator.publicKey.toString()
    );
    expect(strategyAccount.strategyMint.toString()).to.equal(
      strategyMintPda.toString()
    );
    expect(strategyAccount.paymentMint.toString()).to.equal(
      paymentMint.toString()
    );
    expect(strategyAccount.listed).to.be.false;
    expect(strategyAccount.listPrice.toNumber()).to.equal(0);
    expect(strategyAccount.seller.toString()).to.equal(
      creator.publicKey.toString()
    );
    expect(Array.from(strategyAccount.strategyHash)).to.deep.equal(strategyHash);
    expect(strategyAccount.apiId).to.include("strategy-1");
    expect(strategyAccount.lastMidBps).to.equal(0);
    expect(strategyAccount.lastUpdateTs.toNumber()).to.equal(0);

    const nftAccount = await getAccount(connection, creatorNftAta);
    expect(Number(nftAccount.amount)).to.equal(1);
  });

  it("Lists a strategy", async () => {
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

    const strategyAccount = await program.account.strategy.fetch(strategyPda);
    expect(strategyAccount.listed).to.be.true;
    expect(strategyAccount.listPrice.toNumber()).to.equal(LIST_PRICE);
    expect(strategyAccount.seller.toString()).to.equal(
      creator.publicKey.toString()
    );

    const escrowAccount = await getAccount(connection, escrowNftAta);
    expect(Number(escrowAccount.amount)).to.equal(1);

    const sellerAccount = await getAccount(connection, sellerNftAta);
    expect(Number(sellerAccount.amount)).to.equal(0);
  });

  it("Buys a strategy", async () => {
    const buyerNftAta = await getAssociatedTokenAddress(
      strategyMintPda,
      buyer.publicKey
    );
    const buyerPaymentAta = await getAssociatedTokenAddress(
      paymentMint,
      buyer.publicKey
    );
    const sellerPaymentAta = await getAssociatedTokenAddress(
      paymentMint,
      creator.publicKey
    );
    const escrowNftAta = await getAssociatedTokenAddress(
      strategyMintPda,
      strategyPda,
      true
    );

    const buyerBalanceBefore = await getAccount(connection, buyerPaymentAta);
    const sellerBalanceBefore = await getAccount(connection, sellerPaymentAta);

    const tx = await program.methods
      .buyStrategy()
      .accounts({
        buyer: buyer.publicKey,
        strategy: strategyPda,
        strategyMint: strategyMintPda,
        paymentMint: paymentMint,
        buyerPaymentAta: buyerPaymentAta,
        sellerPaymentAta: sellerPaymentAta,
        escrowNftAta: escrowNftAta,
        buyerNftAta: buyerNftAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    await connection.confirmTransaction(tx);

    const strategyAccount = await program.account.strategy.fetch(strategyPda);
    expect(strategyAccount.listed).to.be.false;
    expect(strategyAccount.listPrice.toNumber()).to.equal(0);
    expect(strategyAccount.seller.toString()).to.equal(
      buyer.publicKey.toString()
    );

    const buyerNftAccount = await getAccount(connection, buyerNftAta);
    expect(Number(buyerNftAccount.amount)).to.equal(1);

    const escrowAccount = await getAccount(connection, escrowNftAta);
    expect(Number(escrowAccount.amount)).to.equal(0);

    const buyerBalanceAfter = await getAccount(connection, buyerPaymentAta);
    const sellerBalanceAfter = await getAccount(connection, sellerPaymentAta);

    expect(
      Number(buyerBalanceBefore.amount) - Number(buyerBalanceAfter.amount)
    ).to.equal(LIST_PRICE);
    expect(
      Number(sellerBalanceAfter.amount) - Number(sellerBalanceBefore.amount)
    ).to.equal(LIST_PRICE);
  });

  it("Updates oracle", async () => {
    const midBps = 4500; // 0.45 * 10000
    const timestamp = new anchor.BN(Math.floor(Date.now() / 1000));

    const tx = await program.methods
      .updateOracle(midBps, timestamp)
      .accounts({
        authority: buyer.publicKey,
        strategy: strategyPda,
      })
      .signers([buyer])
      .rpc();

    await connection.confirmTransaction(tx);

    const strategyAccount = await program.account.strategy.fetch(strategyPda);
    expect(strategyAccount.lastMidBps).to.equal(midBps);
    expect(strategyAccount.lastUpdateTs.toNumber()).to.equal(
      timestamp.toNumber()
    );
  });
});

