import { createPublicClient, createWalletClient, custom, formatUnits, http, type Address } from "viem";
import { celoMainnet, goodDollarCelo } from "@/lib/celo";

// Re-export for convenience
export { goodDollarCelo };

// Celo Mainnet Contract Addresses
export const exchangeHelper = {
  address: "0xE45CaB86609a16dFaDec112FDd61E4EA80EdaA8D" as Address,
  name: "ExchangeHelper",
} as const;

export const cusdToken = {
  address: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as Address,
  name: "Celo Dollar",
  symbol: "cUSD",
  decimals: 18,
} as const;

export const goodReserve = {
  address: "0xa150a825d425B36329D8294eeF8bD0fE68f8F6E0" as Address,
  name: "GoodReserve",
} as const;

// ERC-20 Approval ABI
export const erc20ApproveAbi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ERC-20 BalanceOf ABI
export const erc20BalanceOfAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ERC-20 Allowance ABI
export const erc20AllowanceAbi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ExchangeHelper ABI - Functions for buying and selling G$
export const exchangeHelperAbi = [
  {
    type: "function",
    name: "buy",
    stateMutability: "payable",
    inputs: [
      { name: "_buyPath", type: "address[]" },
      { name: "_tokenAmount", type: "uint256" },
      { name: "_minReturn", type: "uint256" },
      { name: "_minDAIAmount", type: "uint256" },
      { name: "_targetAddress", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "sell",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_sellPath", type: "address[]" },
      { name: "_gdAmount", type: "uint256" },
      { name: "_minReturn", type: "uint256" },
      { name: "_minTokenReturn", type: "uint256" },
      { name: "_targetAddress", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "buyReturn",
    stateMutability: "view",
    inputs: [
      { name: "_token", type: "address" },
      { name: "_tokenAmount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "sellReturn",
    stateMutability: "view",
    inputs: [
      { name: "_token", type: "address" },
      { name: "_gdAmount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// Helper function to create wallet client
export async function createWalletClientFromPrivy(wallet: { address: string; getEthereumProvider: () => Promise<unknown> }) {
  const provider = await wallet.getEthereumProvider();
  return createWalletClient({
    account: wallet.address as Address,
    chain: celoMainnet,
    transport: custom(provider as Parameters<typeof custom>[0]),
  });
}

// Create public client for read operations
export function getPublicClient() {
  return createPublicClient({ chain: celoMainnet, transport: http() });
}

// Format token amount with proper decimals
export function formatTokenAmount(value: bigint, decimals: number): string {
  return Number(formatUnits(value, decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

// Parse token amount from user input to wei
export function parseTokenAmount(value: string, decimals: number): bigint {
  const parsed = parseFloat(value);
  if (isNaN(parsed) || parsed < 0) return 0n;
  // Use string-based BigInt to avoid Number overflow for large decimals
  const multiplier = BigInt("1" + "0".repeat(decimals));
  return BigInt(Math.floor(parsed * Number(multiplier)));
}

// Get G$ balance for an address
export async function getGDBalance(client: ReturnType<typeof getPublicClient>, address: Address): Promise<bigint> {
  return client.readContract({
    address: goodDollarCelo.address,
    abi: erc20BalanceOfAbi,
    functionName: "balanceOf",
    args: [address],
  });
}

// Get cUSD balance for an address
export async function getCUSDBalance(client: ReturnType<typeof getPublicClient>, address: Address): Promise<bigint> {
  return client.readContract({
    address: cusdToken.address,
    abi: erc20BalanceOfAbi,
    functionName: "balanceOf",
    args: [address],
  });
}

// Check token allowance
export async function getAllowance(client: ReturnType<typeof getPublicClient>, tokenAddress: Address, ownerAddress: Address, spenderAddress: Address): Promise<bigint> {
  return client.readContract({
    address: tokenAddress,
    abi: erc20AllowanceAbi,
    functionName: "allowance",
    args: [ownerAddress, spenderAddress],
  });
}

// Approve token spending
export async function approveToken(
  walletClient: Awaited<ReturnType<typeof createWalletClientFromPrivy>>,
  tokenAddress: Address,
  spenderAddress: Address,
  amount: bigint = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"), // Max approval (type(uint256).max)
) {
  return walletClient.writeContract({
    address: tokenAddress,
    abi: erc20ApproveAbi,
    functionName: "approve",
    args: [spenderAddress, amount],
    account: walletClient.account.address,
    chain: celoMainnet,
  });
}

// Get estimated G$ amount when buying with cUSD
// G$ has 2 decimals, cUSD has 18 decimals
// Rate: 1 cUSD = 100 G$ (100:1 ratio)
export async function getBuyReturn(client: ReturnType<typeof getPublicClient>, cusdAmount: bigint): Promise<bigint> {
  try {
    return await client.readContract({
      address: exchangeHelper.address,
      abi: exchangeHelperAbi,
      functionName: "buyReturn",
      args: [cusdToken.address, cusdAmount],
    });
  } catch {
    // Fallback: 1 cUSD = 100 G$
    // cusdAmount (18 dec) / 10^16 = adjusted amount
    // adjusted * 100 = G$ in 2 dec
    // Net: cusdAmount * 100 / 10^16 = cusdAmount / 10^14
    return cusdAmount / 100_000_000_000_000n; // 10^14
  }
}

// Get estimated cUSD amount when selling G$
// G$ has 2 decimals, cUSD has 18 decimals
// Rate: 100 G$ = 1 cUSD (100:1 ratio)
export async function getSellReturn(client: ReturnType<typeof getPublicClient>, gdAmount: bigint): Promise<bigint> {
  try {
    return await client.readContract({
      address: exchangeHelper.address,
      abi: exchangeHelperAbi,
      functionName: "sellReturn",
      args: [cusdToken.address, gdAmount],
    });
  } catch {
    // Fallback: 100 G$ = 1 cUSD
    // gdAmount (2 dec) * 10^16 = adjusted for 18 dec
    // adjusted * 100 = cUSD
    // Net: gdAmount * 10^14
    return gdAmount * 100_000_000_000_000n; // 10^14
  }
}

// Buy G$ with cUSD
export async function buyGFromCUSD(
  walletClient: Awaited<ReturnType<typeof createWalletClientFromPrivy>>,
  cusdAmount: bigint,
  minReturn: bigint,
  targetAddress: Address,
) {
  // For buying with cUSD, the path is: [cUSD]
  return walletClient.writeContract({
    address: exchangeHelper.address,
    abi: exchangeHelperAbi,
    functionName: "buy",
    args: [[cusdToken.address], cusdAmount, minReturn, 0n, targetAddress],
    account: targetAddress,
    chain: celoMainnet,
  });
}

// Sell G$ for cUSD
export async function sellGToCUSD(
  walletClient: Awaited<ReturnType<typeof createWalletClientFromPrivy>>,
  gdAmount: bigint,
  minReturn: bigint,
  targetAddress: Address,
) {
  // For selling G$ to cUSD, the path is: [G$, cUSD]
  return walletClient.writeContract({
    address: exchangeHelper.address,
    abi: exchangeHelperAbi,
    functionName: "sell",
    args: [[goodDollarCelo.address, cusdToken.address], gdAmount, minReturn, 0n, targetAddress],
    account: targetAddress,
    chain: celoMainnet,
  });
}

// Check if user needs to approve cUSD for buying
export async function needsCUSDApproval(client: ReturnType<typeof getPublicClient>, ownerAddress: Address): Promise<boolean> {
  const allowance = await getAllowance(client, cusdToken.address, ownerAddress, exchangeHelper.address);
  return allowance === 0n;
}

// Check if user needs to approve G$ for selling
export async function needsGDApproval(client: ReturnType<typeof getPublicClient>, ownerAddress: Address): Promise<boolean> {
  const allowance = await getAllowance(client, goodDollarCelo.address, ownerAddress, exchangeHelper.address);
  return allowance === 0n;
}

export type SwapDirection = "buy" | "sell";

export interface SwapQuote {
  inputAmount: bigint;
  outputAmount: bigint;
  inputFormatted: string;
  outputFormatted: string;
  inputToken: typeof goodDollarCelo | typeof cusdToken;
  outputToken: typeof cusdToken | typeof goodDollarCelo;
}

export async function getSwapQuote(
  client: ReturnType<typeof getPublicClient>,
  direction: SwapDirection,
  amount: bigint,
): Promise<SwapQuote | null> {
  if (amount <= 0n) return null;

  if (direction === "buy") {
    // Buying G$ with cUSD
    const outputAmount = await getBuyReturn(client, amount);
    return {
      inputAmount: amount,
      outputAmount,
      inputFormatted: formatTokenAmount(amount, cusdToken.decimals),
      outputFormatted: formatTokenAmount(outputAmount, goodDollarCelo.decimals),
      inputToken: cusdToken,
      outputToken: goodDollarCelo,
    };
  } else {
    // Selling G$ for cUSD
    const outputAmount = await getSellReturn(client, amount);
    return {
      inputAmount: amount,
      outputAmount,
      inputFormatted: formatTokenAmount(amount, goodDollarCelo.decimals),
      outputFormatted: formatTokenAmount(outputAmount, cusdToken.decimals),
      inputToken: goodDollarCelo,
      outputToken: cusdToken,
    };
  }
}
