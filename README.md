# MarketPlace Hub

A Celo + GoodDollar powered mini app hub with Privy wallet onboarding and Supabase offchain data.

## MVP scope

- Intro landing page with a `Get Started` wallet onboarding call-to-action.
- Privy email/Google login with embedded wallet creation.
- Celo Mainnet and Celo Sepolia chain configuration.
- GoodDollar `G$` Celo token balance display.
- Supabase profile upsert after wallet login.
- Modular dashboard cards for minigames, savings, daily tasks, and airtime/data.
- Tap-to-Earn UI stub for the first minigame module.

## Environment variables

```bash
NEXT_PUBLIC_PRIVY_APP_ID=
NEXT_PUBLIC_PRIVY_CLIENT_ID= # optional for React web apps
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

`NEXT_PUBLIC_PRIVY_APP_ID` is required before the Privy modal is mounted. `NEXT_PUBLIC_PRIVY_CLIENT_ID` is optional for React web apps; if you use a client-specific configuration, find or create it in the Privy dashboard under **Configuration → App settings → Clients** and copy the web app client ID. Make sure your deployed origin is allowlisted and Google/email login is enabled, otherwise the Privy modal can show `Something went wrong` during account creation.

## Celo and G$ constants

- Celo Mainnet chain ID: `42220`
- Celo Mainnet RPC: `https://forno.celo.org`
- Celo Sepolia chain ID: `11142220`
- Celo Sepolia RPC: `https://forno.celo-sepolia.celo-testnet.org`
- GoodDollar G$ on Celo: `0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A`
- G$ decimals on Celo: `18`

## Supabase starter schema

```sql
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  privy_user_id text unique not null,
  wallet_address text not null,
  preferred_chain_id integer default 42220,
  g_balance_last_seen numeric,
  points integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```
