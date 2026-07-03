"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createPublicClient, formatUnits, http, type Address } from "viem";
import { ClaimPanel } from "@/components/dashboard/claim-panel";
import { PlaceholderPanel } from "@/components/dashboard/placeholder-panel";
import { Sidebar } from "@/components/dashboard/sidebar";
import { WalletPanel } from "@/components/dashboard/wallet-panel";
import { celoMainnet, erc20BalanceAbi, goodDollarCelo } from "@/lib/celo";
import { type DashboardModuleId } from "@/lib/modules";
import {
  createGoodIdFaceVerificationLink,
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
import { supportedWalletTokens, type TokenBalance } from "@/lib/tokens";
import { createSubmittedClaimTransaction, fetchGoodDollarTransactions, formatCeloBalance, type WalletTransaction } from "@/lib/transactions";

const GOODDOLLAR_CLAIM_WINDOW_UTC_HOUR = 12;
const GOODDOLLAR_CLAIM_WINDOW_PH_TIME = "8:00 PM Philippines time";

function getClaimCooldownStorageKey(address: Address) {
  return `marketplace:gooddollar-next-claim:${address.toLowerCase()}`;
}

function getNextGoodDollarClaimWindow(timestamp = Date.now()) {
  const nextWindow = new Date(timestamp);
  nextWindow.setUTCHours(GOODDOLLAR_CLAIM_WINDOW_UTC_HOUR, 0, 0, 0);

  if (nextWindow.getTime() <= timestamp) {
    nextWindow.setUTCDate(nextWindow.getUTCDate() + 1);
  }

  return nextWindow.getTime();
}

function formatNextClaimTime(timestamp: number) {
  const localTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp));
  const utcTime = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }).format(new Date(timestamp));

  return `${localTime} (${utcTime} / ${GOODDOLLAR_CLAIM_WINDOW_PH_TIME})`;
}

function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
}

export function AppShell({ privyConfigured }: { privyConfigured: boolean }) {
  if (!privyConfigured) return <SetupMode />;
  return <WalletApp />;
}

function SetupMode() {
  return (
    <main className="page"><Hero />
      <section className="panel warning"><h2>Environment setup needed</h2><p>Add <code>NEXT_PUBLIC_PRIVY_APP_ID</code>, <code>NEXT_PUBLIC_SUPABASE_URL</code>, and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable wallet onboarding and offchain data. Email, Google, and wallet login are configured in the Privy dashboard; no client secret or client ID belongs in this frontend.</p></section>
    </main>
  );
}

function WalletApp() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const address = wallet?.address as Address | undefined;
  const [activeModule, setActiveModule] = useState<DashboardModuleId>("wallet");
  const [gDollarBalance, setGDollarBalance] = useState<string>("—");
  const [celoBalance, setCeloBalance] = useState<string>("—");
  const [profileStatus, setProfileStatus] = useState("Waiting for wallet...");
  const [claimStatus, setClaimStatus] = useState<GoodDollarStatus>("idle");
  const [goodDollarMessage, setGoodDollarMessage] = useState("Click the button to load your daily UBI amount from the GoodDollar contract.");
  const [claimableAmount, setClaimableAmount] = useState("—");
  const [nextClaimAt, setNextClaimAt] = useState<number>();
  const [now, setNow] = useState(() => Date.now());
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string>();

  const client = useMemo(() => createPublicClient({ chain: celoMainnet, transport: http() }), []);
  const nextClaimTime = nextClaimAt && nextClaimAt > now ? formatNextClaimTime(nextClaimAt) : undefined;
  const nextClaimCountdown = nextClaimAt && nextClaimAt > now ? formatCountdown(nextClaimAt - now) : undefined;

  const clearSavedNextClaim = useCallback(() => {
    setNextClaimAt(undefined);
    if (address && typeof window !== "undefined") localStorage.removeItem(getClaimCooldownStorageKey(address));
  }, [address]);

  const saveNextClaim = useCallback((timestamp: number) => {
    setNextClaimAt(timestamp);
    if (address && typeof window !== "undefined") localStorage.setItem(getClaimCooldownStorageKey(address), timestamp.toString());
  }, [address]);

  const loadBalances = useCallback(async () => {
    if (!address) return;
    const [rawGoodDollar, rawCelo] = await Promise.all([
      client.readContract({ address: goodDollarCelo.address, abi: erc20BalanceAbi, functionName: "balanceOf", args: [address] }),
      client.getBalance({ address }),
    ]);
    setGDollarBalance(Number(formatUnits(rawGoodDollar, goodDollarCelo.decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 }));
    setCeloBalance(formatCeloBalance(rawCelo));
  }, [address, client]);

  const loadTransactions = useCallback(async () => {
    if (!address) return;
    setTransactionsLoading(true);
    setTransactionsError(undefined);
    try {
      setTransactions(await fetchGoodDollarTransactions(client, address));
    } catch (error) {
      setTransactionsError(error instanceof Error ? error.message : "Unable to load transaction history.");
    } finally {
      setTransactionsLoading(false);
    }
  }, [address, client]);

  const loadClaimableAmount = useCallback(async () => {
    if (!address) return undefined;

    const rootAddress = await client.readContract({ address: goodDollarIdentityCelo.address, abi: goodDollarIdentityAbi, functionName: "getWhitelistedRoot", args: [address] });

    if (rootAddress === zeroAddress) {
      setClaimStatus("unverified");
      setClaimableAmount("Not eligible yet");
      setGoodDollarMessage("Face verification is required before this wallet becomes eligible for GoodDollar UBI. Tap Verify face first, sign the GoodID request, complete face verification, then return here to claim.");
      return { entitlement: 0n, formattedEntitlement: "Not eligible yet", eligible: false } as const;
    }

    const entitlement = await client.readContract({ address: ubiSchemeCelo.address, abi: ubiSchemeAbi, functionName: "checkEntitlement", args: [rootAddress] });
    const formattedEntitlement = formatGoodDollarAmount(entitlement);

    if (entitlement > 0n) {
      clearSavedNextClaim();
      setClaimStatus("success");
      setClaimableAmount(formattedEntitlement);
      setGoodDollarMessage(`Claimable now: ${formattedEntitlement}.`);
    } else {
      const inferredNextClaimAt = getNextGoodDollarClaimWindow();

      if (nextClaimAt && nextClaimAt > Date.now()) {
        setClaimStatus("claimed");
        setClaimableAmount("Already claimed");
        setGoodDollarMessage("You already claimed today's GoodDollar UBI. The panel will unlock after the next daily claim window.");
      } else {
        saveNextClaim(inferredNextClaimAt);
        setClaimStatus("claimed");
        setClaimableAmount("Already claimed");
        setGoodDollarMessage("You already claimed today's GoodDollar UBI. GoodDollar resets daily at 12:00 PM UTC / 8:00 PM Philippines time.");
      }
    }

    return { entitlement, formattedEntitlement, eligible: true } as const;
  }, [address, clearSavedNextClaim, client, nextClaimAt, saveNextClaim]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!address || typeof window === "undefined") {
      setNextClaimAt(undefined);
      return;
    }

    const savedNextClaimAt = Number(localStorage.getItem(getClaimCooldownStorageKey(address)));
    setNextClaimAt(Number.isFinite(savedNextClaimAt) && savedNextClaimAt > Date.now() ? savedNextClaimAt : undefined);
  }, [address]);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    async function loadWalletData() {
      try {
        await loadBalances();
      } catch {
        if (!cancelled) { setGDollarBalance("Unavailable"); setCeloBalance("Unavailable"); }
      }
    }
    loadWalletData();
    return () => { cancelled = true; };
  }, [address, loadBalances]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  useEffect(() => {
    if (!address) {
      setClaimStatus("idle");
      setClaimableAmount("Connect wallet");
      setGoodDollarMessage("Connect your wallet to load your GoodDollar eligibility and daily UBI amount from the contract.");
      return;
    }

    let cancelled = false;
    async function loadClaimPreview() {
      setClaimStatus("loading");
      setGoodDollarMessage("Loading your claimable UBI from the GoodDollar contract...");
      try {
        await loadClaimableAmount();
      } catch (error) {
        if (!cancelled) {
          setClaimStatus("error");
          setClaimableAmount("Unavailable");
          setGoodDollarMessage(error instanceof Error ? error.message : "Unable to load your claimable UBI amount.");
        }
      }
    }

    loadClaimPreview();
    return () => { cancelled = true; };
  }, [address, loadClaimableAmount]);

  useEffect(() => {
    if (!authenticated || !address || !user) return;
    if (!isSupabaseConfigured || !supabase) { setProfileStatus("Supabase not configured; wallet session is local only."); return; }
    const walletAddress = address;
    const privyUserId = user.id;
    let cancelled = false;
    async function upsertProfile() {
      const { error } = await supabase!.from("profiles").upsert({ privy_user_id: privyUserId, wallet_address: walletAddress, preferred_chain_id: celoMainnet.id, updated_at: new Date().toISOString() }, { onConflict: "privy_user_id" });
      if (!cancelled) setProfileStatus(error ? `Profile sync unavailable: ${error.message}` : "Supabase profile synced.");
    }
    upsertProfile();
    return () => { cancelled = true; };
  }, [authenticated, address, user]);

  async function openFaceVerification() {
    if (!address || !wallet) return;
    setClaimStatus("loading");
    setGoodDollarMessage("Please sign the GoodID verification request in your wallet. You will be redirected to GoodID Face Verification automatically.");

    try {
      const walletClient = await createPrivyWalletClient(wallet);
      const callbackUrl = typeof window !== "undefined" ? window.location.href : undefined;
      const link = await createGoodIdFaceVerificationLink({ walletClient, callbackUrl, chainId: celoMainnet.id });

      setClaimStatus("unverified");
      setGoodDollarMessage("Redirecting to GoodID Face Verification. Finish verification, then return here and claim your daily UBI.");
      window.location.href = link;
    } catch (error) {
      setClaimStatus("unverified");
      setGoodDollarMessage(error instanceof Error ? error.message : "Unable to start GoodID Face Verification.");
    }
  }

  async function claimUbi() {
    if (!address || !wallet) return;
    setClaimStatus("loading");
    setGoodDollarMessage("Loading your claimable UBI from the GoodDollar contract...");

    try {
      const claimPreview = await loadClaimableAmount();

      if (!claimPreview) {
        setClaimStatus("error");
        return;
      }

      const { entitlement, formattedEntitlement, eligible } = claimPreview;

      if (!eligible) {
        setClaimStatus("unverified");
        return;
      }

      if (entitlement <= 0n) {
        setClaimStatus("claimed");
        setClaimableAmount("Already claimed");
        setGoodDollarMessage("No UBI is claimable right now. Please try again after the next daily claim window.");
        return;
      }

      setGoodDollarMessage(`Claimable now: ${formattedEntitlement}. Please confirm the transaction in your wallet.`);
      const walletClient = await createPrivyWalletClient(wallet);
      const hash = await walletClient.writeContract({ address: ubiSchemeCelo.address, abi: ubiSchemeAbi, functionName: "claim", account: address, chain: celoMainnet });

      setGoodDollarMessage(`UBI claim submitted. Transaction: ${hash}`);
      setTransactions((current) => [createSubmittedClaimTransaction(hash, formattedEntitlement), ...current]);
      setClaimableAmount("Already claimed");
      saveNextClaim(getNextGoodDollarClaimWindow());
      setClaimStatus("claimed");
      await Promise.allSettled([loadBalances(), loadTransactions()]);
    } catch (error) {
      setClaimStatus("error");
      const message = error instanceof Error ? error.message : "Unable to claim UBI.";
      if (message.includes("not whitelisted")) {
        setClaimStatus("unverified");
        setClaimableAmount("Not eligible yet");
        setGoodDollarMessage("Face verification is required before this wallet becomes eligible for GoodDollar UBI. Tap Verify face first, sign the GoodID request, complete face verification, then return here to claim.");
      } else {
        setGoodDollarMessage(message);
      }
    }
  }

  const isClaimActionDisabled = !address || claimStatus === "loading" || Boolean(nextClaimTime);

  const tokenBalances: TokenBalance[] = [
    { ...supportedWalletTokens[0], amount: gDollarBalance },
    { ...supportedWalletTokens[1], amount: celoBalance },
  ];

  if (!ready) return <main className="page"><Hero /><section className="panel">Loading Privy...</section></main>;

  if (!authenticated) {
    return <main className="page"><Hero /><section className="cta"><button onClick={login}>Get Started — Create Celo Wallet</button><p>Sign in with email, Google, or connect an existing wallet. Privy will create a Celo-ready embedded wallet for users who do not already have one, then unlock your mini app dashboard.</p></section></main>;
  }

  return (
    <main className="app-layout">
      <Sidebar activeModule={activeModule} onSelect={setActiveModule} onLogout={logout} />
      <section className="main-pane">
        {activeModule === "wallet" && <WalletPanel address={address} profileStatus={profileStatus} tokens={tokenBalances} transactions={transactions} transactionsLoading={transactionsLoading} transactionsError={transactionsError} />}
        {activeModule === "claim" && <ClaimPanel claimableAmount={claimableAmount} claimStatus={claimStatus} goodDollarMessage={goodDollarMessage} nextClaimCountdown={nextClaimCountdown} nextClaimTime={nextClaimTime} onClaim={claimUbi} onVerify={openFaceVerification} disabled={isClaimActionDisabled} />}
        {activeModule !== "wallet" && activeModule !== "claim" && <PlaceholderPanel moduleId={activeModule} />}
      </section>
    </main>
  );
}

function Hero() { return <section className="hero"><p className="eyebrow">Celo + GoodDollar mini app platform</p><h1>Welcome to MarketPlace Hub</h1><p>Play, save, complete tasks, and grow future utility around your Privy wallet and G$ balance.</p></section>; }
