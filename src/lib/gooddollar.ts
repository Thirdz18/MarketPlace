import { createWalletClient, custom, formatUnits, type Address } from "viem";
import { celoMainnet, goodDollarCelo } from "@/lib/celo";

export type GoodDollarStatus = "idle" | "loading" | "success" | "claimed" | "unverified" | "error";


const GOODID_FACE_VERIFICATION_URL = "https://goodid.gooddollar.org/";
const GOODID_IDENTIFIER_MESSAGE = "Sign this message to generate your anonymous GoodDollar Face Verification identifier.";

export type GoodIdFaceVerificationLinkParams = {
  address: Address;
  signature: string;
  firstName?: string;
  callbackUrl?: string;
  popupMode?: boolean;
  chainId?: number;
};

export function getGoodIdIdentifierMessage(address: Address) {
  return `${GOODID_IDENTIFIER_MESSAGE}\n\nWallet: ${address}`;
}

export function createGoodIdFaceVerificationLink({ address, signature, firstName = "friend", callbackUrl, popupMode = false, chainId = celoMainnet.id }: GoodIdFaceVerificationLinkParams) {
  const url = new URL(GOODID_FACE_VERIFICATION_URL);
  url.searchParams.set("firstName", firstName);
  url.searchParams.set("account", address);
  url.searchParams.set("signature", signature);
  url.searchParams.set("chainId", chainId.toString());
  url.searchParams.set("popupMode", popupMode ? "true" : "false");
  if (callbackUrl) url.searchParams.set("callbackUrl", callbackUrl);

  return url.toString();
}

export const ubiSchemeCelo = {
  name: "GoodDollar UBI Scheme",
  address: "0x43d72Ff17701B2DA814620735C39C620Ce0ea4A1" as Address,
} as const;

export const ubiSchemeAbi = [
  {
    type: "function",
    name: "checkEntitlement",
    stateMutability: "view",
    inputs: [{ name: "_member", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "checkEntitlement",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const goodDollarIdentityCelo = {
  name: "GoodDollar Identity",
  address: "0xC361A6E67822a0EDc17D899227dd9FC50BD62F42" as Address,
} as const;

export const goodDollarIdentityAbi = [
  {
    type: "function",
    name: "getWhitelistedRoot",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const zeroAddress = "0x0000000000000000000000000000000000000000" as Address;

export async function createPrivyWalletClient(wallet: { address: string; getEthereumProvider: () => Promise<unknown> }) {
  const provider = await wallet.getEthereumProvider();

  return createWalletClient({
    account: wallet.address as Address,
    chain: celoMainnet,
    transport: custom(provider as Parameters<typeof custom>[0]),
  });
}

export function formatGoodDollarAmount(value: bigint) {
  return `${Number(formatUnits(value, goodDollarCelo.decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${goodDollarCelo.symbol}`;
}
