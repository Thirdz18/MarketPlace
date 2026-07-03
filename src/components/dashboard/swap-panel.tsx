"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import { type Address } from "viem";
import {
  buyGFromCUSD,
  createWalletClientFromPrivy,
  cusdToken,
  exchangeHelper,
  formatTokenAmount,
  getCUSDBalance,
  getGDBalance,
  getPublicClient,
  getSwapQuote,
  goodDollarCelo,
  needsCUSDApproval,
  needsGDApproval,
  parseTokenAmount,
  approveToken,
  sellGToCUSD,
  type SwapDirection,
  type SwapQuote,
} from "@/lib/reserve";

type SwapStatus = "idle" | "loading" | "approving" | "swapping" | "success" | "error";

interface SwapPanelProps {
  address?: Address;
}

export function SwapPanel({ address }: SwapPanelProps) {
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const [direction, setDirection] = useState<SwapDirection>("sell");
  const [inputAmount, setInputAmount] = useState("");
  const [status, setStatus] = useState<SwapStatus>("idle");
  const [error, setError] = useState<string>();
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [gdBalance, setGdBalance] = useState<bigint>(0n);
  const [cusdBalance, setCusdBalance] = useState<bigint>(0n);
  const [needsApproval, setNeedsApproval] = useState(true);

  const client = useMemo(() => getPublicClient(), []);

  const loadBalances = useCallback(async () => {
    if (!address) return;
    const [gd, cusd] = await Promise.all([
      getGDBalance(client, address),
      getCUSDBalance(client, address),
    ]);
    setGdBalance(gd);
    setCusdBalance(cusd);
  }, [address, client]);

  const checkApproval = useCallback(async () => {
    if (!address) return;
    if (direction === "buy") {
      const needs = await needsCUSDApproval(client, address);
      setNeedsApproval(needs);
    } else {
      const needs = await needsGDApproval(client, address);
      setNeedsApproval(needs);
    }
  }, [address, client, direction]);

  const updateQuote = useCallback(async () => {
    if (!inputAmount || !address) {
      setQuote(null);
      return;
    }

    const decimals = direction === "buy" ? cusdToken.decimals : goodDollarCelo.decimals;
    const amount = parseTokenAmount(inputAmount, decimals);

    if (amount <= 0n) {
      setQuote(null);
      return;
    }

    // Check if user has sufficient balance
    const inputBalance = direction === "buy" ? cusdBalance : gdBalance;
    if (amount > inputBalance) {
      setQuote(null);
      setError("Insufficient balance");
      return;
    }

    setError(undefined);
    const newQuote = await getSwapQuote(client, direction, amount);
    setQuote(newQuote);
  }, [inputAmount, address, direction, client, cusdBalance, gdBalance]);

  useEffect(() => {
    loadBalances();
    checkApproval();
  }, [loadBalances, checkApproval]);

  useEffect(() => {
    const timer = setTimeout(updateQuote, 300);
    return () => clearTimeout(timer);
  }, [updateQuote]);

  const handleDirectionToggle = () => {
    setDirection((prev) => (prev === "buy" ? "sell" : "buy"));
    setInputAmount("");
    setQuote(null);
    setError(undefined);
  };

  const handleMaxClick = () => {
    const balance = direction === "buy" ? cusdBalance : gdBalance;
    const decimals = direction === "buy" ? cusdToken.decimals : goodDollarCelo.decimals;
    const formatted = formatTokenAmount(balance, decimals);
    setInputAmount(formatted);
  };

  const handleSwap = async () => {
    if (!wallet || !address || !quote) return;

    const amount = parseTokenAmount(inputAmount, quote.inputToken.decimals);
    if (amount <= 0n) return;

    try {
      setStatus("loading");
      setError(undefined);

      // Check if approval is needed
      if (needsApproval) {
        setStatus("approving");
        const walletClient = await createWalletClientFromPrivy(wallet);
        const tokenAddress = direction === "buy" ? cusdToken.address : goodDollarCelo.address;
        
        const approveHash = await approveToken(walletClient, tokenAddress, exchangeHelper.address);
        setStatus("loading");
        
        // Wait for approval to be confirmed
        await client.waitForTransactionReceipt({ hash: approveHash });
      }

      setStatus("swapping");
      const walletClient = await createWalletClientFromPrivy(wallet);
      
      // Apply 0.5% slippage tolerance
      const minReturn = (quote.outputAmount * 995n) / 1000n;

      let hash: `0x${string}`;
      if (direction === "buy") {
        hash = await buyGFromCUSD(walletClient, amount, minReturn, address);
      } else {
        hash = await sellGToCUSD(walletClient, amount, minReturn, address);
      }

      setStatus("success");
      setInputAmount("");
      setQuote(null);
      
      // Refresh balances
      await loadBalances();
      await checkApproval();

      // Reset status after a delay
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Transaction failed");
    }
  };

  const isDisabled = !address || !inputAmount || !quote || status === "loading" || status === "approving" || status === "swapping";
  const inputToken = direction === "buy" ? cusdToken : goodDollarCelo;
  const outputToken = direction === "buy" ? goodDollarCelo : cusdToken;
  const inputBalance = direction === "buy" ? cusdBalance : gdBalance;
  const outputBalance = direction === "buy" ? gdBalance : cusdBalance;

  return (
    <div className="content-stack">
      <div className="swap-header">
        <div className="section-heading">
          <p className="eyebrow">GoodDollar Reserve</p>
          <h2>GoodSwap</h2>
        </div>
        <p className="swap-description">
          Swap between G$ and cUSD directly through the GoodDollar Reserve.
        </p>
      </div>

      <div className="swap-card">
        {/* Direction Toggle */}
        <div className="swap-direction-toggle">
          <button
            className={`direction-btn ${direction === "sell" ? "active" : ""}`}
            onClick={() => direction !== "sell" && handleDirectionToggle()}
            type="button"
          >
            Sell G$
          </button>
          <button
            className={`direction-btn ${direction === "buy" ? "active" : ""}`}
            onClick={() => direction !== "buy" && handleDirectionToggle()}
            type="button"
          >
            Buy G$
          </button>
        </div>

        {/* Input Section */}
        <div className="swap-input-section">
          <div className="swap-input-header">
            <span className="swap-label">You pay</span>
            <span className="swap-balance">
              Balance: {formatTokenAmount(inputBalance, inputToken.decimals)} {inputToken.symbol}
              <button onClick={handleMaxClick} className="max-btn" type="button">MAX</button>
            </span>
          </div>
          <div className="swap-input-wrapper">
            <input
              type="number"
              className="swap-input"
              placeholder="0.00"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              disabled={!address}
            />
            <div className="swap-token-badge">
              <span className={`token-icon token-${inputToken.symbol === "G$" ? "gd" : "cusd"}`}>
                {inputToken.symbol}
              </span>
              <span>{inputToken.symbol}</span>
            </div>
          </div>
        </div>

        {/* Swap Arrow */}
        <div className="swap-arrow-container">
          <div className="swap-arrow">↓</div>
        </div>

        {/* Output Section */}
        <div className="swap-output-section">
          <div className="swap-input-header">
            <span className="swap-label">You receive</span>
            <span className="swap-balance">
              Balance: {formatTokenAmount(outputBalance, outputToken.decimals)} {outputToken.symbol}
            </span>
          </div>
          <div className="swap-output-wrapper">
            <div className="swap-output-amount">
              {quote ? quote.outputFormatted : "0.00"}
            </div>
            <div className="swap-token-badge">
              <span className={`token-icon token-${outputToken.symbol === "G$" ? "gd" : "cusd"}`}>
                {outputToken.symbol}
              </span>
              <span>{outputToken.symbol}</span>
            </div>
          </div>
        </div>

        {/* Exchange Rate */}
        {quote && (
          <div className="swap-rate">
            <span>Rate</span>
            <span>
              1 {inputToken.symbol} ≈ {quote.outputFormatted} {outputToken.symbol}
            </span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="swap-error">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="swap-actions">
          {needsApproval && status !== "loading" && (
            <div className="approval-notice">
              ⚠️ Token approval required before first swap
            </div>
          )}
          
          <button
            className={`swap-btn ${status}`}
            onClick={handleSwap}
            disabled={isDisabled}
            type="button"
          >
            {status === "idle" && (needsApproval ? "Approve & Swap" : "Swap")}
            {status === "loading" && "Checking..."}
            {status === "approving" && "Approving..."}
            {status === "swapping" && "Swapping..."}
            {status === "success" && "Success! ✓"}
            {status === "error" && "Try Again"}
          </button>
        </div>

        {/* Status Messages */}
        {status === "success" && (
          <div className="swap-success-message">
            Swap completed successfully!
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="swap-info panel-lite">
        <h3>About GoodSwap</h3>
        <p>
          GoodSwap allows you to exchange G$ for cUSD and vice versa directly through the GoodDollar Reserve.
          This helps maintain liquidity in the GoodDollar ecosystem.
        </p>
        <ul>
          <li>Buy G$ with cUSD to participate in the GoodDollar economy</li>
          <li>Sell G$ for cUSD when you need stablecoin liquidity</li>
          <li>All swaps go through the GoodReserve smart contract</li>
        </ul>
      </div>
    </div>
  );
}
