import { test } from "node:test";
import assert from "node:assert/strict";
import { QmoosaDerivativesClient } from "../dist/index.js";

const WAD = 10n ** 18n;

test("1. Build open position payload with default parameters and signed intent", () => {
  const client = new QmoosaDerivativesClient();
  const secretKey = "alice-sdk-secret-key";

  const payload = client.buildOpenPositionPayload({
    account: "0xUser1",
    symbol: "ETH-USD",
    isLong: true,
    size: 2n * WAD,
    collateral: 600n * WAD,
    leverage: 10n,
    nonce: 1n,
    secretKey
  });

  assert.equal(payload.action, "OPEN_POSITION");
  assert.equal(payload.contractAddress, QmoosaDerivativesClient.DEFAULT_CONTRACT_ADDRESS);
  assert.equal(payload.sender, "0xuser1");
  assert.equal(payload.symbol, "ETH-USD");
  assert.equal(payload.isLong, true);
  assert.equal(payload.size, 2n * WAD);
  assert.equal(payload.collateral, 600n * WAD);
  assert.equal(payload.leverage, 10n);
  assert.ok(payload.signedIntent);
  assert.equal(payload.signedIntent.account, "0xuser1");
  assert.equal(payload.signedIntent.action, "OPEN_POSITION");
  assert.equal(payload.signedIntent.nonce, 1n);
  assert.equal(payload.signedIntent.domain.chainId, QmoosaDerivativesClient.DEFAULT_CHAIN_ID);
});

test("2. Build close position payload with signed intent", () => {
  const client = new QmoosaDerivativesClient();
  const secretKey = "alice-sdk-secret-key";

  const payload = client.buildClosePositionPayload({
    account: "0xUser1",
    positionId: "POS-ETH-USD-1",
    nonce: 2n,
    secretKey
  });

  assert.equal(payload.action, "CLOSE_POSITION");
  assert.equal(payload.sender, "0xuser1");
  assert.equal(payload.positionId, "POS-ETH-USD-1");
  assert.ok(payload.signedIntent);
  assert.equal(payload.signedIntent.action, "CLOSE_POSITION");
  assert.equal(payload.signedIntent.nonce, 2n);
});

test("3. Build set operator payload with signed intent", () => {
  const client = new QmoosaDerivativesClient();
  const secretKey = "alice-sdk-secret-key";

  const payload = client.buildSetOperatorPayload({
    account: "0xUser1",
    operator: "0xBrokerBot",
    approved: true,
    nonce: 1n,
    secretKey
  });

  assert.equal(payload.action, "SET_OPERATOR");
  assert.equal(payload.sender, "0xuser1");
  assert.equal(payload.operator, "0xbrokerbot");
  assert.equal(payload.approved, true);
  assert.ok(payload.signedIntent);
  assert.equal(payload.signedIntent.action, "SET_OPERATOR");
});

test("4. Build liquidate payload", () => {
  const client = new QmoosaDerivativesClient();
  const payload = client.buildLiquidatePayload({
    liquidator: "0xLiquidator1",
    positionId: "POS-ETH-USD-1"
  });

  assert.equal(payload.action, "LIQUIDATE");
  assert.equal(payload.liquidator, "0xliquidator1");
  assert.equal(payload.positionId, "POS-ETH-USD-1");
});

test("5. Fail-closed input validations (leverage, size, addresses)", () => {
  const client = new QmoosaDerivativesClient();

  // Excessive leverage > 20x
  assert.throws(() => {
    client.buildOpenPositionPayload({
      account: "0xUser1",
      symbol: "ETH-USD",
      isLong: true,
      size: 1n * WAD,
      collateral: 100n * WAD,
      leverage: 25n
    });
  }, /Leverage must be between 1x and 20x/);

  // Zero leverage
  assert.throws(() => {
    client.buildOpenPositionPayload({
      account: "0xUser1",
      symbol: "ETH-USD",
      isLong: true,
      size: 1n * WAD,
      collateral: 100n * WAD,
      leverage: 0n
    });
  }, /Leverage must be between 1x and 20x/);

  // Zero size
  assert.throws(() => {
    client.buildOpenPositionPayload({
      account: "0xUser1",
      symbol: "ETH-USD",
      isLong: true,
      size: 0n,
      collateral: 100n * WAD,
      leverage: 5n
    });
  }, /Position size must be strictly positive/);
});

test("6. Chain adapter dispatch and fail-closed error without adapter", async () => {
  const clientWithoutAdapter = new QmoosaDerivativesClient();
  const payload = clientWithoutAdapter.buildClosePositionPayload({
    account: "0xUser1",
    positionId: "POS-ETH-USD-1"
  });

  await assert.rejects(
    () => clientWithoutAdapter.sendTransaction(payload),
    /No chain adapter configured/
  );

  // Client with mock adapter
  let capturedTx = null;
  const mockAdapter = {
    async sendTransaction(req) {
      capturedTx = req;
      return { txHash: "0xMOCKTX123", status: "success" };
    }
  };

  const clientWithAdapter = new QmoosaDerivativesClient({ chainAdapter: mockAdapter });
  const res = await clientWithAdapter.sendTransaction(payload);
  assert.equal(res.status, "success");
  assert.equal(res.txHash, "0xMOCKTX123");
  assert.equal(capturedTx.positionId, "POS-ETH-USD-1");
});
