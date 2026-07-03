"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createPublicClient, formatUnits, http, type Address } from "viem";
import { celoMainnet, erc20BalanceAbi, goodDollarCelo } from "@/lib/celo";
import { featureModules } from "@/lib/modules";
import {
  createClaimSdk,
  createIdentitySdk,
  createPrivyWalletClient,
  formatGoodDollarAmount,
  goodDollarIdentityCallbackPath,
  identityCallbackUrl,
  type GoodDollarStatus,
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
  const [identityStatus, setIdentityStatus] = useState<GoodDollarStatus>("idle");
  const [claimStatus, setClaimStatus] = useState<GoodDollarStatus>("idle");
  const [goodDollarMessage, setGoodDollarMessage] = useState("Connect your wallet to check GoodDollar identity status.");
  const [claimableAmount, setClaimableAmount] = useState("—");
  const [nextClaimTime, setNextClaimTime] = useState<string | null>(null);

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



  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gooddollar") !== "identity-callback") return;

    const verified = params.get("isVerified");
    const reason = params.get("reason");
    if (verified === "true") {
      setIdentityStatus("success");
      setGoodDollarMessage("Face verification completed. Check entitlement, then claim your UBI.");
    } else if (verified === "false") {
      setIdentityStatus("error");
      setGoodDollarMessage(reason ? `Face verification failed: ${reason}` : "Face verification was not completed.");
    }
  }, []);

  async function checkIdentity() {
    if (!address || !wallet) return;
    setIdentityStatus("loading");
    setGoodDollarMessage("Checking GoodDollar identity whitelist...");

    try {
      const walletClient = await createPrivyWalletClient(wallet);
      const identitySdk = await createIdentitySdk(client, walletClient);
      const result = await identitySdk.getWhitelistedRoot(address);
      setIdentityStatus(result.isWhitelisted ? "success" : "idle");
      setGoodDollarMessage(
        result.isWhitelisted
          ? "Wallet is verified for GoodDollar UBI claims."
          : "Wallet is not verified yet. Start Face Verification to become eligible for UBI claims.",
      );
    } catch (error) {
      setIdentityStatus("error");
      setGoodDollarMessage(error instanceof Error ? error.message : "Unable to check GoodDollar identity.");
    }
  }

  async function startFaceVerification() {
    if (!wallet) return;
    setIdentityStatus("loading");
    setGoodDollarMessage("Generating GoodDollar Face Verification link...");

    try {
      const walletClient = await createPrivyWalletClient(wallet);
      const identitySdk = await createIdentitySdk(client, walletClient);
      const link = await identitySdk.generateFVLink(false, identityCallbackUrl(), celoMainnet.id);
      window.location.href = link;
    } catch (error) {
      setIdentityStatus("error");
      setGoodDollarMessage(error instanceof Error ? error.message : "Unable to start Face Verification.");
    }
  }

  async function checkEntitlement() {
    if (!address || !wallet) return;
    setClaimStatus("loading");
    setGoodDollarMessage("Checking daily GoodDollar UBI entitlement...");

    try {
      const walletClient = await createPrivyWalletClient(wallet);
      const identitySdk = await createIdentitySdk(client, walletClient);
      const claimSdk = await createClaimSdk(address, client, walletClient, identitySdk);
      const entitlement = await claimSdk.checkEntitlement();
      setClaimableAmount(formatGoodDollarAmount(entitlement));

      if (claimSdk.nextClaimTime) {
        const nextClaim = await claimSdk.nextClaimTime();
        setNextClaimTime(nextClaim.toLocaleString());
      }

      setClaimStatus("success");
      setGoodDollarMessage(entitlement > 0n ? "UBI is available. You can claim now." : "No UBI is available yet. Check the next claim time.");
    } catch (error) {
      setClaimStatus("error");
      setGoodDollarMessage(error instanceof Error ? error.message : "Unable to check UBI entitlement.");
    }
  }

  async function claimUbi() {
    if (!address || !wallet) return;
    setClaimStatus("loading");
    setGoodDollarMessage("Submitting GoodDollar UBI claim...");

    try {
      const walletClient = await createPrivyWalletClient(wallet);
      const identitySdk = await createIdentitySdk(client, walletClient);
      const claimSdk = await createClaimSdk(address, client, walletClient, identitySdk);
      await claimSdk.claim();
      setClaimStatus("success");
      setGoodDollarMessage("UBI claim submitted successfully. Refresh the balance after the transaction settles.");
    } catch (error) {
      setClaimStatus("error");
      setGoodDollarMessage(error instanceof Error ? error.message : "Unable to claim UBI.");
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
          <p className="eyebrow">Option B: Custom GoodDollar flow</p>
          <h2>Verify identity and claim UBI</h2>
          <p>Check whether this wallet is whitelisted, complete GoodDollar Face Verification when needed, then claim the daily UBI entitlement directly from your MarketPlace Hub wallet.</p>
          <small>Face Verification returns to <code>{goodDollarIdentityCallbackPath}</code>.</small>
        </div>
        <div className="gooddollar-actions">
          <button onClick={checkIdentity} disabled={identityStatus === "loading" || !address}>Check Identity</button>
          <button onClick={startFaceVerification} disabled={identityStatus === "loading" || !address}>Start Face Verification</button>
          <button onClick={checkEntitlement} disabled={claimStatus === "loading" || !address}>Check UBI</button>
          <button onClick={claimUbi} disabled={claimStatus === "loading" || !address}>Claim UBI</button>
        </div>
        <div className="gooddollar-status">
          <span>Claimable amount</span><strong>{claimableAmount}</strong>
          {nextClaimTime ? <><span>Next claim time</span><strong>{nextClaimTime}</strong></> : null}
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
