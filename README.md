# Polkadot Ledger Offline Signer

Single-file airgapped transaction signer for Polkadot/Kusama.

## Features

- **Airgapped**: Webcam QR in → QR out, no USB/clipboard needed
- **Self-Contained**: Single 938KB HTML file, works completely offline
- **Ledger Compatible**: BIP32-Ed25519, Legacy + Generic derivation modes

## Security

The tool will **NOT work** unless:
1. ✓ Opened as local file (`file://` protocol)
2. ✓ Internet is disconnected (offline mode)

**Recommended Setup:**
1. Download `ledger-recovery.html` to USB stick
2. Boot **Tails OS** from USB
3. Disconnect all network (WiFi + ethernet)
4. Open the HTML file in Tails browser
5. The tool will verify you're offline before showing the form

**Minimum Setup:**
1. Save `ledger-recovery.html` to your computer
2. Disconnect from internet completely
3. Open the file directly (file://)
4. Red security warning will block usage if online

## Usage

**Airgapped Workflow:**
1. Online: Create extrinstic → Show QR (papi.how)
2. Offline: Scan QR → Sign TX → Show QR
3. Online: Scan QR → Broadcast(pjs/curl rpc)

**Manual Workflow:**
1. Online: Copy unsigned TX hex
2. Offline: Paste → Sign → Copy signed hex
3. Online: Paste → Broadcast

## Technical

**Derivation:** BIP32-Ed25519 (Ledger compatible)
**Paths:** Legacy `m/44'/434'/0'/0'/0'` | Generic `m/44'/434'/0'/0/0`
**Networks:** Kusama (434) | Polkadot (354)
**Signing:** Ed25519 via [@noble/ed25519](https://github.com/paulmillr/noble-ed25519)

## Build

```bash
npm install && npm run build
```

## License

Apache-2.0
