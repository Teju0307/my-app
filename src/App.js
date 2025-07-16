import React, { useState } from "react";
import { ethers } from "ethers";

function App() {
  const [walletData, setWalletData] = useState(null);
  const [walletName, setWalletName] = useState("");
  const [searchName, setSearchName] = useState("");

  const generateAndSaveWallet = async () => {
    if (!walletName.trim()) {
      alert("Enter a name for the wallet");
      return;
    }

    const wallet = ethers.Wallet.createRandom();

    const newWallet = {
      name: walletName,
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic.phrase,
    };

    const res = await fetch("http://localhost:5000/api/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newWallet),
    });

    const result = await res.json();
    alert("Wallet saved!");
  };

  const fetchWalletByName = async () => {
    if (!searchName.trim()) {
      alert("Enter a wallet name to search");
      return;
    }

    const res = await fetch(`http://localhost:5000/api/wallet/${searchName}`);
    const data = await res.json();

    if (data.error) {
      alert("Wallet not found");
    } else {
      setWalletData(data);
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>🦊 Mini Wallet App</h1>

      <div style={{ marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="Enter name to create wallet"
          value={walletName}
          onChange={(e) => setWalletName(e.target.value)}
          style={{ marginRight: "10px" }}
        />
        <button onClick={generateAndSaveWallet}>Generate & Save Wallet</button>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="Enter name to fetch wallet"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          style={{ marginRight: "10px" }}
        />
        <button onClick={fetchWalletByName}>Fetch Wallet by Name</button>
      </div>

      {walletData && (
        <div style={{ marginTop: "30px" }}>
          <p><strong>Name:</strong> {walletData.name}</p>
          <p><strong>Address:</strong> {walletData.address}</p>
          <p><strong>Private Key:</strong> {walletData.privateKey}</p>
          <p><strong>Mnemonic:</strong> {walletData.mnemonic}</p>
        </div>
      )}
    </div>
  );
}

export default App;