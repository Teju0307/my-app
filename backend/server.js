// server.js (UPDATED - Reverted to no-password system)

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
// const bcrypt = require("bcrypt"); // --- REMOVED: No longer needed
const {
  JsonRpcProvider,
  Contract,
  Interface,
  formatEther,
  formatUnits,
} = require("ethers");

const app = express();
const corsOptions = {
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
};
app.use(cors(corsOptions));
app.use(express.json());

// --- Using your DB Connection String (Unchanged) ---
mongoose.connect("mongodb+srv://tejasvisgaonkar:eMq3mDJBUyikGmEt@cluster0.79yrckm.mongodb.net/Web3", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("MongoDB connected successfully."))
  .catch(err => console.error("MongoDB connection error:", err));


// --- UPDATED: Wallet Schema reverted to its simple form without passwords ---
const walletSchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true },
  address: { type: String, required: true },
  privateKey: { type: String, required: true },
  mnemonic: { type: String, required: true },
  // passwordHash: { type: String, required: true }, // --- REMOVED
});

// --- Other schemas are kept for their advanced features ---
const ledgerSchema = new mongoose.Schema({
  hash: { type: String, unique: true, required: true },
  from: String, to: String, amount: String, token: String,
  blockNumber: Number, status: String, timestamp: Date,
});
const contactSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, index: true },
  contactName: { type: String, required: true },
  contactAddress: { type: String, required: true },
});

const Wallet = mongoose.model("Wallet", walletSchema);
const Ledger = mongoose.model("Ledger", ledgerSchema);
const Contact = mongoose.model("Contact", contactSchema);

const provider = new JsonRpcProvider("https://bsc-testnet-dataseed.bnbchain.org");
const TOKEN_ADDRESSES = {
  USDT: "0x787A697324dbA4AB965C58CD33c13ff5eeA6295F",
  USDC: "0x342e3aA1248AB77E319e3331C6fD3f1F2d4B36B1",
};
const ERC20_ABI = [ "event Transfer(address indexed from, address indexed to, uint256 value)", "function decimals() view returns (uint8)" ];
const erc20Interface = new Interface(ERC20_ABI);


/* ---------- API ENDPOINTS ---------- */

// --- UPDATED: Create Wallet reverted to simpler, no-password version ---
app.post("/api/wallet", async (req, res) => {
    try {
        const { name, address, privateKey, mnemonic } = req.body; // No password
        if (!name || !address || !privateKey) {
            return res.status(400).json({ error: "Missing required wallet fields." });
        }
        const newWallet = new Wallet({ name, address, privateKey, mnemonic });
        await newWallet.save();
        res.status(201).json({ message: "Wallet saved!" });
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ error: "A wallet with this name already exists." });
        res.status(500).json({ error: "Server error during wallet creation" });
    }
});

// --- UPDATED: Reverted to simple GET request to load wallet by name ---
app.get("/api/wallet/:name", async (req, res) => {
    try {
        const name = req.params.name;
        const wallet = await Wallet.findOne({ name });
        if (!wallet) {
            return res.status(404).json({ error: "Wallet not found" });
        }
        res.json(wallet); // No password check, just return the data
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error while fetching wallet" });
    }
});

// --- Advanced transaction logging endpoint remains the same ---
app.post("/api/tx/:hash", async (req, res) => {
    try {
        const { hash } = req.params;
        const existingTx = await Ledger.findOne({ hash });
        if(existingTx) return res.status(200).json({message: "Tx already logged."});

        const receipt = await provider.getTransactionReceipt(hash);
        if (!receipt) return res.status(404).json({ error: "Transaction not yet mined" });

        const block = await provider.getBlock(receipt.blockNumber);
        const tx = await provider.getTransaction(hash);
        
        let amountStr = "0", tokenName = "", actualTo = receipt.to; 
        if (tx.data === "0x") {
            amountStr = formatEther(tx.value);
            tokenName = "BNB";
        } else {
            const transferEventTopic = erc20Interface.getEvent("Transfer").topicHash;
            const tokenLog = receipt.logs.find(log => log.topics[0] === transferEventTopic);
            if (tokenLog) {
                const parsedLog = erc20Interface.parseLog(tokenLog);
                actualTo = parsedLog.args.to;
                const tokenContract = new Contract(tokenLog.address, ["function decimals() view returns (uint8)"], provider);
                amountStr = formatUnits(parsedLog.args.value, await tokenContract.decimals());
                if (tokenLog.address.toLowerCase() === TOKEN_ADDRESSES.USDT.toLowerCase()) tokenName = "USDT";
                else if (tokenLog.address.toLowerCase() === TOKEN_ADDRESSES.USDC.toLowerCase()) tokenName = "USDC";
                else tokenName = "Unknown";
            } else { tokenName = "N/A"; }
        }
        const logData = { hash: receipt.hash, from: receipt.from.toLowerCase(), to: (actualTo || receipt.to).toLowerCase(), blockNumber: receipt.blockNumber, amount: amountStr, token: tokenName, status: receipt.status === 1 ? "Success" : "Failed", timestamp: new Date(block.timestamp * 1000) };
        await Ledger.findOneAndUpdate({ hash }, logData, { upsert: true, new: true });
        res.status(201).json(logData);
    } catch (err) {
        res.status(500).json({ error: "Server error logging transaction" });
    }
});

// --- Ledger and Contacts endpoints remain the same ---
app.get("/api/ledger/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const lowerCaseAddress = address.toLowerCase();
    const transactions = await Ledger.find({ $or: [{ from: lowerCaseAddress }, { to: lowerCaseAddress }] }).sort({ timestamp: -1 });
    res.json(transactions);
  } catch (error) { res.status(500).json({ error: "Failed to fetch ledger" }); }
});
app.get("/api/contacts/:walletAddress", async (req, res) => {
  try {
    const contacts = await Contact.find({ walletAddress: req.params.walletAddress });
    res.json(contacts);
  } catch (err) { res.status(500).json({ error: "Failed to fetch contacts." }); }
});
app.post("/api/contacts", async (req, res) => {
  try {
    const { walletAddress, contactName, contactAddress } = req.body;
    if (!walletAddress || !contactName || !contactAddress) return res.status(400).json({ error: "All fields are required." });
    const newContact = new Contact({ walletAddress, contactName, contactAddress });
    await newContact.save();
    res.status(201).json(newContact);
  } catch (err) { res.status(500).json({ error: "Failed to save contact." }); }
});
app.delete("/api/contacts/:contactId", async (req, res) => {
  try {
    const result = await Contact.findByIdAndDelete(req.params.contactId);
    if (!result) return res.status(404).json({ error: "Contact not found." });
    res.status(200).json({ message: "Contact deleted." });
  } catch (err) { res.status(500).json({ error: "Failed to delete contact." }); }
});


const PORT = 5001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));