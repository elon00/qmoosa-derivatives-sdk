export type DerivativesAction =
  | "OPEN_POSITION"
  | "CLOSE_POSITION"
  | "LIQUIDATE"
  | "UPDATE_PRICES";

export interface DerivativesTransactionRequest {
  action: DerivativesAction;
  contractAddress: string;
  sender: string;
  symbol?: string;
  isLong?: boolean;
  size?: bigint;
  collateral?: bigint;
  leverage?: bigint;
  positionId?: string;
  liquidator?: string;
  markPrice?: bigint;
  indexPrice?: bigint;
}

export interface ChainAdapter {
  sendTransaction(request: DerivativesTransactionRequest): Promise<{ txHash: string; status: "success" | "reverted" }>;
}

export interface ClientConfig {
  defaultContractAddress?: string;
  chainAdapter?: ChainAdapter;
}
