import { createWalletClient, custom, formatUnits, type Address } from "viem";
import { celoMainnet, goodDollarCelo } from "@/lib/celo";

export type GoodDollarStatus = "idle" | "loading" | "success" | "error";

export const ubiSchemeCelo = {
  name: "GoodDollar UBI Scheme",
  address: "0x810f9f6CAA5da7d3F1D3A02461fdc5a8ee29EFf3" as Address,
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
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

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
