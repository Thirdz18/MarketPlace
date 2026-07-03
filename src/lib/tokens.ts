import type { Address } from "viem";
import { goodDollarCelo } from "@/lib/celo";

export type TokenBalance = {
  symbol: "G$" | "CELO";
  name: string;
  network: "Celo Network";
  amount: string;
  note?: string;
  address?: Address;
};

export const supportedWalletTokens = [
  {
    symbol: goodDollarCelo.symbol,
    name: goodDollarCelo.name,
    network: "Celo Network",
    address: goodDollarCelo.address,
  },
  {
    symbol: "CELO",
    name: "Celo",
    network: "Celo Network",
    note: "For gas fees",
  },
] as const;
