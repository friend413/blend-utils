import { Contract, Keypair, Address, ContractSpec } from 'soroban-client';
import { i128, u64 } from '@blend-capital/blend-sdk';
import { invokeAndUnwrap } from '../utils/tx.js';

/**
 * PriceData type
 */
export interface PriceData {
  price: i128;
  timestamp: u64;
}

/**
 * Asset type
 */
export type Asset =
  | { tag: 'Stellar'; values: readonly [Address] }
  | { tag: 'Other'; values: readonly [string] };

export class OracleClient {
  address: string;
  spec: ContractSpec;
  _contract: Contract;

  constructor(address: string) {
    this.address = address;
    this._contract = new Contract(address);
    this.spec = new ContractSpec([
      'AAAABAAAACFUaGUgZXJyb3IgY29kZXMgZm9yIHRoZSBjb250cmFjdC4AAAAAAAAAAAAAEFByaWNlT3JhY2xlRXJyb3IAAAABAAAAUVRoZSBjb25maWcgYXNzZXRzIGRvbid0IGNvbnRhaW4gcGVyc2lzdGVudCBhc3NldC4gRGVsZXRlIGFzc2V0cyBpcyBub3Qgc3VwcG9ydGVkLgAAAAAAAAxBc3NldE1pc3NpbmcAAAAC',
      'AAAAAAAAAAAAAAAIc2V0X2RhdGEAAAAFAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAABGJhc2UAAAfQAAAABUFzc2V0AAAAAAAAAAAAAAZhc3NldHMAAAAAA+oAAAfQAAAABUFzc2V0AAAAAAAAAAAAAAhkZWNpbWFscwAAAAQAAAAAAAAACnJlc29sdXRpb24AAAAAAAQAAAAA',
      'AAAAAAAAAAAAAAAJc2V0X3ByaWNlAAAAAAAAAgAAAAAAAAAGcHJpY2VzAAAAAAPqAAAACwAAAAAAAAAJdGltZXN0YW1wAAAAAAAABgAAAAA=',
      'AAAAAAAAAAAAAAAQc2V0X3ByaWNlX3N0YWJsZQAAAAEAAAAAAAAABnByaWNlcwAAAAAD6gAAAAsAAAAA',
      'AAAAAAAAAAAAAAAEYmFzZQAAAAAAAAABAAAH0AAAAAVBc3NldAAAAA==',
      'AAAAAAAAAAAAAAAGYXNzZXRzAAAAAAAAAAAAAQAAA+oAAAfQAAAABUFzc2V0AAAA',
      'AAAAAAAAAAAAAAAIZGVjaW1hbHMAAAAAAAAAAQAAAAQ=',
      'AAAAAAAAAAAAAAAKcmVzb2x1dGlvbgAAAAAAAAAAAAEAAAAE',
      'AAAAAAAAAAAAAAAFcHJpY2UAAAAAAAACAAAAAAAAAAVhc3NldAAAAAAAB9AAAAAFQXNzZXQAAAAAAAAAAAAACXRpbWVzdGFtcAAAAAAAAAYAAAABAAAD6AAAB9AAAAAJUHJpY2VEYXRhAAAA',
      'AAAAAAAAAAAAAAAGcHJpY2VzAAAAAAACAAAAAAAAAAVhc3NldAAAAAAAB9AAAAAFQXNzZXQAAAAAAAAAAAAAB3JlY29yZHMAAAAABAAAAAEAAAPoAAAD6gAAB9AAAAAJUHJpY2VEYXRhAAAA',
      'AAAAAAAAAAAAAAAJbGFzdHByaWNlAAAAAAAAAQAAAAAAAAAFYXNzZXQAAAAAAAfQAAAABUFzc2V0AAAAAAAAAQAAA+gAAAfQAAAACVByaWNlRGF0YQAAAA==',
      'AAAAAQAAAC9QcmljZSBkYXRhIGZvciBhbiBhc3NldCBhdCBhIHNwZWNpZmljIHRpbWVzdGFtcAAAAAAAAAAACVByaWNlRGF0YQAAAAAAAAIAAAAAAAAABXByaWNlAAAAAAAACwAAAAAAAAAJdGltZXN0YW1wAAAAAAAABg==',
      'AAAAAgAAAApBc3NldCB0eXBlAAAAAAAAAAAABUFzc2V0AAAAAAAAAgAAAAEAAAAAAAAAB1N0ZWxsYXIAAAAAAQAAABMAAAABAAAAAAAAAAVPdGhlcgAAAAAAAAEAAAAR',
    ]);
  }

  public async setData(
    admin: Address,
    base: Asset,
    assets: Array<Asset>,
    decimals: number,
    resolution: number,
    source: Keypair
  ) {
    const invokeArgs = this.spec.funcArgsToScVals('set_data', {
      admin,
      base,
      assets,
      decimals,
      resolution,
    });
    const operation = this._contract.call('set_data', ...invokeArgs);
    await invokeAndUnwrap(operation, source, () => undefined);
  }

  async setPrice(prices: Array<bigint>, timestamp: number, source: Keypair) {
    const invokeArgs = this.spec.funcArgsToScVals('set_price', { prices, timestamp });
    const operation = this._contract.call('set_price', ...invokeArgs);
    await invokeAndUnwrap(operation, source, () => undefined);
  }

  async setPriceStable(prices: Array<bigint>, source: Keypair) {
    const invokeArgs = this.spec.funcArgsToScVals('set_price_stable', { prices });
    const operation = this._contract.call('set_price_stable', ...invokeArgs);
    await invokeAndUnwrap(operation, source, () => undefined);
  }
}
