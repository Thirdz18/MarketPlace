"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createPublicClient, formatUnits, http, type Address } from "viem";
import { celoMainnet, erc20BalanceAbi, goodDollarCelo } from "@/lib/celo";
import { featureModules } from "@/lib/modules";
import {
  createPrivyWalletClient,
  formatGoodDollarAmount,
  goodDollarIdentityAbi,
  goodDollarIdentityCelo,
  ubiSchemeAbi,
  ubiSchemeCelo,
  type GoodDollarStatus,
  zeroAddress,
} from "@/lib/gooddollar";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export function AppShell({ privyConfigured }: { privyConfigured: boolean }) {
  if (!privyConfigured) return <SetupMode />;
  return <WalletApp />;
}

function SetupMode() {
  return (
    <main className="page"><Hero />
      <section className="panel warning"><h2>Environment setup needed</h2><p>Add <code>NEXT_PUBLIC_PRIVY_APP_ID</code>, <code>NEXT_PUBLIC_SUPABASE_URL</code>, and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable wallet onboarding and offchain data. Email, Google, and wallet login are configured in the Privy dashboard; no client secret or client ID belongs in this frontend.</p></section>
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
  const [claimStatus, setClaimStatus] = useState<GoodDollarStatus>("idle");
  const [goodDollarMessage, setGoodDollarMessage] = useState("Click the button to load your daily UBI amount from the GoodDollar contract.");
  const [claimableAmount, setClaimableAmount] = useState("—");

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



  async function claimUbi() {
    if (!address || !wallet) return;
    setClaimStatus("loading");
    setGoodDollarMessage("Loading your claimable UBI from the GoodDollar contract...");

    try {
      const rootAddress = await client.readContract({
        address: goodDollarIdentityCelo.address,
        abi: goodDollarIdentityAbi,
        functionName: "getWhitelistedRoot",
        args: [address],
      });

      if (rootAddress === zeroAddress) {
        setClaimableAmount("—");
        setClaimStatus("error");
        setGoodDollarMessage("This wallet is not verified for GoodDollar UBI yet. Verify your GoodDollar identity in GoodWallet/GoodDapp, then come back and claim here.");
        return;
      }

      const entitlement = await client.readContract({
        address: ubiSchemeCelo.address,
        abi: ubiSchemeAbi,
        functionName: "checkEntitlement",
        args: [rootAddress],
      });
      setClaimableAmount(formatGoodDollarAmount(entitlement));

      if (entitlement <= 0n) {
        setClaimStatus("success");
        setGoodDollarMessage("No UBI is claimable right now. Please try again after the next daily claim window.");
        return;
      }

      setGoodDollarMessage(`Claimable now: ${formatGoodDollarAmount(entitlement)}. Please confirm the transaction in your wallet.`);
      const walletClient = await createPrivyWalletClient(wallet);
      const hash = await walletClient.writeContract({
        address: ubiSchemeCelo.address,
        abi: ubiSchemeAbi,
        functionName: "claim",
        account: address,
        chain: celoMainnet,
      });

      setGoodDollarMessage(`UBI claim submitted. Transaction: ${hash}`);
      setClaimStatus("success");
    } catch (error) {
      setClaimStatus("error");
      const message = error instanceof Error ? error.message : "Unable to claim UBI.";
      setGoodDollarMessage(
        message.includes("not whitelisted")
          ? "This wallet is not verified for GoodDollar UBI yet. Verify your GoodDollar identity in GoodWallet/GoodDapp, then come back and claim here."
          : message,
      );
    }
  }

  if (!ready) return <main className="page"><Hero /><section className="panel">Loading Privy...</section></main>;

  if (!authenticated) {
    return <main className="page"><Hero /><section className="cta"><button onClick={login}>Get Started — Create Celo Wallet</button><p>Sign in with email, Google, or connect an existing wallet. Privy will create a Celo-ready embedded wallet for users who do not already have one, then unlock your mini app dashboard.</p></section><FeatureGrid /></main>;
  }

  return (
    <main className="page">
      <nav className="topbar"><strong>MarketPlace Hub</strong><button className="ghost" onClick={logout}>Logout</button></nav>
      <section className="dashboard">
        <div><p className="eyebrow">Powered by Celo Network + G$</p><h1>Your wallet hub is ready.</h1><p>Build minigames now, then add savings, daily tasks, airtime/data, and G$ rewards without redesigning the app.</p></div>
        <div className="wallet-card"><span>Wallet</span><strong>{address ?? "No wallet detected"}</strong><span>G$ Balance on Celo</span><strong>{balance}</strong><small>{profileStatus}</small></div>
      </section>
      <section id="gooddollar-ubi" className="panel gooddollar-panel">
        <div>
          <p className="eyebrow">GoodDollar UBI</p>
          <h2>Claim UBI daily</h2>
          <p>Claim your daily GoodDollar UBI directly from the Celo UBI contract.</p>
          <small>Claim UBI daily.</small>
        </div>
        <div className="gooddollar-actions single-action">
          <button onClick={claimUbi} disabled={claimStatus === "loading" || !address}>
            {claimStatus === "loading" ? "Loading UBI..." : "Claim UBI daily"}
          </button>
        </div>
        <div className="gooddollar-status">
          <span>Claimable amount</span><strong>{claimableAmount}</strong>
          <small>{goodDollarMessage}</small>
        </div>
      </section>
      <section id="minigames" className="panel"><h2>Tap-to-Earn MVP</h2><p>Offchain demo points are tracked in the UI first; connect this to Supabase limits and leaderboard next.</p><button onClick={() => setTapPoints((p) => p + 1)}>Tap for points</button><strong className="points">{tapPoints} points</strong></section>
      <FeatureGrid />
    </main>
  );
}

function Hero() { return <section className="hero"><p className="eyebrow">Celo + GoodDollar mini app platform</p><h1>Welcome to MarketPlace Hub</h1><p>Play, save, complete tasks, and grow future utility around your Privy wallet and G$ balance.</p></section>; }
function FeatureGrid() { return <section className="grid">{featureModules.map((m) => <article className="card" key={m.title}><span>{m.status}</span><h3>{m.title}</h3><p>{m.description}</p></article>)}</section>; }
