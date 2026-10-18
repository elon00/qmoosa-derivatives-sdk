import crypto from "node:crypto";
import {
  DerivativesAction,
  DerivativesTransactionRequest,
  ClientConfig,
  ChainAdapter,
  IntentDomain,
  SignedIntent
} from "./types.js";

export class QmoosaDerivativesClient {
  public static readonly DEFAULT_CHAIN_ID = 31337;
  public static readonly DEFAULT_CONTRACT_ADDRESS = "0x9999999999999999999999999999999999999999";
  public static readonly MAX_LEVERAGE = 20n;
  public static readonly MIN_LEVERAGE = 1n;

  private config: ClientConfig;

  constructor(config: ClientConfig = {}) {
    this.config = {
      defaultContractAddress: (config.defaultContractAddress ?? QmoosaDerivativesClient.DEFAULT_CONTRACT_ADDRESS).toLowerCase(),
      defaultChainId: config.defaultChainId ?? QmoosaDerivativesClient.DEFAULT_CHAIN_ID,
      chainAdapter: config.chainAdapter
    };
  }

  public get defaultDomain(): IntentDomain {
    return {
      chainId: this.config.defaultChainId!,
      contractAddress: this.config.defaultContractAddress!
    };
  }

  public static canonicalize(obj: unknown): unknown {
    if (obj === null || typeof obj !== "object") {
      return typeof obj === "bigint" ? obj.toString() : obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(QmoosaDerivativesClient.canonicalize);
    }
    const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      result[key] = QmoosaDerivativesClient.canonicalize((obj as Record<string, unknown>)[key]);
    }
    return result;
  }

  public static hashParams(params: unknown): string {
    const canonical = JSON.stringify(QmoosaDerivativesClient.canonicalize(params));
    return crypto.createHash("sha256").update(canonical).digest("hex");
  }

  public static computeSignature(
    domain: IntentDomain,
    account: string,
    caller: string,
    action: string,
    nonce: bigint,
    deadline: number,
    paramsHash: string,
    secretKey: string
  ): string {
    const payload = `${domain.chainId}:${domain.contractAddress.toLowerCase()}:${account.toLowerCase()}:${caller.toLowerCase()}:${action}:${nonce}:${deadline}:${paramsHash}`;
    return crypto.createHmac("sha256", secretKey).update(payload).digest("hex");
  }

  public signIntent(params: {
    domain?: IntentDomain;
    account: string;
    caller?: string;
    action: string;
    canonicalParams: unknown;
    nonce: bigint;
    secretKey: string;
    deadlineMs?: number;
  }): SignedIntent {
    const domain = params.domain ?? this.defaultDomain;
    const caller = (params.caller ?? params.account).toLowerCase();
    const account = params.account.toLowerCase();
    const deadlineMs = params.deadlineMs ?? Date.now() + 300_000;
    const paramsHash = QmoosaDerivativesClient.hashParams(params.canonicalParams);
    const signature = QmoosaDerivativesClient.computeSignature(
      domain,
      account,
      caller,
      params.action,
      params.nonce,
      deadlineMs,
      paramsHash,
      params.secretKey
    );

    return {
      domain: {
        chainId: domain.chainId,
        contractAddress: domain.contractAddress.toLowerCase()
      },
      account,
      caller,
      action: params.action,
      nonce: params.nonce,
      deadline: deadlineMs,
      paramsHash,
      signature
    };
  }

  public buildOpenPositionPayload(params: {
    account: string;
    caller?: string;
    symbol: string;
    isLong: boolean;
    size: bigint;
    collateral: bigint;
    leverage: bigint;
    nonce?: bigint;
    secretKey?: string;
    contractAddress?: string;
    chainId?: number;
    deadlineMs?: number;
    signedIntent?: SignedIntent;
  }): DerivativesTransactionRequest {
    if (!params.account || params.account.trim().length === 0) {
      throw new Error("Account address must not be empty");
    }
    if (!params.symbol || params.symbol.trim().length === 0) {
      throw new Error("Market symbol must not be empty");
    }
    if (params.size <= 0n) {
      throw new RangeError("Position size must be strictly positive");
    }
    if (params.collateral <= 0n) {
      throw new RangeError("Collateral must be strictly positive");
    }
    if (params.leverage < QmoosaDerivativesClient.MIN_LEVERAGE || params.leverage > QmoosaDerivativesClient.MAX_LEVERAGE) {
      throw new RangeError(`Leverage must be between 1x and 20x (got ${params.leverage}x)`);
    }

    const contractAddress = (params.contractAddress ?? this.config.defaultContractAddress!).toLowerCase();
    const chainId = params.chainId ?? this.config.defaultChainId!;
    const domain: IntentDomain = { chainId, contractAddress };
    const caller = (params.caller ?? params.account).toLowerCase();
    const canonicalParams = {
      account: params.account.toLowerCase(),
      symbol: params.symbol.toUpperCase(),
      isLong: params.isLong,
      size: params.size,
      collateral: params.collateral,
      leverage: params.leverage
    };

    let signedIntent = params.signedIntent;
    if (!signedIntent && params.secretKey && params.nonce !== undefined) {
      signedIntent = this.signIntent({
        domain,
        account: params.account,
        caller,
        action: "OPEN_POSITION",
        canonicalParams,
        nonce: params.nonce,
        secretKey: params.secretKey,
        deadlineMs: params.deadlineMs
      });
    }

    return {
      action: "OPEN_POSITION",
      contractAddress,
      sender: caller,
      symbol: params.symbol.toUpperCase(),
      isLong: params.isLong,
      size: params.size,
      collateral: params.collateral,
      leverage: params.leverage,
      signedIntent
    };
  }

  public buildClosePositionPayload(params: {
    account: string;
    caller?: string;
    positionId: string;
    nonce?: bigint;
    secretKey?: string;
    contractAddress?: string;
    chainId?: number;
    deadlineMs?: number;
    signedIntent?: SignedIntent;
  }): DerivativesTransactionRequest {
    if (!params.account || params.account.trim().length === 0) {
      throw new Error("Account address must not be empty");
    }
    if (!params.positionId || params.positionId.trim().length === 0) {
      throw new Error("Position ID must not be empty");
    }

    const contractAddress = (params.contractAddress ?? this.config.defaultContractAddress!).toLowerCase();
    const chainId = params.chainId ?? this.config.defaultChainId!;
    const domain: IntentDomain = { chainId, contractAddress };
    const caller = (params.caller ?? params.account).toLowerCase();
    const canonicalParams = {
      account: params.account.toLowerCase(),
      positionId: params.positionId
    };

    let signedIntent = params.signedIntent;
    if (!signedIntent && params.secretKey && params.nonce !== undefined) {
      signedIntent = this.signIntent({
        domain,
        account: params.account,
        caller,
        action: "CLOSE_POSITION",
        canonicalParams,
        nonce: params.nonce,
        secretKey: params.secretKey,
        deadlineMs: params.deadlineMs
      });
    }

    return {
      action: "CLOSE_POSITION",
      contractAddress,
      sender: caller,
      positionId: params.positionId,
      signedIntent
    };
  }

  public buildSetOperatorPayload(params: {
    account: string;
    operator: string;
    approved: boolean;
    nonce?: bigint;
    secretKey?: string;
    contractAddress?: string;
    chainId?: number;
    deadlineMs?: number;
    signedIntent?: SignedIntent;
  }): DerivativesTransactionRequest {
    if (!params.account || params.account.trim().length === 0) {
      throw new Error("Account address must not be empty");
    }
    if (!params.operator || params.operator.trim().length === 0) {
      throw new Error("Operator address must not be empty");
    }

    const contractAddress = (params.contractAddress ?? this.config.defaultContractAddress!).toLowerCase();
    const chainId = params.chainId ?? this.config.defaultChainId!;
    const domain: IntentDomain = { chainId, contractAddress };
    const canonicalParams = {
      account: params.account.toLowerCase(),
      operator: params.operator.toLowerCase(),
      approved: params.approved
    };

    let signedIntent = params.signedIntent;
    if (!signedIntent && params.secretKey && params.nonce !== undefined) {
      signedIntent = this.signIntent({
        domain,
        account: params.account,
        caller: params.account,
        action: "SET_OPERATOR",
        canonicalParams,
        nonce: params.nonce,
        secretKey: params.secretKey,
        deadlineMs: params.deadlineMs
      });
    }

    return {
      action: "SET_OPERATOR",
      contractAddress,
      sender: params.account.toLowerCase(),
      operator: params.operator.toLowerCase(),
      approved: params.approved,
      signedIntent
    };
  }

  public buildLiquidatePayload(params: {
    liquidator: string;
    positionId: string;
    contractAddress?: string;
  }): DerivativesTransactionRequest {
    if (!params.liquidator || params.liquidator.trim().length === 0) {
      throw new Error("Liquidator address must not be empty");
    }
    if (!params.positionId || params.positionId.trim().length === 0) {
      throw new Error("Position ID must not be empty");
    }

    const contractAddress = (params.contractAddress ?? this.config.defaultContractAddress!).toLowerCase();
    return {
      action: "LIQUIDATE",
      contractAddress,
      sender: params.liquidator.toLowerCase(),
      liquidator: params.liquidator.toLowerCase(),
      positionId: params.positionId
    };
  }

  public async sendTransaction(
    request: DerivativesTransactionRequest
  ): Promise<{ txHash: string; status: "success" | "reverted" }> {
    if (!this.config.chainAdapter) {
      throw new Error("No chain adapter configured; cannot broadcast transaction payload");
    }
    return this.config.chainAdapter.sendTransaction(request);
  }
}
