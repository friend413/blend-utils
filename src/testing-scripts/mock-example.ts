import {
  Request,
  RequestType,
  ReserveConfig,
  ReserveEmissionMetadata,
} from '@blend-capital/blend-sdk';
import { randomBytes } from 'crypto';
import { Asset, TransactionBuilder } from 'stellar-sdk';
import { airdropAccount } from '../utils/contract.js';
import { config } from '../utils/env_config.js';
import { TxParams, invokeClassicOp, invokeSorobanOperation, signWithKeypair } from '../utils/tx.js';
import { setupPool } from '../pool/pool-setup.js';
import { deployBlend } from '../deploy/blend.js';
import { tryDeployStellarAsset } from '../deploy/stellar-asset.js';
import { setupMockOracle } from './oracle-setup.js';
import { setupReserve } from '../pool/reserve-setup.js';
import { deployComet } from '../deploy/comet.js';
import { setupComet } from './comet-setup.js';
import { setupPoolBackstop } from './backstop-pool-setup.js';

const txBuilderOptions: TransactionBuilder.TransactionBuilderOptions = {
  fee: '10000',
  timebounds: {
    minTime: 0,
    maxTime: 0,
  },
  networkPassphrase: config.passphrase,
};
await mock();

async function mock() {
  const whale = config.getUser('WHALE');
  await airdropAccount(whale);
  await airdropAccount(config.admin);
  let adminTxParams: TxParams = {
    account: await config.rpc.getAccount(config.admin.publicKey()),
    txBuilderOptions,
    signerFunction: async (txXDR: string) => {
      return signWithKeypair(txXDR, config.passphrase, config.admin);
    },
  };
  let whaleTxParams: TxParams = {
    account: await config.rpc.getAccount(whale.publicKey()),
    txBuilderOptions,
    signerFunction: async (txXDR: string) => {
      return signWithKeypair(txXDR, config.passphrase, whale);
    },
  };

  const XLM = await tryDeployStellarAsset(Asset.native(), adminTxParams);
  const BLND = await tryDeployStellarAsset(
    new Asset('BLND', config.admin.publicKey()),
    adminTxParams
  );
  const USDC = await tryDeployStellarAsset(
    new Asset('USDC', config.admin.publicKey()),
    adminTxParams
  );
  const wETH = await tryDeployStellarAsset(
    new Asset('wETH', config.admin.publicKey()),
    adminTxParams
  );
  const wBTC = await tryDeployStellarAsset(
    new Asset('wBTC', config.admin.publicKey()),
    adminTxParams
  );
  let mockOracle = await setupMockOracle(adminTxParams);
  const cometContract = await deployComet(adminTxParams);
  const [backstopContract, emitterContract, poolFactoryContract] = await deployBlend(
    BLND.contractId(),
    cometContract.contractId(),
    USDC.contractId(),
    new Map(),
    adminTxParams
  );

  await setupComet(cometContract.contractId(), BLND.contractId(), USDC.contractId(), adminTxParams);

  // ********** Stellar Pool (XLM, USDC) **********//

  let stellarPool = await setupPool(
    {
      admin: config.admin.publicKey(),
      name: 'Stellar',
      salt: randomBytes(32),
      oracle: mockOracle.contractId(),
      backstop_take_rate: 0.1e7,
      max_positions: 4,
    },
    adminTxParams
  );

  const stellarPoolXlmReserveMetaData: ReserveConfig = {
    index: 0,
    decimals: 7,
    c_factor: 900_0000,
    l_factor: 850_0000,
    util: 500_0000,
    max_util: 950_0000,
    r_base: 5000,
    r_one: 30_0000,
    r_two: 200_0000,
    r_three: 1_000_0000,
    reactivity: 500,
  };
  await setupReserve(
    stellarPool.contractId(),
    {
      asset: Asset.native().contractId(config.passphrase),
      metadata: stellarPoolXlmReserveMetaData,
    },
    adminTxParams
  );

  const stellarPoolUsdcReserveMetaData: ReserveConfig = {
    index: 1,
    decimals: 7,
    c_factor: 950_0000,
    l_factor: 900_0000,
    util: 800_0000,
    max_util: 950_0000,
    r_base: 3000,
    r_one: 50_0000,
    r_three: 1_500_0000,
    r_two: 500_0000,
    reactivity: 1000,
  };

  await setupReserve(
    stellarPool.contractId(),
    { asset: USDC.contractId(), metadata: stellarPoolUsdcReserveMetaData },
    adminTxParams
  );

  const stellarPoolEmissionMetadata: ReserveEmissionMetadata[] = [
    {
      res_index: 0, // XLM
      res_type: 0, // d_token
      share: BigInt(0.7e7), // 50%
    },
    {
      res_index: 1, // USDC
      res_type: 1, // b_token
      share: BigInt(0.3e7), // 50%
    },
  ];
  await invokeSorobanOperation(
    stellarPool.setEmissionsConfig(stellarPoolEmissionMetadata),
    stellarPool.parsers.setEmissionsConfig,
    adminTxParams
  );

  await setupPoolBackstop(
    backstopContract.contractId(),
    stellarPool.contractId(),
    cometContract.contractId(),
    BLND.contractId(),
    USDC.contractId(),
    adminTxParams,
    whaleTxParams
  );

  //********** Bridge Pool (XLM, USDC) **********//

  let bridgePool = await setupPool(
    {
      admin: config.admin.publicKey(),
      name: 'Bridge',
      salt: randomBytes(32),
      oracle: mockOracle.contractId(),
      backstop_take_rate: 0.1e7,
      max_positions: 6,
    },
    adminTxParams
  );

  const bridgePoolXlmReserveMetaData: ReserveConfig = {
    index: 0,
    decimals: 7,
    c_factor: 900_0000,
    l_factor: 900_0000,
    util: 500_0000,
    max_util: 950_0000,
    r_base: 5000,
    r_one: 30_0000,
    r_two: 200_0000,
    r_three: 1_000_0000,
    reactivity: 500,
  };
  await setupReserve(
    bridgePool.contractId(),
    {
      asset: Asset.native().contractId(config.passphrase),
      metadata: bridgePoolXlmReserveMetaData,
    },
    adminTxParams
  );

  const wethReserveMetaData: ReserveConfig = {
    index: 1,
    decimals: 7,
    c_factor: 850_0000,
    l_factor: 800_0000,
    util: 650_0000,
    max_util: 950_0000,
    r_base: 7000,
    r_one: 50_0000,
    r_three: 1_500_0000,
    r_two: 500_0000,
    reactivity: 1000,
  };
  await setupReserve(
    bridgePool.contractId(),
    {
      asset: wETH.contractId(),
      metadata: wethReserveMetaData,
    },
    adminTxParams
  );

  const wbtcReserveMetaData: ReserveConfig = {
    index: 2,
    decimals: 7,
    c_factor: 900_0000,
    l_factor: 900_0000,
    util: 750_0000,
    max_util: 950_0000,
    r_base: 7000,
    r_one: 50_0000,
    r_three: 1_500_0000,
    r_two: 500_0000,
    reactivity: 1000,
  };
  await setupReserve(
    bridgePool.contractId(),
    {
      asset: wBTC.contractId(),
      metadata: wbtcReserveMetaData,
    },
    adminTxParams
  );

  const bridgeEmissionMetadata: ReserveEmissionMetadata[] = [
    {
      res_index: 1, // WETH
      res_type: 0, // d_token
      share: BigInt(0.5e7), // 50%
    },
    {
      res_index: 2, // WBTC
      res_type: 1, // b_token
      share: BigInt(0.5e7), // 50%
    },
  ];
  await invokeSorobanOperation(
    bridgePool.setEmissionsConfig(bridgeEmissionMetadata),
    bridgePool.parsers.setEmissionsConfig,
    adminTxParams
  );

  await setupPoolBackstop(
    backstopContract.contractId(),
    bridgePool.contractId(),
    cometContract.contractId(),
    BLND.contractId(),
    USDC.contractId(),
    adminTxParams,
    whaleTxParams
  );

  console.log('Transfer blnd admin to emitter\n');

  await invokeSorobanOperation(
    BLND.set_admin(emitterContract.contractId()),
    () => undefined,
    adminTxParams
  );

  console.log('Setting Asset Prices\n');
  setupMockOracle(adminTxParams);

  console.log('Minting tokens to whale\n');
  await invokeClassicOp(wETH.classic_trustline(whale.publicKey()), whaleTxParams);
  await invokeClassicOp(wBTC.classic_trustline(whale.publicKey()), whaleTxParams);
  await invokeClassicOp(wETH.classic_mint(whale.publicKey(), '100'), adminTxParams);
  await invokeClassicOp(wBTC.classic_mint(whale.publicKey(), '10'), adminTxParams);
  await invokeClassicOp(USDC.classic_mint(whale.publicKey(), '200000'), adminTxParams);

  console.log('Whale Supply tokens and borrowing from Stellar pool\n');
  const stellarRequests: Request[] = [
    {
      amount: BigInt(20000e7),
      request_type: RequestType.SupplyCollateral,
      address: USDC.contractId(),
    },
    {
      amount: BigInt(5000e7),
      request_type: RequestType.SupplyCollateral,
      address: XLM.contractId(),
    },
    {
      amount: BigInt(15000e7),
      request_type: RequestType.Borrow,
      address: USDC.contractId(),
    },
    {
      amount: BigInt(2000e7),
      request_type: RequestType.Borrow,
      address: XLM.contractId(),
    },
  ];
  await invokeSorobanOperation(
    stellarPool.submit({
      from: whale.publicKey(),
      spender: whale.publicKey(),
      to: whale.publicKey(),
      requests: stellarRequests,
    }),
    stellarPool.parsers.submit,
    whaleTxParams
  );

  console.log('Whale Supply tokens to Bridge pool\n');
  const bridgeSupplyRequests: Request[] = [
    {
      amount: BigInt(5000e7),
      request_type: RequestType.SupplyCollateral,
      address: XLM.contractId(),
    },
    {
      amount: BigInt(5e7),
      request_type: RequestType.SupplyCollateral,
      address: wETH.contractId(),
    },
    {
      amount: BigInt(0.5e7),
      request_type: RequestType.SupplyCollateral,
      address: wBTC.contractId(),
    },
  ];
  await invokeSorobanOperation(
    bridgePool.submit({
      from: whale.publicKey(),
      spender: whale.publicKey(),
      to: whale.publicKey(),
      requests: bridgeSupplyRequests,
    }),
    bridgePool.parsers.submit,
    whaleTxParams
  );

  console.log('Whale Borrow tokens from Bridge pool\n');
  const bridgeBorrowRequests: Request[] = [
    {
      amount: BigInt(2500e7),
      request_type: RequestType.Borrow,
      address: XLM.contractId(),
    },
    {
      amount: BigInt(3e7),
      request_type: RequestType.Borrow,
      address: wETH.contractId(),
    },
    {
      amount: BigInt(0.2e7),
      request_type: RequestType.Borrow,
      address: wBTC.contractId(),
    },
  ];
  await invokeSorobanOperation(
    bridgePool.submit({
      from: whale.publicKey(),
      spender: whale.publicKey(),
      to: whale.publicKey(),
      requests: bridgeBorrowRequests,
    }),
    bridgePool.parsers.submit,
    whaleTxParams
  );

  await invokeSorobanOperation(
    backstopContract.queueWithdrawal({
      from: whale.publicKey(),
      pool_address: stellarPool.contractId(),
      amount: BigInt(1000e7),
    }),
    backstopContract.parsers.queueWithdrawal,
    whaleTxParams
  );
}
