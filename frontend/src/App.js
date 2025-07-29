// App.js (UPDATED - With 20-second success delay)

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Wallet, isAddress, parseEther, formatEther, JsonRpcProvider, Contract,
  parseUnits, formatUnits, Interface, BigNumber
} from "ethers";
import { QRCodeCanvas } from "qrcode.react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// --- CONFIGURATION (Unchanged) ---
const API_URL = "http://localhost:5001";
const provider = new JsonRpcProvider("https://bsc-testnet-dataseed.bnbchain.org");
const TOKEN_ADDRESSES = {
  USDT: "0x787A697324dbA4AB965C58CD33c13ff5eeA6295F",
  USDC: "0x342e3aA1248AB77E319e3331C6fD3f1F2d4B36B1",
};
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

const StatusIndicator = ({ status }) => {
  if (status === 'Success') return <span style={{ color: '#22c55e', fontWeight: 'bold' }}>✅ Success</span>;
  if (status === 'Failed') return <span style={{ color: '#ef4444', fontWeight: 'bold' }}>❌ Failed</span>;
  return <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>⏳ Pending</span>;
};

function App() {
  // --- STATE MANAGEMENT (Simplified) ---
  const [walletData, setWalletData] = useState(null);
  const [walletName, setWalletName] = useState("");
  const [searchName, setSearchName] = useState("");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [tokenType, setTokenType] = useState("BNB");
  const [balances, setBalances] = useState({ BNB: "...", USDT: "...", USDC: "..." });
  const [ledger, setLedger] =useState([]);
  const [loading, setLoading] = useState({});
  const [showQR, setShowQR] = useState(true);
  const qrRef = useRef();
  const [pendingTxs, setPendingTxs] = useState([]);
  const [showSensitive, setShowSensitive] = useState(false);
  const [estimatedFee, setEstimatedFee] = useState(null);
  const [isFeeLoading, setFeeLoading] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [newContactName, setNewContactName] = useState("");
  const [newContactAddress, setNewContactAddress] = useState("");

  const setLoader = (key, value) => setLoading((prev) => ({ ...prev, [key]: value }));
  const notify = (msg, type = "info") => toast[type](msg);

  const displayedHistory = useMemo(() => {
    const pendingWithStatus = pendingTxs.map(tx => ({ ...tx, status: 'Pending', timestamp: new Date().toISOString() }));
    const confirmedFiltered = ledger.filter(
      confirmedTx => !pendingTxs.some(pendingTx => pendingTx.hash === confirmedTx.hash)
    );
    return [...pendingWithStatus, ...confirmedFiltered].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [pendingTxs, ledger]);

  // --- WALLET MANAGEMENT (Reverted to simple create/load) ---
  const generateAndSaveWallet = async () => {
    if (!walletName.trim()) return notify("Enter a wallet name", "error");
    setLoader("creating", true);
    try {
      const wallet = Wallet.createRandom();
      const payload = { name: walletName, address: wallet.address, privateKey: wallet.privateKey, mnemonic: wallet.mnemonic.phrase };
      const res = await fetch(`${API_URL}/api/wallet`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.ok) {
        notify("✅ Wallet created successfully!", "success");
        setWalletName("");
      } else {
        notify(`❌ ${data.error || 'Save failed'}`, "error");
      }
    } catch (e) { notify("❌ Server error", "error"); }
    finally { setLoader("creating", false); }
  };

  const fetchWalletByName = async () => {
    if (!searchName.trim()) return notify("Enter wallet name to fetch", "error");
    setLoader("fetching", true);
    try {
      const res = await fetch(`${API_URL}/api/wallet/${searchName}`);
      const data = await res.json();
      if (res.ok) {
        notify(`✅ Wallet "${data.name}" loaded!`, "success");
        setWalletData(data);
        fetchAllBalances(data.address);
        fetchLedger(data.address);
        fetchContacts(data.address);
      } else {
        notify(`❌ ${data.error}`, "error");
        setWalletData(null);
      }
    } catch (e) {
      notify("❌ Error fetching wallet", "error");
    } finally {
      setLoader("fetching", false);
    }
  };
  
  const lockWallet = () => {
      setWalletData(null); setLedger([]); setBalances({ BNB: "...", USDT: "...", USDC: "..." });
      setContacts([]); notify("🔒 Wallet Locked", "info");
  }

  const fetchAllBalances = useCallback(async (address) => { /* ... no changes ... */
    setLoader("balance", true);
    try {
      const bnb = await provider.getBalance(address);
      const tokenPromises = Object.entries(TOKEN_ADDRESSES).map(async ([symbol, addr]) => {
        const contract = new Contract(addr, ERC20_ABI, provider);
        const [bal, decimals] = await Promise.all([contract.balanceOf(address), contract.decimals()]);
        return [symbol, formatUnits(bal, decimals)];
      });
      const tokenBals = Object.fromEntries(await Promise.all(tokenPromises));
      setBalances({ BNB: formatEther(bnb), ...tokenBals });
    } catch (e) { console.error(e); notify("Balance fetch failed", "error"); }
    finally { setLoader("balance", false); }
  }, []);

  const fetchLedger = useCallback(async (address) => { /* ... no changes ... */
    if (!address) return;
    setLoader("ledger", true);
    try {
      const res = await fetch(`${API_URL}/api/ledger/${address}`);
      const data = await res.json();
      setLedger(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); notify("History fetch failed", "error"); }
    finally { setLoader("ledger", false); }
  }, []);
  
  const sendTokens = async () => {
    if (!walletData || !isAddress(recipient) || !amount || parseFloat(amount) <= 0)
      return notify("❌ Invalid inputs", "error");
    setLoader("sending", true);
    const toastId = toast.loading("Submitting transaction...");
    try {
      const wallet = new Wallet(walletData.privateKey, provider);
      const nonce = await provider.getTransactionCount(wallet.address, "pending");
      let txRequest;
      if (tokenType === "BNB") {
        txRequest = { to: recipient, value: parseEther(amount), nonce };
      } else {
        const contractAddress = TOKEN_ADDRESSES[tokenType];
        const tokenContract = new Contract(contractAddress, ERC20_ABI, wallet);
        const decimals = await tokenContract.decimals();
        const data = tokenContract.interface.encodeFunctionData("transfer", [recipient, parseUnits(amount, decimals)]);
        txRequest = { to: contractAddress, data, nonce };
      }
      const tx = await wallet.sendTransaction(txRequest);
      const pendingTxData = {
        hash: tx.hash, from: wallet.address.toLowerCase(), to: recipient.toLowerCase(),
        amount: amount, token: tokenType, nonce: tx.nonce, gasPrice: tx.gasPrice.toString(),
      };
      setPendingTxs(prev => [pendingTxData, ...prev]);
      toast.update(toastId, { render: "✅ Transaction Submitted! Now pending...", type: "success", isLoading: false, autoClose: 5000 });
      setRecipient(""); setAmount("");

      // --- MODIFICATION START ---
      // This block handles the transaction confirmation.
      tx.wait().then(async (receipt) => {
        // The transaction is confirmed on-chain here.
        toast.success(<span><b>Transaction Confirmed!</b><br/>Finalizing status update...</span>);
        
        // We now wait 20 seconds before updating the UI from "Pending" to "Success".
        setTimeout(async () => {
          await fetch(`${API_URL}/api/tx/${receipt.hash}`, { method: 'POST' });
          setPendingTxs(prev => prev.filter(p => p.hash !== receipt.hash));
          fetchAllBalances(wallet.address);
          fetchLedger(wallet.address);
        }, 20000); // 20-second delay

      }).catch(err => {
        // If the transaction fails, update the UI immediately.
        if (err.reason !== 'transaction replaced') toast.error("Transaction failed or was dropped.");
        setPendingTxs(prev => prev.filter(p => p.hash !== tx.hash));
      });
      // --- MODIFICATION END ---

    } catch (e) {
      toast.update(toastId, { render: `❌ ${e.reason || "Submission Failed"}`, type: "error", isLoading: false, autoClose: 5000 });
    } finally { setLoader("sending", false); }
  };

  const handleCancel = async (txToCancel) => { /* ... no changes ... */
    if (!window.confirm("Cancel transaction? This will cost a small gas fee.")) return;
    const toastId = toast.loading("Submitting cancellation...");
    try {
      const wallet = new Wallet(walletData.privateKey, provider);
      const feeData = await provider.getFeeData();
      const newGasPrice = (feeData.gasPrice * 12n) / 10n;
      const cancelTx = await wallet.sendTransaction({ to: wallet.address, value: 0, nonce: txToCancel.nonce, gasPrice: newGasPrice });
      toast.update(toastId, { render: "✅ Cancellation sent! Waiting for confirmation...", type: "info", isLoading: false, autoClose: 5000 });
      await cancelTx.wait();
      toast.success("Original transaction cancelled!");
      setPendingTxs(prev => prev.filter(p => p.nonce !== txToCancel.nonce));
    } catch (e) {
      toast.update(toastId, { render: `❌ ${e.reason || "Cancellation Failed"}`, type: "error", isLoading: false, autoClose: 5000 });
    }
  };

  const fetchContacts = useCallback(async (address) => { /* ... no changes ... */
    if (!address) return;
    try {
        const res = await fetch(`${API_URL}/api/contacts/${address}`);
        if(res.ok) setContacts(await res.json());
    } catch (e) { console.error("Could not fetch contacts"); }
  }, []);

  const handleAddContact = async () => { /* ... no changes ... */
    if (!newContactName.trim() || !isAddress(newContactAddress)) return notify("Invalid name or address", "error");
    const payload = { walletAddress: walletData.address, contactName: newContactName, contactAddress: newContactAddress };
    try {
        const res = await fetch(`${API_URL}/api/contacts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if(!res.ok) throw new Error("Failed to save");
        notify("✅ Contact Added!", "success");
        setNewContactName(""); setNewContactAddress("");
        fetchContacts(walletData.address);
    } catch(e) { notify("❌ Could not save contact", "error"); }
  };

  const handleDeleteContact = async (contactId) => { /* ... no changes ... */
    if (!window.confirm("Delete this contact?")) return;
    try {
        await fetch(`${API_URL}/api/contacts/${contactId}`, { method: 'DELETE' });
        notify("🗑️ Contact deleted", "info");
        fetchContacts(walletData.address);
    } catch (e) { notify("❌ Could not delete contact", "error"); }
  };
  
  useEffect(() => { /* ... no changes to gas estimation ... */
    const estimate = async () => {
        if (!walletData || !isAddress(recipient) || !amount || parseFloat(amount) <= 0) {
            setEstimatedFee(null); return;
        }
        setFeeLoading(true);
        try {
            const feeData = await provider.getFeeData();
            let gasLimit;
            if (tokenType === "BNB") {
                gasLimit = await provider.estimateGas({ to: recipient, value: parseEther(amount) });
            } else {
                const contract = new Contract(TOKEN_ADDRESSES[tokenType], ERC20_ABI, provider);
                const data = contract.interface.encodeFunctionData("transfer", [recipient, parseUnits(amount, await contract.decimals())]);
                gasLimit = await provider.estimateGas({ to: TOKEN_ADDRESSES[tokenType], from: walletData.address, data });
            }
            setEstimatedFee(formatEther(feeData.gasPrice * gasLimit));
        } catch (e) { setEstimatedFee(null); }
        finally { setFeeLoading(false); }
    };
    const debounce = setTimeout(estimate, 500);
    return () => clearTimeout(debounce);
  }, [amount, recipient, tokenType, walletData]);

  // --- RENDER LOGIC (No changes) ---
  if (!walletData) {
      return (
          <div style={styles.container}>
              <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
              <h1 style={styles.title}>🦜 Goan Wallet</h1>
              <section style={styles.section}>
                  <input placeholder="🖊 Create wallet name" value={walletName} onChange={(e) => setWalletName(e.target.value)} style={styles.input} />
                  <button onClick={generateAndSaveWallet} style={styles.buttonGreen}>{loading.creating ? "⏳ Saving..." : "✅ Generate & Save"}</button>
              </section>
              <section style={styles.section}>
                  <input placeholder="🔍 Load wallet by name" value={searchName} onChange={(e) => setSearchName(e.target.value)} style={styles.input} />
                  <button onClick={fetchWalletByName} style={styles.buttonBlue}>{loading.fetching ? "⏳ Loading..." : "📥 Load Wallet"}</button>
              </section>
          </div>
      )
  }

  return (
    <div style={styles.container}>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
      <div style={styles.header}>
        <h1 style={styles.title}>🦜 Goan Wallet</h1>
        <button onClick={lockWallet} style={styles.lockButton}>Lock Wallet 🔒</button>
      </div>
      <div style={styles.walletBox}>
          <h2>{walletData.name}</h2>
          <p onClick={() => { navigator.clipboard.writeText(walletData.address); notify("Copied!"); }} style={{ cursor: "pointer", wordBreak: 'break-all' }}>
              <strong>🏦 Address:</strong> {walletData.address} 📋
          </p>
          <div style={{marginTop: "20px"}}>
              <button onClick={() => setShowQR(!showQR)} style={styles.toggle}>{showQR ? "🙈 Hide QR" : "📱 Show QR"}</button>
              {showQR && (<div ref={qrRef} style={{ marginTop: "10px", background: 'white', padding: '10px', display: 'inline-block' }}><QRCodeCanvas value={walletData.address} size={130} /></div>)}
          </div>
          <hr style={styles.hr} />
          <h3>📊 Balances</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {Object.entries(balances).map(([symbol, value]) => (<li key={symbol}>{symbol === "BNB" ? "💰" : "💵"} {symbol}: <strong>{parseFloat(value).toFixed(4)}</strong></li>))}
          </ul>
          <button onClick={() => fetchAllBalances(walletData.address)} style={{...styles.buttonBlue, padding: '8px 16px', fontSize: '14px'}}>Refresh</button>
          <hr style={styles.hr} />
          <h3>🚀 Send Tokens</h3>
          <select value={tokenType} onChange={(e) => setTokenType(e.target.value)} style={styles.input}>
            <option value="BNB">BNB</option><option value="USDT">USDT</option><option value="USDC">USDC</option>
          </select>
          <div style={{position: 'relative', display: 'flex', alignItems: 'center'}}>
            <input placeholder="📤 Recipient Address" value={recipient} onChange={(e) => setRecipient(e.target.value)} style={styles.input} />
            <button title="Select from Contacts" onClick={() => { if(contacts.length > 0) setRecipient(contacts[0].contactAddress) }} style={styles.contactButton}>👥</button>
          </div>
          <input placeholder="💰 Amount" value={amount} onChange={(e) => setAmount(e.target.value)} style={styles.input} type="number" />
          <button onClick={sendTokens} style={styles.buttonOrange} disabled={loading.sending}>{loading.sending ? "⏳ Sending..." : "🚀 Send"}</button>
          <p style={styles.feeDisplay}>Estimated Fee: {isFeeLoading ? "..." : estimatedFee ? `~${parseFloat(estimatedFee).toFixed(6)} BNB` : "N/A"}</p>
          <hr style={styles.hr} />
          <h3>👥 Address Book</h3>
          <div style={styles.addContactForm}>
             <input placeholder="Contact Name" value={newContactName} onChange={(e) => setNewContactName(e.target.value)} style={styles.inputSmall} />
             <input placeholder="Contact Address (0x...)" value={newContactAddress} onChange={(e) => setNewContactAddress(e.target.value)} style={styles.inputSmall} />
             <button onClick={handleAddContact} style={styles.buttonGreen}>Add</button>
          </div>
          <div style={styles.contactList}>
             {contacts.length > 0 ? contacts.map(c => (
                 <div key={c._id} style={styles.contactItem}>
                     <span onClick={() => setRecipient(c.contactAddress)} style={{cursor: 'pointer'}}><strong>{c.contactName}</strong>: {c.contactAddress.slice(0,6)}...{c.contactAddress.slice(-4)}</span>
                     <button onClick={() => handleDeleteContact(c._id)} style={styles.deleteButton}>🗑️</button>
                 </div>
             )) : <p>No contacts saved.</p>}
          </div>
          <hr style={styles.hr} />
          <h3>🔐 Security & Secrets</h3>
          <button onClick={() => setShowSensitive(p => !p)} style={styles.toggle}>{showSensitive ? "🙈 Hide Secrets" : "👁️ Reveal Secrets"}</button>
          {showSensitive && (
              <div style={styles.secretsBox}>
                  <p><strong>Private Key:</strong><textarea readOnly value={walletData.privateKey} style={styles.textarea}/></p>
                  <p><strong>Mnemonic:</strong><textarea readOnly value={walletData.mnemonic} style={styles.textarea}/></p>
              </div>
          )}
      </div>
      <div style={{...styles.walletBox, marginTop: "30px"}}>
          <h3>📜 Transaction History</h3>
          <div style={styles.ledgerContainer}>
              {(loading.ledger && displayedHistory.length === 0) ? <p>Loading history...</p> : 
               displayedHistory.length > 0 ? displayedHistory.map(tx => {
                   const isSent = tx.from.toLowerCase() === walletData.address.toLowerCase();
                   return (
                       <div key={tx.hash} style={styles.ledgerTx}>
                           <p><strong>{isSent ? <span style={{color: '#f97316'}}>[OUT]</span> : <span style={{color: '#16a34a'}}>[IN]</span>}</strong> {tx.amount} {tx.token}</p>
                           <p><a href={`https://testnet.bscscan.com/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer">{tx.hash.substring(0, 15)}...</a></p>
                           <p><strong>Status:</strong> <StatusIndicator status={tx.status} /></p>
                           {tx.status === 'Pending' ? (
                               <button onClick={() => handleCancel(tx)} style={styles.cancelButton}>Cancel</button>
                           ) : (
                               <p><strong>Date:</strong> {new Date(tx.timestamp).toLocaleString()}</p>
                           )}
                       </div>
                   )
               }) : <p>No transactions found.</p>
              }
          </div>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", background: "linear-gradient(to right, #3b82f6, #9333ea)", padding: "40px 20px", fontFamily: "Segoe UI, sans-serif", color: "#fff", },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1000px', margin: '0 auto'},
  lockButton: { padding: '10px 15px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  title: { fontSize: "2.5rem", marginBottom: "30px", textAlign: 'center'},
  walletBox: { backgroundColor: "#1e293b", padding: "30px", marginTop: "20px", borderRadius: "12px", maxWidth: "700px", marginInline: "auto", textAlign: "left", boxShadow: "0 0 20px rgba(0,0,0,0.5)", },
  input: { display: 'block', boxSizing: 'border-box', padding: "12px", margin: "10px 0", width: "100%", borderRadius: "10px", border: "none", fontSize: "16px", backgroundColor: "#f0f0f0", color: "#111", },
  buttonGreen: { padding: "12px 24px", backgroundColor: "#16a34a", borderRadius: "10px", color: "#fff", fontWeight: "bold", fontSize: "16px", cursor: "pointer", border: 'none', width: '100%', marginTop: '10px' },
  buttonBlue: { padding: "12px 24px", backgroundColor: "#2563eb", borderRadius: "10px", color: "#fff", fontWeight: "bold", fontSize: "16px", cursor: "pointer", border: 'none', width: '100%', marginTop: '10px' },
  buttonOrange: { padding: "12px 24px", backgroundColor: "#f97316", borderRadius: "10px", color: "#fff", fontWeight: "bold", fontSize: "16px", cursor: "pointer", border: 'none', width: '100%', marginTop: '10px' },
  toggle: { marginLeft: "10px", padding: "5px 10px", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", },
  hr: { border: 'none', borderTop: '1px solid #374151', margin: '25px 0' },
  feeDisplay: { textAlign: 'right', fontSize: '14px', color: '#cbd5e1', marginTop: '10px' },
  ledgerContainer: { maxHeight: '400px', overflowY: 'auto', backgroundColor: '#111827', padding: '15px', borderRadius: '8px', marginTop: '10px', },
  ledgerTx: { borderBottom: '1px solid #374151', paddingBottom: '10px', marginBottom: '10px', fontSize: '14px', },
  cancelButton: { padding: '4px 8px', fontSize: '12px', background: '#f87171', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer'},
  secretsBox: { marginTop: '15px', background: '#111827', padding: '15px', borderRadius: '8px' },
  textarea: { width: '100%', background: '#374151', color: 'white', border: 'none', borderRadius: '5px', padding: '8px', minHeight: '60px', resize: 'vertical' },
  addContactForm: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
  inputSmall: { padding: "10px", borderRadius: "8px", border: "none", fontSize: "14px", backgroundColor: "#f0f0f0", color: "#111", flex: 1 },
  contactList: { marginTop: '15px' },
  contactItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111827', padding: '8px 12px', borderRadius: '6px', marginBottom: '5px' },
  deleteButton: { background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '18px' },
  contactButton: { padding: '10px', background: '#2563eb', border: 'none', borderRadius: '0 10px 10px 0', cursor: 'pointer', marginLeft: '-10px'},
  section: { marginBottom: "25px", maxWidth: '500px', margin: '25px auto'},
};

export default App;