import React, { useState } from 'react';
import { ethers } from 'ethers';
import './App.css';

function App() {
  const [wallet, setWallet] = useState(null);

  const generateWallet = () => {
    const randomWallet = ethers.Wallet.createRandom();
    setWallet({
      address: randomWallet.address,
      privateKey: randomWallet.privateKey,
      mnemonic: randomWallet.mnemonic.phrase
    });
  };

  const fetchWallet = () => {
    if (wallet) {
      alert(`Address: ${wallet.address}`);
    } else {
      alert('No wallet found. Please generate one first.');
    }
  };

  return (
    <div className="App">
      <h1>Create Ethereum Wallet</h1>
      <div style={{ marginBottom: '20px' }}>
        <button className="generate" onClick={generateWallet}>Generate Wallet</button>
        <button className="fetch" onClick={fetchWallet}>Fetch Wallet</button>
      </div>

      {wallet && (
        <div className="wallet-box">
          <p><strong>Address:</strong> {wallet.address}</p>
          <p><strong>Private Key:</strong> {wallet.privateKey}</p>
          <p><strong>Mnemonic:</strong> {wallet.mnemonic}</p>
        </div>
      )}
    </div>
  );
}

export default App;
