import React, { useState } from "react";
import {
  Wallet,
  isAddress,
  parseEther,
  formatEther,
  JsonRpcProvider,
  Contract,
  parseUnits,
  formatUnits,
} from "ethers";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

const provider = new JsonRpcProvider("https://bsc-testnet-dataseed.bnbchain.org");

const TOKEN_ADDRESSES = {
  USDT: "0x787A697324dbA4AB965C58CD33c13ff5eeA6295F",
  USDC: "0x342e3aA1248AB77E319e3331C6fD3f1F2d4B36B1",
};

function App() {
  const [walletData, setWalletData] = useState(null);
  const [walletName, setWalletName] = useState("");
  const [searchName, setSearchName] = useState("");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [bnbBalance, setBnbBalance] = useState(null);
  const [usdtBalance, setUsdtBalance] = useState(null);
  const [usdcBalance, setUsdcBalance] = useState(null);
  const [tokenType, setTokenType] = useState("BNB");
  const [txHashInput, setTxHashInput] = useState("");
  const [txDetails, setTxDetails] = useState(null);
  const [loading, setLoading] = useState({
    creating: false,
    fetching: false,
    balance: false,
    sending: false,
    tx: false,
  });

  const setLoader = (key, value) => {
    setLoading((prev) => ({ ...prev, [key]: value }));
  };

  const generateAndSaveWallet = async () => {
    if (!walletName.trim()) return alert("Enter a wallet name");
    setLoader("creating", true);
    const wallet = Wallet.createRandom();
    const newWallet = {
      name: walletName,
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic.phrase,
    };

    try {
      const res = await fetch("http://localhost:5001/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWallet),
      });
      if (res.ok) {
        alert("✅ Wallet saved!");
        setWalletName("");
      } else {
        alert("❌ Save failed");
      }
    } catch {
      alert("❌ Save error");
    } finally {
      setLoader("creating", false);
    }
  };

  const fetchWalletByName = async () => {
    if (!searchName.trim()) return alert("Enter wallet name to fetch");
    setLoader("fetching", true);
    try {
      const res = await fetch(`http://localhost:5001/api/wallet/${searchName}`);
      const data = await res.json();
      if (data.error) {
        alert("❌ Wallet not found");
        setWalletData(null);
      } else {
        setWalletData(data);
        fetchAllBalances(data.privateKey);
      }
    } catch {
      alert("❌ Error fetching wallet");
    } finally {
      setLoader("fetching", false);
    }
  };

  const fetchAllBalances = async (privateKey = walletData?.privateKey) => {
    if (!privateKey) return;
    setLoader("balance", true);
    try {
      const wallet = new Wallet(privateKey, provider);
      const bnb = await provider.getBalance(wallet.address);
      const usdt = new Contract(TOKEN_ADDRESSES.USDT, ERC20_ABI, wallet);
      const usdc = new Contract(TOKEN_ADDRESSES.USDC, ERC20_ABI, wallet);

      const usdtDec = await usdt.decimals();
      const usdcDec = await usdc.decimals();

      const usdtBal = await usdt.balanceOf(wallet.address);
      const usdcBal = await usdc.balanceOf(wallet.address);

      setBnbBalance(formatEther(bnb));
      setUsdtBalance(formatUnits(usdtBal, usdtDec));
      setUsdcBalance(formatUnits(usdcBal, usdcDec));
    } catch (e) {
      console.error("Error fetching balances", e);
    } finally {
      setLoader("balance", false);
    }
  };

  const sendTokens = async () => {
    if (!walletData?.privateKey || !isAddress(recipient) || !amount || parseFloat(amount) <= 0)
      return alert("❌ Invalid inputs");

    setLoader("sending", true);
    try {
      const wallet = new Wallet(walletData.privateKey, provider);
      const bnbBalance = await provider.getBalance(wallet.address);
      const bnbInEth = parseFloat(formatEther(bnbBalance));
      if (bnbInEth < 0.001) {
        return alert("❌ Not enough BNB for gas fees. Please top up the wallet.");
      }

      if (tokenType === "BNB") {
        const tx = await wallet.sendTransaction({
          to: recipient,
          value: parseEther(amount),
        });
        await tx.wait();
        alert(`✅ BNB Sent!\nTx: ${tx.hash}`);
      } else {
        const token = new Contract(TOKEN_ADDRESSES[tokenType], ERC20_ABI, wallet);
        const decimals = await token.decimals();
        const tx = await token.transfer(recipient, parseUnits(amount, decimals));
        await tx.wait();
        alert(`✅ ${tokenType} Sent!\nTx: ${tx.hash}`);
      }

      setAmount("");
      fetchAllBalances(walletData.privateKey);
    } catch (err) {
      console.error("Tx Error:", err);
      alert("❌ Transaction failed");
    } finally {
      setLoader("sending", false);
    }
  };

  const fetchTransactionDetails = async () => {
    if (!txHashInput) return;
    setLoader("tx", true);
    try {
      const tx = await provider.getTransaction(txHashInput);
      const receipt = await provider.getTransactionReceipt(txHashInput);
      setTxDetails({ ...tx, ...receipt });
    } catch {
      alert("❌ Invalid transaction hash or failed to fetch");
    } finally {
      setLoader("tx", false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🦜 Goan Wallet</h1>

      <div style={styles.section}>
        <input
          placeholder="🖊 Create wallet name"
          value={walletName}
          onChange={(e) => setWalletName(e.target.value)}
          style={styles.input}
        />
        <button onClick={generateAndSaveWallet} style={styles.buttonPrimary}>
          {loading.creating ? "⏳ Saving..." : "✅ Generate & Save"}
        </button>
      </div>

      <div style={styles.section}>
        <input
          placeholder="🔍 Load wallet by name"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          style={styles.input}
        />
        <button onClick={fetchWalletByName} style={styles.buttonSecondary}>
          {loading.fetching ? "⏳ Loading..." : "📥 Load Wallet"}
        </button>
      </div>

      {walletData && (
        <div style={styles.walletBox}>
          <p><strong>👤 Name:</strong> {walletData.name}</p>
          <p><strong>🏦 Address:</strong> {walletData.address}</p>
          <p><strong>🔑 Private Key:</strong> {walletData.privateKey}</p>

          <p><strong>💰 BNB Balance:</strong> {bnbBalance ?? "Loading..."} BNB</p>
          <p><strong>💵 USDT Balance:</strong> {usdtBalance ?? "Loading..."} USDT</p>
          <p><strong>💸 USDC Balance:</strong> {usdcBalance ?? "Loading..."} USDC</p>

          <button onClick={() => fetchAllBalances(walletData.privateKey)} style={styles.buttonSecondary}>
            {loading.balance ? "⏳ Refreshing..." : "🔄 Refresh All Balances"}
          </button>

          <h4>🚀 Send Tokens</h4>
          <select value={tokenType} onChange={(e) => setTokenType(e.target.value)} style={styles.input}>
            <option value="BNB">BNB</option>
            <option value="USDT">USDT</option>
            <option value="USDC">USDC</option>
          </select>
          <input
            placeholder="📤 Recipient Address"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            style={styles.input}
          />
          <input
            placeholder="💰 Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={styles.input}
          />
          <button onClick={sendTokens} style={styles.buttonTertiary}>
            {loading.sending ? "⏳ Sending..." : "🚀 Send"}
          </button>

          <h4 style={{ marginTop: "30px" }}>📦 Transaction Details</h4>
          <input
            placeholder="🔍 Enter Tx Hash"
            value={txHashInput}
            onChange={(e) => setTxHashInput(e.target.value)}
            style={styles.input}
          />
          <button onClick={fetchTransactionDetails} style={styles.buttonPrimary}>
            {loading.tx ? "⏳ Fetching..." : "🔍 View Tx Info"}
          </button>

          {txDetails && (
            <div style={{ marginTop: "15px", fontSize: "14px", background: "#0f172a", padding: "15px", borderRadius: "10px" }}>
              <p><strong>From:</strong> {txDetails.from}</p>
              <p><strong>To:</strong> {txDetails.to}</p>
              <p><strong>Hash:</strong> {txDetails.hash}</p>
              <p><strong>Block:</strong> {txDetails.blockNumber}</p>
              <p><strong>Status:</strong> {txDetails.status === 1 ? "✅ Success" : "❌ Failed"}</p>
              <p><strong>Gas Used:</strong> {txDetails.gasUsed?.toString()}</p>
              <p><strong>Value:</strong> {txDetails.value ? `${formatEther(txDetails.value)} BNB` : "N/A"}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    padding: "40px 20px",
    fontFamily: "Poppins, sans-serif",
    background: "linear-gradient(to right, #1e3a8a, #9333ea)",
    color: "#f8fafc",
    textAlign: "center",
  },
  title: {
    fontSize: "2.6rem",
    fontWeight: "bold",
    marginBottom: "30px",
    color: "#fff",
    textShadow: "2px 2px #000",
  },
  section: {
    marginBottom: "25px",
  },
  input: {
    padding: "12px 18px",
    margin: "10px",
    width: "70%",
    maxWidth: "420px",
    borderRadius: "10px",
    border: "none",
    fontSize: "16px",
    backgroundColor: "#f8fafc",
    color: "#1e293b",
  },
  buttonPrimary: {
    padding: "12px 24px",
    backgroundColor: "#22c55e",
    borderRadius: "10px",
    color: "#fff",
    fontWeight: "bold",
    fontSize: "16px",
    marginLeft: "10px",
    border: "none",
    cursor: "pointer",
  },
  buttonSecondary: {
    padding: "12px 24px",
    backgroundColor: "#3b82f6",
    borderRadius: "10px",
    color: "#fff",
    fontWeight: "bold",
    fontSize: "16px",
    marginLeft: "10px",
    border: "none",
    cursor: "pointer",
  },
  buttonTertiary: {
    padding: "12px 24px",
    backgroundColor: "#f97316",
    borderRadius: "10px",
    color: "#fff",
    fontWeight: "bold",
    fontSize: "16px",
    marginTop: "10px",
    border: "none",
    cursor: "pointer",
  },
  walletBox: {
    backgroundColor: "#111827",
    padding: "30px",
    marginTop: "30px",
    borderRadius: "12px",
    maxWidth: "700px",
    marginInline: "auto",
    textAlign: "left",
    boxShadow: "0 0 25px rgba(0,0,0,0.4)",
  },
};

export default App;
