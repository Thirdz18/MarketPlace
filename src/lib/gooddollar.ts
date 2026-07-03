import { createWalletClient, custom, formatUnits, type Address, type PublicClient, type WalletClient } from "viem";
import { celoMainnet, goodDollarCelo } from "@/lib/celo";

export const goodDollarIdentityCallbackPath = "/?gooddollar=identity-callback";
export const goodDollarSdkPackage = "@goodsdks/citizen-sdk";
export const goodDollarEnvironment = "production";

export type GoodDollarStatus = "idle" | "loading" | "success" | "error";

type GoodDollarSdkModule = {
  IdentitySDK?: new (publicClient: PublicClient, walletClient: WalletClient, env: string) => GoodDollarIdentitySdk;
  ClaimSDK?: GoodDollarClaimSdkFactory;
};

type GoodDollarIdentitySdk = {
  getWhitelistedRoot: (account: Address) => Promise<{ isWhitelisted: boolean; root: Address }>;
  generateFVLink: (popupMode?: boolean, callbackUrl?: string, chainId?: number) => Promise<string>;
};

type GoodDollarClaimSdk = {
  checkEntitlement: () => Promise<bigint>;
  claim: () => Promise<unknown>;
  nextClaimTime?: () => Promise<Date>;
};

type GoodDollarClaimSdkFactory = {
  new (params: {
    account: Address;
    publicClient: PublicClient;
    walletClient: WalletClient;
    identitySDK: GoodDollarIdentitySdk;
    env: string;
  }): GoodDollarClaimSdk;
  init?: (params: {
    account?: Address;
    publicClient: PublicClient;
    walletClient: WalletClient;
    identitySDK: GoodDollarIdentitySdk;
    env: string;
  }) => Promise<GoodDollarClaimSdk>;
};

export async function loadGoodDollarSdk() {
  try {
    const importSdk = new Function("packageName", "return import(packageName)") as (packageName: string) => Promise<GoodDollarSdkModule>;
    const sdk = await importSdk(goodDollarSdkPackage);

    if (!sdk.IdentitySDK || !sdk.ClaimSDK) {
      throw new Error("GoodDollar SDK loaded, but IdentitySDK or ClaimSDK export is missing.");
    }

    return sdk as Required<Pick<GoodDollarSdkModule, "IdentitySDK" | "ClaimSDK">>;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown SDK loading error";
    throw new Error(`Unable to load ${goodDollarSdkPackage}. Install/allow the package before using live identity and claim actions. ${detail}`);
  }
}

export async function createPrivyWalletClient(wallet: { address: string; getEthereumProvider: () => Promise<unknown> }) {
  const provider = await wallet.getEthereumProvider();

  return createWalletClient({
    account: wallet.address as Address,
    chain: celoMainnet,
    transport: custom(provider as Parameters<typeof custom>[0]),
  });
}

export async function createIdentitySdk(publicClient: PublicClient, walletClient: WalletClient) {
  const { IdentitySDK } = await loadGoodDollarSdk();
  return new IdentitySDK(publicClient, walletClient, goodDollarEnvironment);
}

export async function createClaimSdk(account: Address, publicClient: PublicClient, walletClient: WalletClient, identitySDK: GoodDollarIdentitySdk) {
  const { ClaimSDK } = await loadGoodDollarSdk();

  if (ClaimSDK.init) {
    return ClaimSDK.init({ account, publicClient, walletClient, identitySDK, env: goodDollarEnvironment });
  }

  return new ClaimSDK({ account, publicClient, walletClient, identitySDK, env: goodDollarEnvironment });
}

export function formatGoodDollarAmount(value: bigint) {
  return `${Number(formatUnits(value, goodDollarCelo.decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${goodDollarCelo.symbol}`;
}

export function identityCallbackUrl() {
  return `${window.location.origin}${goodDollarIdentityCallbackPath}`;
}
