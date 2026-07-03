import { formatEther, formatUnits, parseAbiItem, type Address, type PublicClient } from "viem";
import { goodDollarCelo } from "@/lib/celo";
import { ubiSchemeCelo } from "@/lib/gooddollar";

const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const celoLogRangeLimit = 5_000n;
const transactionLookbackBlocks = 100_000n;

async function getTransferLogsInChunks(
  client: PublicClient,
  args: { from?: Address; to?: Address },
  fromBlock: bigint,
  toBlock: bigint,
) {
  const logs = [];

  for (let chunkStart = fromBlock; chunkStart <= toBlock; chunkStart += celoLogRangeLimit) {
    const chunkEnd = chunkStart + celoLogRangeLimit - 1n > toBlock ? toBlock : chunkStart + celoLogRangeLimit - 1n;

    logs.push(
      ...(await client.getLogs({
        address: goodDollarCelo.address,
        event: transferEvent,
        args,
        fromBlock: chunkStart,
        toBlock: chunkEnd,
      })),
    );
  }

  return logs;
}

export type WalletTransaction = {
  id: string;
  type: "claim" | "send" | "receive";
  token: "G$" | "CELO";
  amount: string;
  hash: string;
  direction: "in" | "out";
  blockNumber?: bigint;
  status?: "pending" | "confirmed";
};

export function createSubmittedClaimTransaction(hash: string, amount: string): WalletTransaction {
  return {
    id: `claim-${hash}`,
    type: "claim",
    token: "G$",
    amount,
    hash,
    direction: "in",
    status: "pending",
  };
}

export async function fetchGoodDollarTransactions(client: PublicClient, walletAddress: Address): Promise<WalletTransaction[]> {
  const latestBlock = await client.getBlockNumber();
  const fromBlock = latestBlock > transactionLookbackBlocks ? latestBlock - transactionLookbackBlocks : 0n;
  const normalizedWallet = walletAddress.toLowerCase();
  const normalizedUbiScheme = ubiSchemeCelo.address.toLowerCase();

  const [incomingLogs, outgoingLogs] = await Promise.all([
    getTransferLogsInChunks(client, { to: walletAddress }, fromBlock, latestBlock),
    getTransferLogsInChunks(client, { from: walletAddress }, fromBlock, latestBlock),
  ]);

  const byLog = new Map<string, WalletTransaction>();

  for (const log of [...incomingLogs, ...outgoingLogs]) {
    const from = log.args.from?.toLowerCase();
    const to = log.args.to?.toLowerCase();
    const value = log.args.value ?? 0n;
    const isOutgoing = from === normalizedWallet;
    const isIncoming = to === normalizedWallet;

    if (!isOutgoing && !isIncoming) continue;

    const type = isIncoming && from === normalizedUbiScheme ? "claim" : isOutgoing ? "send" : "receive";
    const direction = isOutgoing ? "out" : "in";
    const id = `${log.transactionHash}-${log.logIndex}`;

    byLog.set(id, {
      id,
      type,
      token: "G$",
      amount: `${Number(formatUnits(value, goodDollarCelo.decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${goodDollarCelo.symbol}`,
      hash: log.transactionHash,
      direction,
      blockNumber: log.blockNumber,
      status: "confirmed",
    });
  }

  return [...byLog.values()].sort((a, b) => Number((b.blockNumber ?? 0n) - (a.blockNumber ?? 0n))).slice(0, 20);
}

export function formatCeloBalance(value: bigint) {
  return Number(formatEther(value)).toLocaleString(undefined, { maximumFractionDigits: 4 });
}
