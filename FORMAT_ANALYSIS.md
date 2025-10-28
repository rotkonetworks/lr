# Extrinsic Format Analysis

## What We've Implemented

Our fixed `crypto.js` (lines 209-268) constructs a signed extrinsic with this format:

```
[compact_length] [0x84] [0x00] [publicKey 32b] [0x01] [signature 64b] [input_data]
```

Where:
- `0x84` = Version byte for signed v4 extrinsic
- `0x00` = MultiAddress type (Id variant for AccountId32)
- `publicKey` = 32-byte Ed25519 public key
- `0x01` = Signature type (Ed25519)
- `signature` = 64-byte Ed25519 signature
- `input_data` = The data you provide as "unsigned extrinsic"

## What `input_data` Should Contain

The `input_data` should be: **[era][nonce][tip][method]**

- `era`: Mortality period (1 byte `0x00` for immortal)
- `nonce`: Account nonce (compact encoded)
- `tip`: Transaction tip (compact encoded, often `0x00`)
- `method`: The actual call data (pallet + call + args)

## Your Example Data

```
Unsigned: 0x1e0100d01ec8518f4e2a34834d5d62d8091e8aee663e4446bf8c1ad1d9b02e58a225680300000000
Signature: 0xece7ceaee9b9d7db84305339f0ede2d7d93cbaec01a0243e214e6c38a10ae23d259d9dbc998e2f37133356057abf3cf43e07ae5938dd78c8fd1c9823c4650908
```

The first byte `0x1e` could be:
1. A compact length prefix (saying "30 bytes follow")
2. Or part of the actual data

If it's a length prefix, the actual data is 39 bytes.
If it's not, the actual data is 40 bytes.

## How to Verify

Compare against reference tools:

### Option 1: Use subkey
```bash
# Sign with subkey
subkey sign --hex <hex_payload> --suri "<mnemonic>"

# Generate signed extrinsic with subkey
subkey sign-transaction ...
```

### Option 2: Use parity-signer or polkadot.js
Create a test transaction and compare:
1. What hex they give you to sign
2. What signature they produce
3. What signed extrinsic they produce

### Option 3: Check papi.how documentation
Look at what they call the field and what format they expect back.

## Key Questions

1. **What does papi.how call the hex field?**
   - "Unsigned extrinsic"?
   - "Signing payload"?
   - "Transaction data"?

2. **Does it include a length prefix?**
   - If yes: we skip it correctly
   - If no: we might be skipping valid data

3. **What do they expect back?**
   - Just the signature?
   - The full signed extrinsic?

## Testing

To test if our implementation is correct:

1. Use our tool to sign a transaction
2. Use subkey or parity-signer to sign the SAME transaction with the SAME mnemonic
3. Compare the signatures - they should match
4. Compare the signed extrinsics - they should match

## Parity-Signer Approach

Parity-signer only returns the **signature**, not the full signed extrinsic. The online tool constructs the signed extrinsic.

Our tool returns the **full signed extrinsic** because it's meant for air-gapped use where you take the complete signed transaction back online to submit.

This is valid, but we need to ensure the format matches what the RPC expects.
