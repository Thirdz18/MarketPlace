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
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string>();

  const client = useMemo(() => createPublicClient({ chain: celoMainnet, transport: http() }), []);

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
      setClaimableAmount("—");
      setGoodDollarMessage("This wallet is not verified for GoodDollar UBI yet. Verify your GoodDollar identity in GoodWallet/GoodDapp, then come back and claim here.");
      return undefined;
    }

    const entitlement = await client.readContract({ address: ubiSchemeCelo.address, abi: ubiSchemeAbi, functionName: "checkEntitlement", args: [rootAddress] });
    const formattedEntitlement = formatGoodDollarAmount(entitlement);

    setClaimableAmount(formattedEntitlement);
    setGoodDollarMessage(entitlement > 0n ? `Claimable now: ${formattedEntitlement}.` : "No UBI is claimable right now. Please try again after the next daily claim window.");

    return { entitlement, formattedEntitlement };
  }, [address, client]);

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
      setClaimableAmount("—");
      setGoodDollarMessage("Connect your wallet to load your daily UBI amount from the GoodDollar contract.");
      return;
    }

    let cancelled = false;
    async function loadClaimPreview() {
      setClaimStatus("loading");
      setGoodDollarMessage("Loading your claimable UBI from the GoodDollar contract...");
      try {
        await loadClaimableAmount();
        if (!cancelled) setClaimStatus("idle");
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

      const { entitlement, formattedEntitlement } = claimPreview;

      if (entitlement <= 0n) {
        setClaimStatus("success");
        setGoodDollarMessage("No UBI is claimable right now. Please try again after the next daily claim window.");
        return;
      }

      setGoodDollarMessage(`Claimable now: ${formattedEntitlement}. Please confirm the transaction in your wallet.`);
      const walletClient = await createPrivyWalletClient(wallet);
      const hash = await walletClient.writeContract({ address: ubiSchemeCelo.address, abi: ubiSchemeAbi, functionName: "claim", account: address, chain: celoMainnet });

      setGoodDollarMessage(`UBI claim submitted. Transaction: ${hash}`);
      setTransactions((current) => [createSubmittedClaimTransaction(hash, formattedEntitlement), ...current]);
      setClaimStatus("success");
      await Promise.allSettled([loadBalances(), loadTransactions()]);
    } catch (error) {
      setClaimStatus("error");
      const message = error instanceof Error ? error.message : "Unable to claim UBI.";
      setGoodDollarMessage(message.includes("not whitelisted") ? "This wallet is not verified for GoodDollar UBI yet. Verify your GoodDollar identity in GoodWallet/GoodDapp, then come back and claim here." : message);
    }
  }

  const isClaimActionDisabled = !address || claimStatus === "loading";

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
        {activeModule === "claim" && <ClaimPanel claimableAmount={claimableAmount} claimStatus={claimStatus} goodDollarMessage={goodDollarMessage} onClaim={claimUbi} disabled={isClaimActionDisabled} />}
        {activeModule !== "wallet" && activeModule !== "claim" && <PlaceholderPanel moduleId={activeModule} />}
      </section>
    </main>
  );
}

function Hero() { return <section className="hero"><p className="eyebrow">Celo + GoodDollar mini app platform</p><h1>Welcome to MarketPlace Hub</h1><p>Play, save, complete tasks, and grow future utility around your Privy wallet and G$ balance.</p></section>; }
