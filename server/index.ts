import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compareRegimes } from './taxCalculator';
import { db } from './db';
import { hashPassword, verifyPassword, signToken, requireAuth, type AuthPayload } from './auth';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

app.use(express.json());

const apiKey = process.env.VITE_GEMINI_API_KEY;
if (!apiKey || apiKey === 'your_gemini_api_key_here') {
  console.error('CRITICAL: Missing VITE_GEMINI_API_KEY. Please provide a real API key in the .env file.');
}

const genAI = new GoogleGenerativeAI(apiKey || '');
const model = genAI.getGenerativeModel({
  model: "gemini-3-flash-preview",
  systemInstruction: "You are AI Money Mentor. Use INR. Focus on Indian tax laws (Old vs New regimes) and investment vehicles (PPF, NPS, SIPs, ELSS). Be concise, professional, and actionable. Use markers like [INVESTMENT_PLAN] or [TAX_ADVICE] for specialized sections. Greet users by their name if provided. If an error occurs or the prompt is invalid, reply with a helpful financial insight and ask for clarification."
});

const sipsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'sips.json'), 'utf-8'));

app.get('/api/sips', (req, res) => {
  res.json(sipsData);
});

app.get('/api/sips/:id', (req, res) => {
  const sip = sipsData.find((s: any) => s.id === parseInt(req.params.id));
  if (sip) res.json(sip);
  else res.status(404).json({ error: 'SIP not found' });
});

app.post('/api/signup', async (req, res) => {
  const { fullName, email, password, phone, income } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'fullName, email, and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await hashPassword(password);
    const result = db.prepare(
      'INSERT INTO users (fullName, email, phone, income, passwordHash) VALUES (?, ?, ?, ?, ?)'
    ).run(fullName, email, phone || null, income || null, passwordHash);

    const userId = result.lastInsertRowid as number;
    const token = signToken({ userId, email });

    res.status(201).json({
      token,
      user: { id: userId, fullName, email, phone, income },
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken({ userId: user.id, email: user.email });
    res.json({
      token,
      user: { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone, income: user.income },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

app.get('/api/me', requireAuth, (req, res) => {
  const { userId } = (req as any).user as AuthPayload;
  const user = db.prepare('SELECT id, fullName, email, phone, income FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

app.get('/api/messages', requireAuth, (req, res) => {
  const { userId } = (req as any).user as AuthPayload;
  const messages = db.prepare('SELECT * FROM messages WHERE userId = ? ORDER BY id ASC').all(userId);
  res.json(messages);
});

const TAX_KEYWORDS = /\b(tax|regime|old vs new|slab|87a|deduction|hra|80c)\b/i;

app.post('/api/chat', requireAuth, async (req, res) => {
  const { message } = req.body;
  const { userId } = (req as any).user as AuthPayload;

  if (!message) {
    return res.status(400).json({ error: 'Missing message' });
  }
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return res.status(500).json({ error: 'Backend AI is not configured. Please add VITE_GEMINI_API_KEY to .env' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    const income = Number(user?.income);

    db.prepare('INSERT INTO messages (userId, sender, text) VALUES (?, ?, ?)').run(userId, 'user', message);

    let computedContext = '';
    if (TAX_KEYWORDS.test(message) && Number.isFinite(income) && income > 0) {
      const comparison = compareRegimes(income);
      computedContext = "\n[COMPUTED TAX DATA - these figures are already calculated, do not recalculate them yourself]\nNew Regime: taxable income Rs." + comparison.new.taxableIncome + ", tax payable Rs." + comparison.new.totalTaxPayable + "\nOld Regime (assuming no itemized deductions): taxable income Rs." + comparison.old.taxableIncome + ", tax payable Rs." + comparison.old.totalTaxPayable + "\nBetter regime at this income: " + comparison.betterRegime + ", saving Rs." + comparison.savings + "\nIf the user mentions 80C/80D/HRA deductions, note that the old regime figure could improve - ask for their deduction total.\n";
    }

    const prompt = "Context: User Name: " + user?.fullName + ", Income: Rs." + user?.income + ".\n" + computedContext + "\nUser Question: " + message;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text) throw new Error('Empty AI response');

    db.prepare('INSERT INTO messages (userId, sender, text) VALUES (?, ?, ?)').run(userId, 'ai', text);

    res.json({ text, computed: Boolean(computedContext) });
  } catch (error: any) {
    console.error('AI Error:', error);
    res.status(500).json({ error: 'Failed to generate AI advice. ' + (error.message || '') });
  }
});

app.post('/api/tax/compare', (req, res) => {
  const { annualIncome, oldRegimeDeductions } = req.body;
  if (typeof annualIncome !== 'number' || annualIncome < 0) {
    return res.status(400).json({ error: 'annualIncome must be a non-negative number' });
  }
  try {
    const result = compareRegimes(annualIncome, oldRegimeDeductions || 0);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log("Server running at http://localhost:" + port);
});
