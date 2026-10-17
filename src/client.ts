import {
  DerivativesAction,
  DerivativesTransactionRequest,
  ClientConfig,
  ChainAdapter
} from "./types.js";

export class QmoosaDerivativesClient {
  public static readonly DEFAULT_CONTRACT_ADDRESS = "0x9999999999999999999999999999999999999999";
  public static readonly MAX_LEVERAGE = 20n;
  public static readonly MIN_LEVERAGE = 1n;

  private config: ClientConfig;

  constructor(config: ClientConfig = {}) {
    this.config = {
      defaultContractAddress: config.defaultContractAddress ?? QmoosaDerivativesClient.DEFAULT_CONTRACT_ADDRESS,
      chainAdapter: config.chainAdapter
    };
  }

  public buildOpenPositionPayload(params: {
    account: string;
    symbol: string;
    isLong: boolean;
    size: bigint;
    collateral: bigint;
    leverage: bigint;
    contractAddress?: string;
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

    return {
      action: "OPEN_POSITION",
      contractAddress: params.contractAddress ?? this.config.defaultContractAddress!,
      sender: params.account,
      symbol: params.symbol.toUpperCase(),
      isLong: params.isLong,
      size: params.size,
      collateral: params.collateral,
      leverage: params.leverage
    };
  }

  public buildClosePositionPayload(params: {
    account: string;
    positionId: string;
    contractAddress?: string;
  }): DerivativesTransactionRequest {
    if (!params.account || params.account.trim().length === 0) {
      throw new Error("Account address must not be empty");
    }
    if (!params.positionId || params.positionId.trim().length === 0) {
      throw new Error("Position ID must not be empty");
    }

    return {
      action: "CLOSE_POSITION",
      contractAddress: params.contractAddress ?? this.config.defaultContractAddress!,
      sender: params.account,
      positionId: params.positionId
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

    return {
      action: "LIQUIDATE",
      contractAddress: params.contractAddress ?? this.config.defaultContractAddress!,
      sender: params.liquidator,
      liquidator: params.liquidator,
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
