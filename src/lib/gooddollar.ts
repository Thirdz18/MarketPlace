import { createWalletClient, custom, formatUnits, type Address } from "viem";
import { celoMainnet, goodDollarCelo } from "@/lib/celo";

export type GoodDollarStatus = "idle" | "loading" | "success" | "claimed" | "unverified" | "error";

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
