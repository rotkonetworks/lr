const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// Build the crypto bundle
esbuild.build({
  entryPoints: ['crypto.js'],
  bundle: true,
  format: 'iife',
  outfile: 'crypto-bundle.js',
  minify: true,
  platform: 'browser',
  target: 'es2020',
  inject: ['./buffer-shim.js'],
  define: {
    'global': 'globalThis',
    'process.env.NODE_ENV': '"production"'
  }
}).then(() => {
  console.log('✓ Crypto bundle created');

  // Read the bundled crypto code
  const cryptoBundle = fs.readFileSync('crypto-bundle.js', 'utf8');

  // Create the final HTML file
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ledger Offline Signer</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: monospace;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #000;
            color: #fff;
            line-height: 1.5;
        }
        @media (max-width: 600px) {
            body {
                padding: 10px;
                font-size: 14px;
            }
            h1 {
                font-size: 14px !important;
            }
            .subtitle {
                font-size: 11px !important;
            }
        }
        h1 {
            font-size: 16px;
            font-weight: normal;
            margin-bottom: 5px;
        }
        .subtitle {
            font-size: 12px;
            color: #888;
            margin-bottom: 20px;
        }
        .warning {
            border: 1px solid #fff;
            padding: 10px;
            margin: 20px 0;
        }
        .online, .offline {
            border: 1px solid #fff;
            padding: 10px;
            margin: 20px 0;
            text-align: center;
        }
        .online { background: #000; color: #f00; }
        .offline { background: #000; color: #0f0; }
        label {
            display: block;
            margin: 20px 0 5px 0;
            font-size: 12px;
        }
        textarea, input, select {
            width: 100%;
            padding: 8px;
            margin: 5px 0;
            font-family: monospace;
            font-size: 12px;
            background: #000;
            border: 1px solid #fff;
            color: #fff;
        }
        input[type="number"] { width: 100px; }
        @media (max-width: 600px) {
            textarea, input, select {
                font-size: 14px;
                padding: 10px;
            }
            input[type="number"] {
                width: 100%;
            }
        }
        button {
            padding: 10px 20px;
            background: #000;
            color: #fff;
            border: 1px solid #fff;
            cursor: pointer;
            font-family: monospace;
            font-size: 12px;
            margin: 5px;
            flex: 1;
            min-width: 120px;
        }
        button:hover { background: #222; }
        button:active { background: #111; }
        .button-group {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin: 20px 0;
        }
        .button-group button {
            margin: 0;
        }
        @media (max-width: 600px) {
            button {
                font-size: 11px;
                padding: 12px;
            }
            .button-group {
                flex-direction: column;
            }
            .button-group button {
                width: 100%;
            }
        }
        .results {
            border: 1px solid #fff;
            padding: 10px;
            margin: 20px 0;
            display: none;
        }
        .results.show { display: block; }
        code {
            display: block;
            word-break: break-all;
            background: #000;
            padding: 10px;
            margin: 10px 0;
            font-size: 11px;
            border: 1px solid #fff;
        }
        .error {
            background: #000;
            color: #f00;
            padding: 10px;
            margin: 20px 0;
            display: none;
            border: 1px solid #f00;
        }
        .info {
            color: #888;
            font-size: 11px;
        }
        hr {
            border: none;
            border-top: 1px solid #fff;
            margin: 30px 0;
        }
        #qrcode {
            border: 1px solid #fff;
            display: inline-block;
        }
        #qrReaderView {
            border: 1px solid #fff;
            max-width: 500px;
            margin: 0 auto;
        }
        #qrReaderView video {
            width: 100%;
            border: 1px solid #fff;
        }
    </style>
</head>
<body>
    <h1>Ledger Offline Signer</h1>
    <div class="subtitle" id="pathInfo">Derivation path</div>

    <div id="securityBlock" style="display: none; background: #000; color: #f00; padding: 20px; border: 1px solid #f00; margin: 20px 0;">
        <div id="securityMessage" style="margin: 10px 0; font-size: 14px;"></div>
    </div>

    <div id="networkStatus" class="online">
        ONLINE - DISCONNECT NOW
    </div>

    <div id="downloadSection" style="display: none; border: 1px solid #fff; padding: 20px; margin: 20px 0; text-align: center;">
        <h2 style="font-size: 14px; margin-bottom: 10px;">Save this page to your local drive</h2>
        <p style="font-size: 12px; margin-bottom: 15px;">
            Please <a href="." download="index.html" style="color: #0f0; font-weight: bold;">save this HTML file</a> to your computer, then open it from there.
        </p>
        <div style="font-size: 11px; color: #888;">
            After opening: disconnect internet to use
        </div>
    </div>

    <div id="error" class="error"></div>

    <div id="mainContent" style="display: none;">
        <label>Mnemonic <span id="mnemonicStatus" class="info"></span></label>
        <textarea id="mnemonic" rows="2" placeholder="24-word mnemonic"></textarea>

    <label>Derivation Mode</label>
    <select id="derivationMode">
        <option value="legacy">Legacy (m/44'/354'/acc'/0'/0')</option>
        <option value="generic">Generic (m/44'/354'/acc'/0/0)</option>
    </select>

    <label>Network</label>
    <select id="network">
        <option value="0">Polkadot</option>
        <option value="2">Kusama</option>
    </select>

    <label>Account Index <span class="info">(0=first, 1=second, ...)</span></label>
    <input type="number" id="accountIndex" value="0" min="0" max="999">

    <div id="addressResult" class="results">
        <strong>Address</strong>
        <code id="derivedAddress"></code>
    </div>

    <hr>

    <form onsubmit="signTransaction(event)">
        <label>Extrinsic to sign <span class="info">(paste or scan with camera below)</span></label>
        <textarea id="unsignedTx" rows="4" placeholder="0x..."></textarea>

        <div class="button-group">
            <button type="button" onclick="toggleQrScanner()">📷 SCAN UNSIGNED EXTRINSIC</button>
            <button type="submit">SIGN</button>
        </div>

        <div id="qrReader" style="display: none; margin: 20px 0;">
            <div id="qrReaderView"></div>
            <button type="button" onclick="stopQrScanner()" style="margin-top: 10px; width: 100%;">STOP CAMERA</button>
        </div>
    </form>

    <div id="signResults" class="results">
        <strong>Signature</strong>
        <code id="signature"></code>

        <strong>Signed TX</strong>
        <code id="signedTx"></code>

        <strong>QR Code <span class="info">(scan with online device)</span></strong>
        <div style="text-align: center; margin: 10px 0;">
            <canvas id="qrcode"></canvas>
        </div>
    </div>
    </div>

    <script>
${cryptoBundle}

        const isLocalFile = window.location.protocol === 'file:';
        const isOnline = navigator.onLine;

        // Show download prompt if not local file
        if (!isLocalFile) {
            document.getElementById('downloadSection').style.display = 'block';
        }
        // Show offline prompt if local but online
        else if (isOnline) {
            const securityBlock = document.getElementById('securityBlock');
            const securityMessage = document.getElementById('securityMessage');
            securityMessage.textContent = 'Disconnect internet and refresh page.';
            securityBlock.style.display = 'block';
        }
        // All good: local file + offline
        else {
            document.getElementById('mainContent').style.display = 'block';
        }

        // Monitor network changes
        const checkOnlineStatus = () => {
            if (isLocalFile && navigator.onLine) {
                document.getElementById('mainContent').style.display = 'none';
                document.getElementById('securityBlock').style.display = 'block';
            } else if (isLocalFile && !navigator.onLine) {
                document.getElementById('securityBlock').style.display = 'none';
                document.getElementById('mainContent').style.display = 'block';
            }
        };

        window.addEventListener('online', checkOnlineStatus);
        window.addEventListener('offline', checkOnlineStatus);

        function updateNetworkStatus() {
            const statusDiv = document.getElementById('networkStatus');
            if (!navigator.onLine) {
                statusDiv.className = 'offline';
                statusDiv.textContent = 'OFFLINE';
            } else {
                statusDiv.className = 'online';
                statusDiv.textContent = 'ONLINE - DISCONNECT NOW';
            }
        }

        window.addEventListener('online', updateNetworkStatus);
        window.addEventListener('offline', updateNetworkStatus);
        updateNetworkStatus();

        function showError(message) {
            const errorDiv = document.getElementById('error');
            errorDiv.textContent = 'ERROR: ' + message;
            errorDiv.style.display = 'block';
        }

        function hideError() {
            document.getElementById('error').style.display = 'none';
        }

        let currentAccount = null;

        function updatePathInfo() {
            const mode = document.getElementById('derivationMode').value;
            const pathInfo = document.getElementById('pathInfo');
            if (mode === 'legacy') {
                pathInfo.textContent = "Path: m/44'/354'/acc'/0'/0'";
            } else {
                pathInfo.textContent = "Path: m/44'/354'/acc'/0/0";
            }
        }

        async function deriveAddress() {
            document.getElementById('addressResult').classList.remove('show');
            const statusEl = document.getElementById('mnemonicStatus');

            try {
                const mnemonic = document.getElementById('mnemonic').value.trim();
                const network = parseInt(document.getElementById('network').value);
                const accountIndex = parseInt(document.getElementById('accountIndex').value);
                const useLegacy = document.getElementById('derivationMode').value === 'legacy';

                if (!mnemonic) {
                    currentAccount = null;
                    hideError();
                    statusEl.textContent = '';
                    return;
                }

                const words = mnemonic.split(/\\s+/);
                statusEl.textContent = '(' + words.length + ' words)';

                if (words.length !== 12 && words.length !== 24) {
                    currentAccount = null;
                    showError('ERROR: Need 12 or 24 words, got ' + words.length);
                    return;
                }

                if (!cryptoBundle.validateMnemonic(mnemonic)) {
                    currentAccount = null;
                    showError('ERROR: Invalid mnemonic checksum');
                    return;
                }

                hideError();
                statusEl.textContent = '(validating...)';

                // Derive without signing (just use empty tx)
                const result = await cryptoBundle.deriveAndSign(mnemonic, accountIndex, network, '0x00', useLegacy);

                currentAccount = result;
                statusEl.textContent = '(✓ valid)';
                document.getElementById('derivedAddress').textContent = result.address;
                document.getElementById('addressResult').classList.add('show');

            } catch (err) {
                currentAccount = null;
                statusEl.textContent = '';
                showError('Derive error: ' + err.message);
            }
        }

        async function signTransaction(event) {
            event.preventDefault();
            document.getElementById('signResults').classList.remove('show');

            try {
                const unsignedTx = document.getElementById('unsignedTx').value.trim();

                if (!unsignedTx || !unsignedTx.startsWith('0x')) {
                    showError('ERROR: Transaction must start with 0x');
                    return;
                }

                // Re-derive to be safe
                const mnemonic = document.getElementById('mnemonic').value.trim();
                if (!mnemonic) {
                    showError('ERROR: Enter mnemonic first');
                    return;
                }

                const network = parseInt(document.getElementById('network').value);
                const accountIndex = parseInt(document.getElementById('accountIndex').value);
                const useLegacy = document.getElementById('derivationMode').value === 'legacy';

                hideError();

                const result = await cryptoBundle.deriveAndSign(
                    mnemonic,
                    accountIndex,
                    network,
                    unsignedTx,
                    useLegacy
                );

                document.getElementById('signature').textContent = result.signature;
                document.getElementById('signedTx').textContent = result.signedTx;

                // Generate QR code for signed transaction
                const canvas = document.getElementById('qrcode');
                try {
                    await cryptoBundle.QRCode.toCanvas(canvas, result.signedTx, {
                        width: 300,
                        margin: 2,
                        color: {
                            dark: '#ffffff',
                            light: '#000000'
                        }
                    });
                } catch (qrErr) {
                    console.error('QR code generation failed:', qrErr);
                }

                document.getElementById('signResults').classList.add('show');

            } catch (err) {
                showError('Sign error: ' + err.message);
            }
        }

        // QR Scanner for unsigned transactions
        let html5QrCode = null;

        async function toggleQrScanner() {
            const readerDiv = document.getElementById('qrReader');

            if (readerDiv.style.display === 'none') {
                readerDiv.style.display = 'block';

                try {
                    html5QrCode = new cryptoBundle.Html5Qrcode("qrReaderView");

                    await html5QrCode.start(
                        { facingMode: "environment" },
                        {
                            fps: 10,
                            qrbox: { width: 250, height: 250 }
                        },
                        (decodedText) => {
                            // Extract hex from decoded text
                            let hex = decodedText.trim();

                            // Check if it's a URL with data= parameter
                            if (hex.includes('data=')) {
                                const match = hex.match(/data=(0x[0-9a-fA-F]+)/);
                                if (match) {
                                    hex = match[1];
                                }
                            }

                            // Ensure it starts with 0x
                            if (!hex.startsWith('0x')) {
                                hex = '0x' + hex;
                            }

                            // Set the textarea
                            document.getElementById('unsignedTx').value = hex;

                            // Stop scanning
                            stopQrScanner();

                            hideError();
                        },
                        (errorMessage) => {
                            // Scanning in progress, no error to show
                        }
                    );
                } catch (err) {
                    showError('Camera error: ' + err.message);
                    readerDiv.style.display = 'none';
                }
            }
        }

        async function stopQrScanner() {
            if (html5QrCode) {
                try {
                    await html5QrCode.stop();
                    html5QrCode.clear();
                    html5QrCode = null;
                } catch (err) {
                    console.error('Error stopping scanner:', err);
                }
            }
            document.getElementById('qrReader').style.display = 'none';
        }

        // Auto-validate on input (only if security checks passed)
        if (securityPassed) {
            updatePathInfo();
            document.getElementById('mnemonic').addEventListener('input', deriveAddress);
            document.getElementById('derivationMode').addEventListener('change', () => {
                updatePathInfo();
                deriveAddress();
            });
            document.getElementById('network').addEventListener('change', deriveAddress);
            document.getElementById('accountIndex').addEventListener('input', deriveAddress);
        }
    </script>

    <div style="text-align: center; color: #888; margin-top: 40px; font-size: 10px; border-top: 1px solid #333; padding-top: 20px;">
        v2.3.0 | Ed25519 SLIP-10 | QR in/out | webcam | file:// + offline only
    </div>
</body>
</html>`;

  // Write the final HTML file
  fs.writeFileSync('index.html', html);
  console.log('✓ Created index.html');
  console.log('');
  console.log('File ready for offline use!');
  console.log('Save this file and disconnect from internet before entering mnemonic.');

}).catch((e) => {
  console.error('Build failed:', e);
  process.exit(1);
});
