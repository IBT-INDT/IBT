// IBT Mesh Wallet Logic - Decentralized P2P Trading Engine
const gun = Gun({
    peers: ['https://gun-manhattan.herokuapp.com/gun'] // Using a default relay peer for demo
});

// State Management
const appState = {
    user: {
        id: localStorage.getItem('peer_id') || `ibt_${Math.random().toString(36).substr(2, 9)}`,
        balance: 21000000, // Pre-funded for admin demonstration
        staking: 0,
        txHistory: []
    },
    network: {
        totalSupply: 21000000,
        feePoolAdmin: 0,
        feePoolValidators: 0,
        peerCount: 1
    }
};

// LocalStorage Sync for ID
localStorage.setItem('peer_id', appState.user.id);

// Gun DB References
const mesh = gun.get('ibt_mesh_v01');
const stats = mesh.get('stats');
const txLog = mesh.get('transactions');

// Update UI Functions
function updateUI() {
    const supplyEl = document.getElementById('total-supply');
    const balanceEl = document.getElementById('user-balance');
    const feePoolEl = document.getElementById('fee-pool');
    const validatorPoolEl = document.getElementById('validator-pool');
    const peerDisplay = document.getElementById('peer-count');
    const nodeIdDisplay = document.getElementById('node-id');
    const wallIdDisplay = document.getElementById('wallet-id-display');

    if (supplyEl) supplyEl.innerText = `${appState.network.totalSupply.toLocaleString()} IBT`;
    if (balanceEl) balanceEl.innerText = `${appState.user.balance.toLocaleString()} IBT`;
    if (feePoolEl) feePoolEl.innerText = `${appState.network.feePoolAdmin.toFixed(2)} IBT`;
    if (validatorPoolEl) validatorPoolEl.innerText = `${appState.network.feePoolValidators.toFixed(2)} IBT`;
    if (nodeIdDisplay) nodeIdDisplay.innerText = appState.user.id;
    if (wallIdDisplay) wallIdDisplay.innerText = appState.user.id;
    if (peerDisplay) peerDisplay.innerText = `${appState.network.peerCount} Connected`;
}

// Transaction Logic
async function processTransaction(receiverId, amount) {
    if (amount <= 0 || appState.user.balance < amount) {
        showToast("Invalid amount or insufficient balance", "error");
        return;
    }

    const fee = amount * 0.005; // 0.50% fee
    const adminShare = fee * 0.70; // 70% of fee
    const validatorShare = fee * 0.30; // 30% of fee
    const totalDeduction = amount + fee;

    if (appState.user.balance < totalDeduction) {
        showToast("Insufficient balance to cover 0.50% network fee", "error");
        return;
    }

    // Update Local State
    appState.user.balance -= totalDeduction;
    
    // Push to Mesh (P2P Gossip)
    const txData = {
        id: Math.random().toString(16).substr(2, 8),
        sender: appState.user.id,
        receiver: receiverId,
        amount: amount,
        fee: fee,
        timestamp: Date.now()
    };

    txLog.get(txData.id).put(txData);
    
    // Update Network Stats on Mesh
    stats.get('feePoolAdmin').once(v => stats.get('feePoolAdmin').put((v || 0) + adminShare));
    stats.get('feePoolValidators').once(v => stats.get('feePoolValidators').put((v || 0) + validatorShare));

    showToast(`Successfully sent ${amount} IBT (Fee: ${fee.toFixed(2)})`, "success");
    updateUI();
}

// Minting Logic (Admin Only Simulation)
function mintAssets(receiverId, amount) {
    appState.network.totalSupply += amount;
    stats.get('totalSupply').put(appState.network.totalSupply);
    
    // Record as Mint transaction
    const mintTx = {
        id: "MINT_" + Date.now(),
        sender: "SYSTEM_GENESIS",
        receiver: receiverId,
        amount: amount,
        fee: 0,
        timestamp: Date.now()
    };
    txLog.get(mintTx.id).put(mintTx);
    
    showToast(`Minted ${amount} IBT to ${receiverId}`, "success");
    updateUI();
}

// Toast System
function showToast(message, type = "success") {
    const container = document.getElementById('toast-container') || document.body;
    const toast = document.createElement('div');
    toast.className = 'card animate';
    toast.style.cssText = `
        padding: 10px 20px; 
        margin-top: 10px; 
        border-left: 4px solid ${type === "success" ? "var(--success)" : "var(--error)"};
        background: rgba(15, 23, 42, 0.9);
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 250px;
    `;
    toast.innerHTML = `<i data-feather="${type === 'success' ? 'check-circle' : 'alert-circle'}" style="color: ${type === 'success' ? 'var(--success)' : 'var(--error)'}"></i> ${message}`;
    container.appendChild(toast);
    feather.replace();
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// Copy ID Functionality
document.addEventListener('click', (e) => {
    if (e.target.closest('#wallet-id-display') || e.target.closest('.user-badge i')) {
        navigator.clipboard.writeText(appState.user.id);
        showToast("Wallet ID Copied!", "success");
    }
});

// Event Listeners for Forms
document.addEventListener('DOMContentLoaded', () => {
    // Sync stats from Mesh
    stats.on(data => {
        if (data.totalSupply) appState.network.totalSupply = data.totalSupply;
        if (data.feePoolAdmin) appState.network.feePoolAdmin = data.feePoolAdmin;
        if (data.feePoolValidators) appState.network.feePoolValidators = data.feePoolValidators;
        updateUI();
    });

    // Populate TX Ledger
    txLog.map().on((msg, id) => {
        if (!msg) return;
        const tbody = document.getElementById('tx-tbody') || document.getElementById('user-tx-tbody');
        if (!tbody) return;

        // Hide "No TX" msg
        const emptyMsg = document.getElementById('no-tx-msg');
        if (emptyMsg) {
            emptyMsg.style.display = 'none';
            document.getElementById('tx-table').style.display = 'table';
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-family: monospace; color: var(--primary);">0x${msg.id}</td>
            <td>${msg.sender === "SYSTEM_GENESIS" ? "Mint" : "P2P"}</td>
            <td>${msg.amount.toLocaleString()} IBT</td>
            <td style="${msg.sender === "SYSTEM_GENESIS" ? 'color: var(--success)' : ''}">${msg.sender === "SYSTEM_GENESIS" ? 'Genesis' : msg.fee.toFixed(2)}</td>
        `;
        tbody.prepend(row);
    });

    // Handle Mint Button
    const mintBtn = document.querySelector('.main-content button.btn-primary[style*="justify-content: center"]');
    if (mintBtn && window.location.pathname.includes('admin')) {
        mintBtn.onclick = () => {
            const receiver = document.querySelector('input[placeholder*="Mesh ID"]').value;
            const amount = parseFloat(document.querySelector('input[placeholder="0.00"]').value);
            mintAssets(receiver, amount);
        };
    }

    // Handle Send Button
    const sendBtn = document.querySelector('section.card button.btn-primary');
    if (sendBtn && window.location.pathname.includes('index')) {
        sendBtn.onclick = () => {
            const receiver = document.querySelector('input[placeholder*="Peer/Wallet"]').value;
            const amount = parseFloat(document.querySelector('input[placeholder="0.00"]').value);
            processTransaction(receiver, amount);
        };
    }

    updateUI();
});

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            console.log('IBT Mesh SW Registered!', reg.scope);
        }).catch(err => {
            console.log('SW Registration failed:', err);
        });
    });
}
