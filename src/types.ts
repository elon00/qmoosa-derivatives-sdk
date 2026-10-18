export type DerivativesAction =
  | "OPEN_POSITION"
  | "CLOSE_POSITION"
  | "LIQUIDATE"
  | "UPDATE_PRICES"
  | "SET_OPERATOR"
  | "REGISTER_MARKET"
  | "SETTLE_FUNDING";

export interface IntentDomain {
  chainId: number;
  contractAddress: string;
}

export interface SignedIntent {
  domain: IntentDomain;
  account: string;
  caller: string;
  action: string;
  nonce: bigint;
  deadline: number;
  paramsHash: string;
  signature: string;
}

export interface SignedPrivilegedIntent {
  domain: IntentDomain;
  role: "ADMIN" | "ORACLE" | "KEEPER";
  action: string;
  nonce: bigint;
  deadline: number;
  paramsHash: string;
  signature: string;
}

export interface EnrollmentProof {
  account: string;
  publicKey: string;
  enrollmentSignature: string;
  timestamp: number;
}

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
  operator?: string;
  approved?: boolean;
  signedIntent?: SignedIntent;
  signedPrivilegedIntent?: SignedPrivilegedIntent;
  enrollmentProof?: EnrollmentProof;
}

export interface ChainAdapter {
  sendTransaction(request: DerivativesTransactionRequest): Promise<{ txHash: string; status: "success" | "reverted" }>;
}

export interface ClientConfig {
  defaultContractAddress?: string;
  defaultChainId?: number;
  chainAdapter?: ChainAdapter;
}
