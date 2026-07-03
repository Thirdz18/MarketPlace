"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createPublicClient, formatUnits, http, type Address } from "viem";
import { celoMainnet, erc20BalanceAbi, goodDollarCelo } from "@/lib/celo";
import { featureModules } from "@/lib/modules";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export function AppShell({ privyConfigured }: { privyConfigured: boolean }) {
  if (!privyConfigured) return <SetupMode />;
  return <WalletApp />;
}

function SetupMode() {
  return (
    <main className="page"><Hero />
      <section className="panel warning"><h2>Environment setup needed</h2><p>Add <code>NEXT_PUBLIC_PRIVY_APP_ID</code>, <code>NEXT_PUBLIC_SUPABASE_URL</code>, and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable wallet onboarding and offchain data.</p></section>
      <FeatureGrid />
    </main>
  );
}

function WalletApp() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const address = wallet?.address as Address | undefined;
  const [balance, setBalance] = useState<string>("—");
  const [tapPoints, setTapPoints] = useState(0);
  const [profileStatus, setProfileStatus] = useState("Waiting for wallet...");

  const client = useMemo(() => createPublicClient({ chain: celoMainnet, transport: http() }), []);

  useEffect(() => {
    if (!address) return;
    const walletAddress = address;
    let cancelled = false;
    async function loadBalance() {
      try {
        const raw = await client.readContract({ address: goodDollarCelo.address, abi: erc20BalanceAbi, functionName: "balanceOf", args: [walletAddress] });
        if (!cancelled) setBalance(formatUnits(raw, goodDollarCelo.decimals));
      } catch {
        if (!cancelled) setBalance("Unavailable");
      }
    }
    loadBalance();
    return () => { cancelled = true; };
  }, [address, client]);

  useEffect(() => {
    if (!authenticated || !address || !user) return;
    if (!isSupabaseConfigured || !supabase) { setProfileStatus("Supabase not configured; wallet session is local only."); return; }
    const walletAddress = address;
    const privyUserId = user.id;
    let cancelled = false;
    async function upsertProfile() {
      const { error } = await supabase!.from("profiles").upsert({ privy_user_id: privyUserId, wallet_address: walletAddress, preferred_chain_id: celoMainnet.id, updated_at: new Date().toISOString() }, { onConflict: "privy_user_id" });
      if (!cancelled) setProfileStatus(error ? `Profile sync failed: ${error.message}` : "Supabase profile synced.");
    }
    upsertProfile();
    return () => { cancelled = true; };
  }, [authenticated, address, user]);

  if (!ready) return <main className="page"><Hero /><section className="panel">Loading Privy...</section></main>;

  if (!authenticated) {
    return <main className="page"><Hero /><section className="cta"><button onClick={login}>Get Started — Create Celo Wallet</button><p>Privy will create or connect a wallet, then unlock your mini app dashboard.</p></section><FeatureGrid /></main>;
  }

  return (
    <main className="page">
      <nav className="topbar"><strong>MarketPlace Hub</strong><button className="ghost" onClick={logout}>Logout</button></nav>
      <section className="dashboard">
        <div><p className="eyebrow">Powered by Celo Network + G$</p><h1>Your wallet hub is ready.</h1><p>Build minigames now, then add savings, daily tasks, airtime/data, and G$ rewards without redesigning the app.</p></div>
        <div className="wallet-card"><span>Wallet</span><strong>{address ?? "No wallet detected"}</strong><span>G$ Balance on Celo</span><strong>{balance}</strong><small>{profileStatus}</small></div>
      </section>
      <section id="minigames" className="panel"><h2>Tap-to-Earn MVP</h2><p>Offchain demo points are tracked in the UI first; connect this to Supabase limits and leaderboard next.</p><button onClick={() => setTapPoints((p) => p + 1)}>Tap for points</button><strong className="points">{tapPoints} points</strong></section>
      <FeatureGrid />
    </main>
  );
}

function Hero() { return <section className="hero"><p className="eyebrow">Celo + GoodDollar mini app platform</p><h1>Welcome to MarketPlace Hub</h1><p>Play, save, complete tasks, and grow future utility around your Privy wallet and G$ balance.</p></section>; }
function FeatureGrid() { return <section className="grid">{featureModules.map((m) => <article className="card" key={m.title}><span>{m.status}</span><h3>{m.title}</h3><p>{m.description}</p></article>)}</section>; }
