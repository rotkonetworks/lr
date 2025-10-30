// Ledger recovery crypto bundle
// Based on https://github.com/Zondax/ledger-substrate-js

import * as bip39 from 'bip39';
import * as bip32ed25519 from 'bip32-ed25519';
import * as blake from 'blakejs';
import bs58 from 'bs58';
import * as hash from 'hash.js';
import * as ed25519 from '@noble/ed25519';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';

// Set up @noble/ed25519 for browser
ed25519.etc.sha512Sync = (...m) => {
  let totalLength = 0;
  for (const msg of m) totalLength += msg.length;
  const concatenated = new Uint8Array(totalLength);
  let offset = 0;
  for (const msg of m) {
    concatenated.set(msg, offset);
    offset += msg.length;
  }
  const digest = hash.sha512().update(Array.from(concatenated)).digest();
  return new Uint8Array(digest);
};

// ============================================================================
// Helper functions
// ============================================================================

function sha512(data) {
  const digest = hash.sha512().update(data).digest();
  return Buffer.from(digest);
}

function hmac256(key, data) {
  const digest = hash.hmac(hash.sha256, key).update(data).digest();
  return Buffer.from(digest);
}

function hmac512(key, data) {
  const digest = hash.hmac(hash.sha512, key).update(data).digest();
  return Buffer.from(digest);
}

function ss58hash(data) {
  const hashContext = blake.blake2bInit(64, null);
  blake.blake2bUpdate(hashContext, Buffer.from('SS58PRE'));
  blake.blake2bUpdate(hashContext, data);
  return blake.blake2bFinal(hashContext);
}

// ============================================================================
// SS58 Address Encoding
// ============================================================================

function ss58Encode(prefix, pubkey) {
  if (pubkey.byteLength !== 32) {
    return null;
  }

  const data = Buffer.alloc(35);
  data[0] = prefix;
  pubkey.copy(data, 1);
  const hash = ss58hash(data.subarray(0, 33));
  data[33] = hash[0];
  data[34] = hash[1];

  return bs58.encode(data);
}

function ss58Decode(address) {
  const decoded = bs58.decode(address);
  const hash = ss58hash(decoded.subarray(0, 33));

  if (decoded[33] !== hash[0] || decoded[34] !== hash[1]) {
    throw new Error('Invalid SS58 checksum');
  }

  return {
    prefix: decoded[0],
    pubkey: decoded.subarray(1, 33)
  };
}

// ============================================================================
// SLIP-10 Ed25519 Key Derivation
// ============================================================================

const HDPATH_0_DEFAULT = 0x8000002c;

function rootNodeSlip10(masterSeed) {
  const data = Buffer.alloc(1 + 64);
  data[0] = 0x01;
  masterSeed.copy(data, 1);
  const c = hmac256('ed25519 seed', data);
  let I = hmac512('ed25519 seed', data.subarray(1));
  let kL = I.subarray(0, 32);
  let kR = I.subarray(32);

  while ((kL[31] & 32) !== 0) {
    I.copy(data, 1);
    I = hmac512('ed25519 seed', data.subarray(1));
    kL = I.subarray(0, 32);
    kR = I.subarray(32);
  }

  kL[0] &= 248;
  kL[31] &= 127;
  kL[31] |= 64;

  return Buffer.concat([kL, kR, c]);
}

// ============================================================================
// Main Key Derivation Function
// ============================================================================

function hdKeyDerivation(
  mnemonic,
  password,
  slip0044,
  accountIndex,
  changeIndex,
  addressIndex,
  ss58prefix
) {
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic');
  }

  const seed = bip39.mnemonicToSeedSync(mnemonic, password);
  let node = rootNodeSlip10(seed);
  node = bip32ed25519.derivePrivate(node, HDPATH_0_DEFAULT);
  node = bip32ed25519.derivePrivate(node, slip0044);
  node = bip32ed25519.derivePrivate(node, accountIndex);
  node = bip32ed25519.derivePrivate(node, changeIndex);
  node = bip32ed25519.derivePrivate(node, addressIndex);

  // Keep the full extended key for signing
  const extendedSecretKey = node;
  const kL = node.subarray(0, 32);
  const sk = sha512(kL).subarray(0, 32);
  sk[0] &= 248;
  sk[31] &= 127;
  sk[31] |= 64;

  const pk = bip32ed25519.toPublic(sk);
  const address = ss58Encode(ss58prefix, pk);

  return {
    extendedSecretKey,  // Full 96-byte extended key for BIP32-Ed25519 signing
    secretKey: sk,
    publicKey: pk,
    address: address,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

function u8aToHex(bytes) {
  return '0x' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToU8a(hex) {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
}

// ============================================================================
// Public API
// ============================================================================

// Compact encode a number
function compactEncode(value) {
  if (value < 64) {
    return new Uint8Array([value << 2]);
  } else if (value < 16384) {
    return new Uint8Array([
      ((value & 0x3f) << 2) | 0x01,
      (value >> 6) & 0xff
    ]);
  } else if (value < 1073741824) {
    return new Uint8Array([
      ((value & 0x3f) << 2) | 0x02,
      (value >> 6) & 0xff,
      (value >> 14) & 0xff,
      (value >> 22) & 0xff
    ]);
  } else {
    const bytes = [];
    let val = value;
    while (val > 0) {
      bytes.push(val & 0xff);
      val >>= 8;
    }
    return new Uint8Array([0x03 + ((bytes.length - 4) << 2), ...bytes]);
  }
}

// Parse JSON payload and construct txBlob (Ledger-style)
function constructTxBlob(payload) {
  // Payload from papi-console contains:
  // - callData
  // - signedExtensions { identifier, value, additionalSigned }

  let parts = [];

  // Add callData first
  parts.push(hexToU8a(payload.callData));

  // Add all extension values, then all additionalSigned
  // Order matters! Must match runtime order
  const extensions = Object.values(payload.signedExtensions);

  // First: all values
  for (const ext of extensions) {
    if (ext.value && ext.value !== '0x') {
      parts.push(hexToU8a(ext.value));
    }
  }

  // Then: all additionalSigned
  for (const ext of extensions) {
    if (ext.additionalSigned && ext.additionalSigned !== '0x') {
      parts.push(hexToU8a(ext.additionalSigned));
    }
  }

  // Concatenate all parts
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const txBlob = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    txBlob.set(part, offset);
    offset += part.length;
  }

  return txBlob;
}

// Hash payload if > 256 bytes (Ledger rule)
function prepareSigningPayload(txBlob) {
  if (txBlob.length > 256) {
    // Hash with blake2b_256
    const hashContext = blake.blake2bInit(32, null);
    blake.blake2bUpdate(hashContext, txBlob);
    return new Uint8Array(blake.blake2bFinal(hashContext));
  }
  return txBlob;
}

async function deriveAndSign(mnemonic, accountIndex, ss58prefix, unsignedTxHex, useLegacy = true) {
  const HARDENED = 0x80000000;

  // Use correct slip44 coin type based on network
  // Polkadot (prefix 0) = 354, Kusama (prefix 2) = 434
  const slip44 = ss58prefix === 0 ? 354 : ss58prefix === 2 ? 434 : 354;
  const slip0044 = HARDENED + slip44;

  const account = useLegacy
    ? hdKeyDerivation(mnemonic, '', slip0044, HARDENED + accountIndex, HARDENED, HARDENED, ss58prefix)
    : hdKeyDerivation(mnemonic, '', slip0044, HARDENED + accountIndex, 0, 0, ss58prefix);

  // Check if input is JSON payload or hex
  let signingPayload;
  if (typeof unsignedTxHex === 'object') {
    // JSON payload from papi-console
    const txBlob = constructTxBlob(unsignedTxHex);
    signingPayload = prepareSigningPayload(txBlob);
  } else {
    // Legacy hex format
    signingPayload = hexToU8a(unsignedTxHex);
  }

  // Sign the transaction using BIP32-Ed25519
  const signature = bip32ed25519.sign(signingPayload, account.extendedSecretKey);

  // Construct proper signed extrinsic
  let extrinsicData;

  if (typeof unsignedTxHex === 'object') {
    // JSON payload - construct extrinsic data from extensions + callData
    const payload = unsignedTxHex;
    const parts = [];

    // Add extension values (era, nonce, tip)
    const extensions = Object.values(payload.signedExtensions);
    for (const ext of extensions) {
      if (ext.value && ext.value !== '0x') {
        parts.push(hexToU8a(ext.value));
      }
    }

    // Add callData (method)
    parts.push(hexToU8a(payload.callData));

    // Concatenate
    const totalLen = parts.reduce((sum, p) => sum + p.length, 0);
    extrinsicData = new Uint8Array(totalLen);
    let off = 0;
    for (const part of parts) {
      extrinsicData.set(part, off);
      off += part.length;
    }
  } else {
    // Legacy hex format - parse unsigned extrinsic (remove length prefix if present)
    let unsignedBytes = hexToU8a(unsignedTxHex);
    let offset = 0;

    // Check if first byte is a compact length
    if (unsignedBytes[0] < 0xfc) {
      // Skip compact length prefix
      if ((unsignedBytes[0] & 0x03) === 0x00) {
        offset = 1;
      } else if ((unsignedBytes[0] & 0x03) === 0x01) {
        offset = 2;
      } else if ((unsignedBytes[0] & 0x03) === 0x02) {
        offset = 4;
      }
    }

    extrinsicData = unsignedBytes.slice(offset);
  }

  // Build signed extrinsic
  const signedData = new Uint8Array([
    0x84, // version 4 + signed bit
    0x00, // AccountId type (Id variant)
    ...account.publicKey, // 32 bytes
    0x01, // Ed25519 signature type
    ...signature, // 64 bytes
    ...extrinsicData // era, nonce, tip, method
  ]);

  // Add compact length prefix
  const lengthPrefix = compactEncode(signedData.length);
  const finalExtrinsic = new Uint8Array(lengthPrefix.length + signedData.length);
  finalExtrinsic.set(lengthPrefix, 0);
  finalExtrinsic.set(signedData, lengthPrefix.length);

  return {
    address: account.address,
    publicKey: u8aToHex(account.publicKey),
    signature: u8aToHex(signature),
    signedTx: u8aToHex(finalExtrinsic)
  };
}

// Export to global scope for HTML usage
window.cryptoBundle = {
  deriveAndSign,
  u8aToHex,
  hexToU8a,
  validateMnemonic: (mnemonic) => bip39.validateMnemonic(mnemonic),
  QRCode,
  Html5Qrcode
};
