import { defineChain } from "viem";

export const celoMainnet = defineChain({
  id: 42220,
  name: "Celo",
  nativeCurrency: { decimals: 18, name: "CELO", symbol: "CELO" },
  rpcUrls: { default: { http: ["https://forno.celo.org"] }, public: { http: ["https://forno.celo.org"] } },
  blockExplorers: { default: { name: "CeloScan", url: "https://celoscan.io" } },
});

export const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: { decimals: 18, name: "CELO", symbol: "CELO" },
  rpcUrls: {
    default: { http: ["https://forno.celo-sepolia.celo-testnet.org"] },
    public: { http: ["https://forno.celo-sepolia.celo-testnet.org"] },
  },
  blockExplorers: { default: { name: "Celo Sepolia Blockscout", url: "https://celo-sepolia.blockscout.com" } },
  testnet: true,
});

export const goodDollarCelo = {
  name: "GoodDollar",
  symbol: "G$",
  address: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A",
  decimals: 18,
} as const;

export const erc20BalanceAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
