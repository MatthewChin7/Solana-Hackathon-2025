use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, Mint, MintTo, Token, TokenAccount, Transfer},
};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod strategy_marketplace {
    use super::*;

    pub fn create_strategy(
        ctx: Context<CreateStrategy>,
        strategy_id: u64,
        strategy_hash: [u8; 32],
        api_id: String,
    ) -> Result<()> {
        let strategy = &mut ctx.accounts.strategy;
        let strategy_mint = &ctx.accounts.strategy_mint;
        let creator = &ctx.accounts.creator;

        strategy.creator = creator.key();
        strategy.strategy_mint = strategy_mint.key();
        strategy.payment_mint = ctx.accounts.payment_mint.key();
        strategy.listed = false;
        strategy.list_price = 0;
        strategy.seller = creator.key();
        strategy.strategy_hash = strategy_hash;
        strategy.api_id = api_id;
        strategy.last_mid_bps = 0;
        strategy.last_update_ts = 0;
        strategy.strategy_id = strategy_id;
        strategy.bump = ctx.bumps.strategy;

        let seeds = &[
            b"strategy_mint",
            strategy.key().as_ref(),
            &[ctx.bumps.strategy_mint],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.strategy_mint.to_account_info(),
            to: ctx.accounts.creator_nft_ata.to_account_info(),
            authority: ctx.accounts.strategy.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        mint_to(cpi_ctx, 1)?;

        Ok(())
    }

    pub fn list_strategy(ctx: Context<ListStrategy>, list_price: u64) -> Result<()> {
        let strategy = &mut ctx.accounts.strategy;
        let seller_nft_ata = &ctx.accounts.seller_nft_ata;

        require!(
            seller_nft_ata.amount == 1,
            ErrorCode::NotNftHolder
        );

        require!(list_price > 0, ErrorCode::InvalidAmount);

        let cpi_accounts = Transfer {
            from: ctx.accounts.seller_nft_ata.to_account_info(),
            to: ctx.accounts.escrow_nft_ata.to_account_info(),
            authority: ctx.accounts.seller.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        anchor_spl::token::transfer(cpi_ctx, 1)?;

        strategy.listed = true;
        strategy.list_price = list_price;
        strategy.seller = ctx.accounts.seller.key();

        Ok(())
    }

    pub fn buy_strategy(ctx: Context<BuyStrategy>) -> Result<()> {
        let strategy = &mut ctx.accounts.strategy;

        require!(strategy.listed == true, ErrorCode::StrategyNotListed);

        let buyer_payment_ata = &ctx.accounts.buyer_payment_ata;
        require!(
            buyer_payment_ata.amount >= strategy.list_price,
            ErrorCode::InsufficientPaymentBalance
        );

        let payment_cpi_accounts = Transfer {
            from: ctx.accounts.buyer_payment_ata.to_account_info(),
            to: ctx.accounts.seller_payment_ata.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        };
        let payment_cpi_program = ctx.accounts.token_program.to_account_info();
        let payment_cpi_ctx = CpiContext::new(payment_cpi_program, payment_cpi_accounts);
        anchor_spl::token::transfer(payment_cpi_ctx, strategy.list_price)?;

        let nft_seeds = &[
            b"strategy",
            strategy.creator.as_ref(),
            &strategy.strategy_id.to_le_bytes(),
            &[strategy.bump],
        ];
        let nft_signer = &[&nft_seeds[..]];

        let nft_cpi_accounts = Transfer {
            from: ctx.accounts.escrow_nft_ata.to_account_info(),
            to: ctx.accounts.buyer_nft_ata.to_account_info(),
            authority: ctx.accounts.strategy.to_account_info(),
        };
        let nft_cpi_program = ctx.accounts.token_program.to_account_info();
        let nft_cpi_ctx = CpiContext::new_with_signer(nft_cpi_program, nft_cpi_accounts, nft_signer);
        anchor_spl::token::transfer(nft_cpi_ctx, 1)?;

        strategy.listed = false;
        strategy.list_price = 0;
        strategy.seller = ctx.accounts.buyer.key();

        Ok(())
    }

    pub fn update_oracle(
        ctx: Context<UpdateOracle>,
        mid_bps: u32,
        timestamp: i64,
    ) -> Result<()> {
        let strategy = &mut ctx.accounts.strategy;

        strategy.last_mid_bps = mid_bps;
        strategy.last_update_ts = timestamp;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(strategy_id: u64, strategy_hash: [u8; 32], api_id: String)]
pub struct CreateStrategy<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + Strategy::LEN,
        seeds = [b"strategy", creator.key().as_ref(), &strategy_id.to_le_bytes()],
        bump
    )]
    pub strategy: Account<'info, Strategy>,

    #[account(
        init,
        payer = creator,
        seeds = [b"strategy_mint", strategy.key().as_ref()],
        bump,
        mint::decimals = 0,
        mint::authority = strategy,
        mint::freeze_authority = strategy,
    )]
    pub strategy_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = creator,
        associated_token::mint = strategy_mint,
        associated_token::authority = creator,
    )]
    pub creator_nft_ata: Account<'info, TokenAccount>,

    pub payment_mint: Account<'info, Mint>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ListStrategy<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(mut)]
    pub strategy: Account<'info, Strategy>,

    pub strategy_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = strategy_mint,
        associated_token::authority = seller,
    )]
    pub seller_nft_ata: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = seller,
        associated_token::mint = strategy_mint,
        associated_token::authority = strategy,
    )]
    pub escrow_nft_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyStrategy<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(mut)]
    pub strategy: Account<'info, Strategy>,

    pub strategy_mint: Account<'info, Mint>,

    pub payment_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = payment_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_payment_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = payment_mint,
        associated_token::authority = strategy.seller,
    )]
    pub seller_payment_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = strategy_mint,
        associated_token::authority = strategy,
    )]
    pub escrow_nft_ata: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = strategy_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_nft_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateOracle<'info> {
    pub authority: Signer<'info>,

    #[account(mut)]
    pub strategy: Account<'info, Strategy>,
}

#[account]
pub struct Strategy {
    pub creator: Pubkey,
    pub strategy_mint: Pubkey,
    pub payment_mint: Pubkey,
    pub listed: bool,
    pub list_price: u64,
    pub seller: Pubkey,
    pub strategy_hash: [u8; 32],
    pub api_id: String,
    pub last_mid_bps: u32,
    pub last_update_ts: i64,
    pub strategy_id: u64,
    pub bump: u8,
}

impl Strategy {
    pub const LEN: usize = 32 + // creator
        32 + // strategy_mint
        32 + // payment_mint
        1 + // listed
        8 + // list_price
        32 + // seller
        32 + // strategy_hash
        4 + // api_id string length prefix
        256 + // api_id string (max length)
        4 + // last_mid_bps
        8 + // last_update_ts
        8 + // strategy_id
        1; // bump
}

#[error_code]
pub enum ErrorCode {
    #[msg("Caller does not hold the Strategy NFT")]
    NotNftHolder,
    #[msg("Strategy is not currently listed for sale")]
    StrategyNotListed,
    #[msg("Insufficient payment token balance")]
    InsufficientPaymentBalance,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("NFT transfer failed")]
    NftTransferFailed,
}

