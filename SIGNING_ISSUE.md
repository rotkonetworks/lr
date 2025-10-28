# Signing Issue Analysis

## Problem
Getting error: `Unsupported unsigned extrinsic version 99`

This happens when trying to submit the "signed" transaction to RPC.

## Root Cause
Our current code in `crypto.js` line 202:
```javascript
signedTx: u8aToHex(signature) + unsignedTxHex.slice(2)
```

This is **WRONG**. We're just concatenating signature + payload, which doesn't create a valid Substrate extrinsic.

## What We're Receiving
From tools like papi.how, the user gets a **signing payload** (not a full unsigned extrinsic).

The signing payload is what needs to be signed, but it's NOT what gets submitted to the chain.

## Substrate Signed Extrinsic Format

A proper signed extrinsic has this structure:

```
[version byte] [sender] [signature] [era] [nonce] [tip] [method]
```

Specifically for Ed25519:
- Version: 0x84 (bit 7 set = signed, bits 0-6 = version 4)
- Sender: MultiAddress format (0x00 + 32 bytes public key for Ed25519)
- Signature: 0x01 (Ed25519 type) + 64 bytes signature
- Era: Compact encoded mortality
- Nonce: Compact encoded
- Tip: Compact encoded
- Method: The actual call data

## The Fix

We need to properly construct the signed extrinsic instead of just concatenating.

## Options

### Option 1: Use @polkadot/api
Install @polkadot/api and use it to construct signed extrinsics properly.

### Option 2: Manual Construction
Parse the signing payload, extract era/nonce/tip/method, and manually construct the signed extrinsic with proper encoding.

### Option 3: Different Input Format
Instead of signing payloads, have users provide the full unsigned extrinsic and we inject the signature in the right place.

## Recommendation
Use Option 1 (@polkadot/api) as it handles all the complex encoding correctly.
