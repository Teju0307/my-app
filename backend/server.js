const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const corsOptions = {
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
};
app.use(cors(corsOptions));
// Handle preflight requests for all routes
app.use(express.json());

// Connect to MongoDB Atlas
mongoose.connect("mongodb+srv://tejasvisgaonkar:eMq3mDJBUyikGmEt@cluster0.79yrckm.mongodb.net/Web3", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Wallet schema with name field
const walletSchema = new mongoose.Schema({
  name: String, // <-- new
  address: String,
  privateKey: String,
  mnemonic: String,
});

const Wallet = mongoose.model("Wallet", walletSchema);
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.path} from ${req.headers.origin}`);
  next();
});
// Health check
app.get("/", (req, res) => {
  res.send("API is running");
});

// POST: Save wallet
app.post("/api/wallet", async (req, res) => {
  const { name, address, privateKey, mnemonic } = req.body;
  const newWallet = new Wallet({ name, address, privateKey, mnemonic });
  await newWallet.save();
  res.json({ message: "Wallet saved!" });
});

// GET: Fetch wallet by name
app.get("/api/wallet/:name", async (req, res) => {
  const name = req.params.name;
  const wallet = await Wallet.findOne({ name });

  if (!wallet) {
    return res.status(404).json({ error: "Wallet not found" });
  }

  res.json(wallet);
});

// Start server
app.listen(5001, () => {
  console.log("Server running on http://localhost:5001");
});