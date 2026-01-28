// Configuration
const CONFIG = {
    solana: {
        name: "SOLANA",
        rpc: "https://api.devnet.solana.com",
        usdc: "4zMMC9MSDR3xyvRestbtz5Wyd4G7SUnSpxB3S6B3D64S",
        symbol: "SOL"
    },
    ethereum: {
        name: "ETHEREUM",
        rpc: "https://rpc.ankr.com/eth_goerli", // Goerli as fallback for dev
        symbol: "ETH"
    }
};

// State
let mnemonic = "";
let wallets = [];
let currentChain = "solana";
let isWatchOnly = false;

// DOM Elements - Navigation
const navResetBtn = document.getElementById('nav-reset-btn');
const currentChainName = document.getElementById('current-chain-name');

// DOM Elements - Sections
const homeSection = document.getElementById('home-section');
const importSection = document.getElementById('import-section');
const watchSection = document.getElementById('watch-section');
const dashboardSection = document.getElementById('dashboard-section');

// DOM Elements - Home
const generateBtn = document.getElementById('generate-btn');
const importTriggerBtn = document.getElementById('import-trigger-btn');
const watchTriggerBtn = document.getElementById('watch-trigger-btn');
const chainBtns = document.querySelectorAll('.chain-btn');

// DOM Elements - Import
const importBtn = document.getElementById('import-btn');
const importBackBtn = document.getElementById('import-back-btn');
const importInput = document.getElementById('import-input');
const importError = document.getElementById('import-error');

// DOM Elements - Watch
const watchBtn = document.getElementById('watch-btn');
const watchBackBtn = document.getElementById('watch-back-btn');
const watchInput = document.getElementById('watch-input');
const watchError = document.getElementById('watch-error');

// DOM Elements - Dashboard
const addWalletBtn = document.getElementById('add-wallet-btn');
const refreshBtn = document.getElementById('refresh-balances');
const toggleSeedBtn = document.getElementById('toggle-seed');
const seedContainer = document.getElementById('seed-container');
const seedGrid = document.getElementById('seed-grid');
const walletList = document.getElementById('wallet-list');
const copyBtn = document.getElementById('copy-seed');

// Initialize Solana Connection
let solanaConnection = new solanaWeb3.Connection(CONFIG.solana.rpc);

// --- State Management ---

function showSection(sectionId) {
    [homeSection, importSection, watchSection, dashboardSection].forEach(s => s.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');

    if (sectionId === 'dashboard-section') {
        navResetBtn.classList.remove('hidden');
    } else {
        navResetBtn.classList.add('hidden');
    }
}

function updateChain(chain) {
    currentChain = chain;
    currentChainName.innerText = CONFIG[chain].name;
    chainBtns.forEach(btn => {
        if (btn.dataset.chain === chain) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// --- Core functions ---

async function createNewWallet() {
    const randomEntropy = ethers.randomBytes(16);
    mnemonic = ethers.Mnemonic.fromEntropy(randomEntropy).phrase;
    isWatchOnly = false;
    startWallet();
}

async function startWallet() {
    wallets = [];
    if (!isWatchOnly) {
        displaySeed();
        seedContainer.parentElement.classList.remove('hidden');
        await deriveWallet(0);
    } else {
        seedContainer.parentElement.classList.add('hidden');
    }
    showSection('dashboard-section');
}

function displaySeed() {
    seedGrid.innerHTML = '';
    mnemonic.split(' ').forEach((word, index) => {
        const wordDiv = document.createElement('div');
        wordDiv.className = 'seed-word';
        wordDiv.innerHTML = `<span class="word-index">${index + 1}</span> <span>${word}</span>`;
        seedGrid.appendChild(wordDiv);
    });
}

function handleImport() {
    const input = importInput.value.trim().toLowerCase();
    if (ethers.Mnemonic.isValidMnemonic(input)) {
        mnemonic = input;
        isWatchOnly = false;
        importError.classList.add('hidden');
        importInput.value = '';
        startWallet();
    } else {
        importError.classList.remove('hidden');
    }
}

function handleWatch() {
    const address = watchInput.value.trim();
    if (isValidAddress(address)) {
        isWatchOnly = true;
        const walletData = {
            index: 0,
            publicKey: address,
            label: `Watched Wallet`,
            balance: '0.0000',
            loading: true,
            isWatched: true,
            chain: currentChain
        };
        wallets = [walletData];
        watchError.classList.add('hidden');
        watchInput.value = '';
        showSection('dashboard-section');
        seedContainer.parentElement.classList.add('hidden');
        renderWallets();
        fetchBalances(walletData);
    } else {
        watchError.classList.remove('hidden');
    }
}

function isValidAddress(address) {
    if (currentChain === 'solana') {
        try {
            new solanaWeb3.PublicKey(address);
            return true;
        } catch { return false; }
    } else {
        return ethers.isAddress(address);
    }
}

async function deriveWallet(index) {
    if (!mnemonic) return;

    try {
        const mnemonicObj = ethers.Mnemonic.fromPhrase(mnemonic);
        let publicKey = "";

        if (currentChain === 'solana') {
            const seed = mnemonicObj.computeSeed();
            const hdKey = window.ed25519HdKey || window.ed25519HDKey;
            const path = `m/44'/501'/${index}'/0'`;
            const derived = hdKey.derivePath(path, seed.slice(2));
            const keypair = solanaWeb3.Keypair.fromSeed(derived.key);
            publicKey = keypair.publicKey.toString();
        } else if (currentChain === 'ethereum') {
            // Ethereum
            const wallet = ethers.HDNodeWallet.fromMnemonic(mnemonicObj, `m/44'/60'/0'/0/${index}`);
            publicKey = wallet.address;
        }

        const walletData = {
            index,
            publicKey,
            label: `Account ${index + 1}`,
            balance: '0.0000',
            loading: true,
            chain: currentChain
        };

        wallets.push(walletData);
        renderWallets();
        fetchBalances(walletData);
    } catch (err) {
        console.error("Derivation error:", err);
    }
}

async function fetchBalances(walletData) {
    try {
        if (walletData.chain === 'solana') {
            const pubKey = new solanaWeb3.PublicKey(walletData.publicKey);
            const solBalance = await solanaConnection.getBalance(pubKey);
            walletData.balance = (solBalance / solanaWeb3.LAMPORTS_PER_SOL).toFixed(4);
        } else {
            // Ethereum Balance (simple mock or actual fetch if RPC is good)
            try {
                const provider = new ethers.JsonRpcProvider(CONFIG.ethereum.rpc);
                const balance = await provider.getBalance(walletData.publicKey);
                walletData.balance = ethers.formatEther(balance).slice(0, 8);
            } catch (e) {
                walletData.balance = "0.0000";
            }
        }

        walletData.loading = false;
        renderWallets();
    } catch (err) {
        console.error("Balance fetch error:", err);
        walletData.loading = false;
        renderWallets();
    }
}

function renderWallets() {
    walletList.innerHTML = '';
    wallets.forEach((w) => {
        const card = document.createElement('div');
        card.className = 'wallet-card fade-in';
        card.innerHTML = `
            <div class="wallet-card-header">
                <div class="wallet-info" style="flex: 1;">
                    <div class="wallet-label">${w.label} ${w.isWatched ? '(Watched)' : ''}</div>
                    <div class="wallet-address">${w.publicKey}</div>
                </div>
                <button class="btn-icon copy-addr" data-addr="${w.publicKey}" title="Copy Address">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
            </div>
            <div class="wallet-balances">
                <div class="balance-item">
                    <span class="balance-value">${w.loading ? '...' : w.balance}</span>
                    <span class="balance-symbol">${CONFIG[w.chain].symbol}</span>
                </div>
            </div>
        `;
        walletList.appendChild(card);
    });

    // Add copy listeners
    document.querySelectorAll('.copy-addr').forEach(btn => {
        btn.onclick = (e) => {
            const addr = btn.getAttribute('data-addr');
            navigator.clipboard.writeText(addr);
            const original = btn.innerHTML;
            btn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="#22c55e" stroke-width="2" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>';
            setTimeout(() => btn.innerHTML = original, 2000);
        };
    });
}

function logout() {
    if (confirm("Reset everything?")) {
        mnemonic = "";
        wallets = [];
        isWatchOnly = false;
        showSection('home-section');
    }
}

// --- Event Listeners ---

chainBtns.forEach(btn => {
    btn.onclick = () => updateChain(btn.dataset.chain);
});

generateBtn.onclick = createNewWallet;
importTriggerBtn.onclick = () => showSection('import-section');
watchTriggerBtn.onclick = () => showSection('watch-section');

importBackBtn.onclick = () => showSection('home-section');
watchBackBtn.onclick = () => showSection('home-section');

importBtn.onclick = handleImport;
watchBtn.onclick = handleWatch;
navResetBtn.onclick = logout;

addWalletBtn.onclick = () => {
    if (!isWatchOnly) {
        deriveWallet(wallets.length);
    } else {
        alert("You cannot add wallets in Watch-Only mode.");
    }
};

refreshBtn.onclick = () => {
    wallets.forEach(w => {
        w.loading = true;
        renderWallets();
        fetchBalances(w);
    });
};

toggleSeedBtn.onclick = () => {
    const isHidden = seedContainer.classList.contains('hidden');
    if (isHidden) {
        seedContainer.classList.remove('hidden');
        toggleSeedBtn.innerText = 'Hide';
    } else {
        seedContainer.classList.add('hidden');
        toggleSeedBtn.innerText = 'Show';
    }
};

copyBtn.onclick = () => {
    navigator.clipboard.writeText(mnemonic);
    const originalText = copyBtn.innerText;
    copyBtn.innerText = 'Copied!';
    setTimeout(() => copyBtn.innerText = originalText, 2000);
};

// Handle Enter keys
importInput.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleImport();
    }
};

watchInput.onkeydown = (e) => {
    if (e.key === 'Enter') handleWatch();
};
