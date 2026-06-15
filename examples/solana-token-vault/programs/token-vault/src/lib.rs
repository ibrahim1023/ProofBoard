use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("Vau1t111111111111111111111111111111111111111");

#[program]
pub mod token_vault {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.admin = ctx.accounts.admin.key();
        vault.mint = ctx.accounts.mint.key();
        vault.paused = false;
        vault.total_deposited = 0;
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(!ctx.accounts.vault.paused, VaultError::Paused);
        require!(amount > 0, VaultError::ZeroAmount);
        if ctx.accounts.position.owner == Pubkey::default() {
            ctx.accounts.position.owner = ctx.accounts.user.key();
        }
        require_keys_eq!(
            ctx.accounts.position.owner,
            ctx.accounts.user.key(),
            VaultError::InvalidPositionOwner
        );

        token::transfer(ctx.accounts.transfer_to_vault(), amount)?;
        ctx.accounts.position.amount = ctx
            .accounts
            .position
            .amount
            .checked_add(amount)
            .ok_or(VaultError::ArithmeticOverflow)?;
        ctx.accounts.vault.total_deposited = ctx
            .accounts
            .vault
            .total_deposited
            .checked_add(amount)
            .ok_or(VaultError::ArithmeticOverflow)?;
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(!ctx.accounts.vault.paused, VaultError::Paused);
        require!(amount > 0, VaultError::ZeroAmount);
        require!(ctx.accounts.position.amount >= amount, VaultError::InsufficientEntitlement);

        let vault_key = ctx.accounts.vault.key();
        let authority_bump = ctx.bumps.vault_authority;
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"authority",
            vault_key.as_ref(),
            &[authority_bump],
        ]];

        token::transfer(
            ctx.accounts
                .transfer_to_user()
                .with_signer(signer_seeds),
            amount,
        )?;
        ctx.accounts.position.amount -= amount;
        ctx.accounts.vault.total_deposited -= amount;

        Ok(())
    }

    pub fn pause(ctx: Context<AdminAction>) -> Result<()> {
        ctx.accounts.vault.paused = true;
        Ok(())
    }

    pub fn unpause(ctx: Context<AdminAction>) -> Result<()> {
        ctx.accounts.vault.paused = false;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    pub mint: Account<'info, anchor_spl::token::Mint>,
    #[account(
        init,
        payer = admin,
        space = 8 + Vault::INIT_SPACE,
        seeds = [b"vault", mint.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    /// CHECK: PDA authority is validated by seeds and does not store data.
    #[account(seeds = [b"authority", vault.key().as_ref()], bump)]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        init,
        payer = admin,
        token::mint = mint,
        token::authority = vault_authority
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut, has_one = mint)]
    pub vault: Account<'info, Vault>,
    pub mint: Account<'info, anchor_spl::token::Mint>,
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + Position::INIT_SPACE,
        seeds = [b"position", vault.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub position: Account<'info, Position>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, token::mint = mint, token::authority = user)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut, token::mint = mint)]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut, has_one = mint, seeds = [b"vault", mint.key().as_ref()], bump)]
    pub vault: Account<'info, Vault>,
    pub mint: Account<'info, anchor_spl::token::Mint>,
    #[account(
        mut,
        seeds = [b"position", vault.key().as_ref(), user.key().as_ref()],
        bump,
        constraint = position.owner == user.key()
    )]
    pub position: Account<'info, Position>,
    pub user: Signer<'info>,
    #[account(mut, token::mint = mint, token::authority = user)]
    pub user_token_account: Account<'info, TokenAccount>,
    /// CHECK: PDA authority is constrained by seeds.
    #[account(seeds = [b"authority", vault.key().as_ref()], bump)]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(mut, token::mint = mint, token::authority = vault_authority)]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AdminAction<'info> {
    #[account(mut, has_one = admin)]
    pub vault: Account<'info, Vault>,
    pub admin: Signer<'info>,
}

impl<'info> Deposit<'info> {
    fn transfer_to_vault(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.user_token_account.to_account_info(),
                to: self.vault_token_account.to_account_info(),
                authority: self.user.to_account_info(),
            },
        )
    }
}

impl<'info> Withdraw<'info> {
    fn transfer_to_user(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.vault_token_account.to_account_info(),
                to: self.user_token_account.to_account_info(),
                authority: self.vault_authority.to_account_info(),
            },
        )
    }
}

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub admin: Pubkey,
    pub mint: Pubkey,
    pub paused: bool,
    pub total_deposited: u64,
}

#[account]
#[derive(InitSpace)]
pub struct Position {
    pub owner: Pubkey,
    pub amount: u64,
}

#[error_code]
pub enum VaultError {
    #[msg("Vault is paused")]
    Paused,
    #[msg("Amount must be non-zero")]
    ZeroAmount,
    #[msg("User entitlement is insufficient")]
    InsufficientEntitlement,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Position owner does not match signer")]
    InvalidPositionOwner,
}
