import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, Area, AreaChart
} from "recharts";
import { Upload, FileText, PoundSterling, TrendingUp, TrendingDown, CheckCircle, AlertCircle, ChevronRight, X, Plus, Trash2, Info, Calendar, CreditCard, Briefcase, Heart, Baby, Home, Bike, Car, Gift, Landmark, Shield, LogOut, User, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────
// SUPABASE CLIENT
// ─────────────────────────────────────────────

const SUPABASE_URL = "https://vxccfmmzbzyoqulamflu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4Y2NmbW16Ynp5b3F1bGFtZmx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1OTY5NTIsImV4cCI6MjA5NjE3Mjk1Mn0.j8aulWgMGp3H0IgAXwaj88TIRzyW8rEHF-_phEXMBvM";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const STORAGE_BUCKET = "csv-uploads";

// ─────────────────────────────────────────────
// SUPABASE HELPERS
// ─────────────────────────────────────────────

async function saveTransactionsToDB(userId, transactions, sourceFile, bankFormat, bankName, accountType) {
  const rows = transactions.map(t => ({
    user_id: userId,
    date: t.date?.toISOString().split("T")[0],
    type: t.type || null,
    description: t.description || null,
    category: t.category || null,
    direction: t.direction || null,
    amount: t.amount,
    balance: t.balance || null,
    source_file: sourceFile || null,
    bank_format: bankFormat || null,
    bank_name: bankName || null,
    account_type: accountType || null,
  }));
  // Insert in batches of 500
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase.from("transactions").insert(batch);
    if (error) throw error;
  }
}

async function loadTransactionsFromDB(userId) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data || []).map(r => ({
    ...r,
    date: r.date ? new Date(r.date) : null,
    amount: parseFloat(r.amount),
    balance: r.balance ? parseFloat(r.balance) : 0,
  }));
}

async function deleteAllTransactions(userId) {
  const { error } = await supabase.from("transactions").delete().eq("user_id", userId);
  if (error) throw error;
}

async function savePayslipToDB(userId, payslip) {
  const { error } = await supabase.from("payslips").insert({
    user_id: userId,
    month: payslip.month,
    year: payslip.year,
    employer_name: payslip.employerName || null,
    gross_pay: payslip.grossPay || null,
    tax_deducted: payslip.taxDeducted || 0,
    national_insurance: payslip.nationalInsurance || 0,
    pension_contribution: payslip.pensionContribution || 0,
    student_loan: payslip.studentLoan || 0,
    other_deductions: payslip.otherDeductions || 0,
    net_pay: payslip.netPay,
    skip_gross: payslip.skipGross || false,
  });
  if (error) throw error;
}

async function loadPayslipsFromDB(userId) {
  const { data, error } = await supabase
    .from("payslips")
    .select("*")
    .eq("user_id", userId)
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id,
    month: r.month,
    year: r.year,
    employerName: r.employer_name,
    grossPay: parseFloat(r.gross_pay || 0),
    taxDeducted: parseFloat(r.tax_deducted || 0),
    nationalInsurance: parseFloat(r.national_insurance || 0),
    pensionContribution: parseFloat(r.pension_contribution || 0),
    studentLoan: parseFloat(r.student_loan || 0),
    otherDeductions: parseFloat(r.other_deductions || 0),
    netPay: parseFloat(r.net_pay || 0),
    skipGross: r.skip_gross,
  }));
}

async function deleteAllPayslips(userId) {
  const { error } = await supabase.from("payslips").delete().eq("user_id", userId);
  if (error) throw error;
}

async function uploadCSVToStorage(userId, file) {
  const path = `${userId}/${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file);
  if (error) throw error;
  return path;
}

async function trackCSVUpload(userId, fileName, filePath, fileType, bankFormat, rowCount, contentHash, bankName, accountType) {
  const { error } = await supabase.from("csv_uploads").insert({
    user_id: userId,
    file_name: fileName,
    file_path: filePath,
    file_type: fileType,
    bank_format: bankFormat || null,
    row_count: rowCount,
    content_hash: contentHash || null,
    bank_name: bankName || null,
    account_type: accountType || null,
  });
  if (error) throw error;
}

async function hashFileContent(text) {
  const buffer = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function findDuplicateUpload(userId, contentHash) {
  const { data } = await supabase
    .from("csv_uploads")
    .select("*")
    .eq("user_id", userId)
    .eq("content_hash", contentHash)
    .maybeSingle();
  return data;
}

async function deleteTransactionsBySource(userId, sourceFile) {
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("user_id", userId)
    .eq("source_file", sourceFile);
  if (error) throw error;
}

async function deleteUploadRecord(uploadId) {
  const { error } = await supabase.from("csv_uploads").delete().eq("id", uploadId);
  if (error) throw error;
}

async function loadProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data;
}

async function loadCSVUploads(userId) {
  const { data, error } = await supabase
    .from("csv_uploads")
    .select("*")
    .eq("user_id", userId)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function updateProfile(userId, updates) {
  const { error } = await supabase.from("profiles").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", userId);
  if (error) throw error;
}

// ─────────────────────────────────────────────
// CONSTANTS & HELPERS
// ─────────────────────────────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Ordered merchant → category lookup. More specific entries first.
// Checked before CATEGORY_KEYWORDS so exact merchant names win.
const MERCHANT_MAP = [
  // Dining Out — restaurants, cafes, fast food, delivery
  ["pret a manger","Dining Out"],["pret ","Dining Out"],
  ["hawksmoor","Dining Out"],["wagamama","Dining Out"],
  ["pizza express","Dining Out"],["pizza hut","Dining Out"],
  ["domino","Dining Out"],["five guys","Dining Out"],["greggs","Dining Out"],
  ["leon ","Dining Out"],["itsu","Dining Out"],["wasabi","Dining Out"],
  ["yo sushi","Dining Out"],["yo! sushi","Dining Out"],
  ["bills ","Dining Out"],["carluccios","Dining Out"],
  ["zizzi","Dining Out"],["ask italian","Dining Out"],
  ["harvester","Dining Out"],["wetherspoon","Dining Out"],
  ["caffe nero","Dining Out"],["patisserie","Dining Out"],
  ["dishoom","Dining Out"],["flat iron","Dining Out"],
  ["ottolenghi","Dining Out"],["cote brasserie","Dining Out"],
  ["shake shack","Dining Out"],["burger king","Dining Out"],
  ["byron burger","Dining Out"],["honest burger","Dining Out"],
  ["gourmet burger","Dining Out"],["patty and bun","Dining Out"],
  ["chilango","Dining Out"],["tortilla","Dining Out"],["chipotle","Dining Out"],
  ["the ivy","Dining Out"],["nobu ","Dining Out"],["gaucho","Dining Out"],
  ["sketch ","Dining Out"],["hakkasan","Dining Out"],
  ["sexy fish","Dining Out"],["duck & waffle","Dining Out"],
  ["sushisamba","Dining Out"],["oblix","Dining Out"],
  ["cafe rouge","Dining Out"],["bella italia","Dining Out"],
  ["prezzo","Dining Out"],["frankie & benny","Dining Out"],
  ["tgi friday","Dining Out"],["chiquito","Dining Out"],
  ["toby carvery","Dining Out"],["hungry horse","Dining Out"],
  ["turtle bay","Dining Out"],["wahaca","Dining Out"],
  ["the real greek","Dining Out"],["mildreds","Dining Out"],
  ["hoppers","Dining Out"],["bleecker","Dining Out"],
  ["chicken shop","Dining Out"],["pizza pilgrims","Dining Out"],
  ["franco manca","Dining Out"],["smokehouse","Dining Out"],
  ["smoky boys","Dining Out"],["roti king","Dining Out"],
  ["gails","Dining Out"],["gail's","Dining Out"],
  ["paul bakery","Dining Out"],["le pain quotidien","Dining Out"],
  ["brasserie","Dining Out"],["ristorante","Dining Out"],
  ["deliveroo","Dining Out"],["just eat","Dining Out"],["uber eats","Dining Out"],

  // Subscriptions — streaming, software, SaaS, security
  ["ring multi","Subscriptions"],["ring.com","Subscriptions"],
  ["amazon prime","Subscriptions"],["prime video","Subscriptions"],
  ["apple tv+","Subscriptions"],["apple one","Subscriptions"],
  ["icloud","Subscriptions"],["microsoft 365","Subscriptions"],
  ["office 365","Subscriptions"],["adobe ","Subscriptions"],
  ["youtube premium","Subscriptions"],["now tv","Subscriptions"],
  ["bt sport","Subscriptions"],["dazn","Subscriptions"],
  ["paramount+","Subscriptions"],["paramount plus","Subscriptions"],
  ["apple music","Subscriptions"],["tidal ","Subscriptions"],
  ["audible","Subscriptions"],["kindle unlimited","Subscriptions"],
  ["duolingo","Subscriptions"],["headspace","Subscriptions"],
  ["calm app","Subscriptions"],["peloton","Subscriptions"],
  ["zwift","Subscriptions"],["strava","Subscriptions"],
  ["norton ","Subscriptions"],["mcafee","Subscriptions"],
  ["kaspersky","Subscriptions"],["dropbox","Subscriptions"],
  ["lastpass","Subscriptions"],["1password","Subscriptions"],
  ["canva ","Subscriptions"],["openai","Subscriptions"],
  ["chatgpt","Subscriptions"],["anthropic","Subscriptions"],
  ["patreon","Subscriptions"],["substack","Subscriptions"],
  ["britbox","Subscriptions"],["hayu ","Subscriptions"],
  ["crunchyroll","Subscriptions"],["mubi","Subscriptions"],
  ["discovery+","Subscriptions"],["acorn tv","Subscriptions"],
  ["playstation plus","Subscriptions"],["playstation now","Subscriptions"],
  ["xbox game pass","Subscriptions"],["nintendo online","Subscriptions"],
  ["discord nitro","Subscriptions"],["twitch sub","Subscriptions"],
  ["sky cinema","Subscriptions"],["sky sports","Subscriptions"],
  ["membership","Subscriptions"],["subscription","Subscriptions"],

  // Entertainment — venues, clubs, cinema, events, activities
  ["manor london","Entertainment"],["fabric ","Entertainment"],
  ["egg london","Entertainment"],["printworks","Entertainment"],
  ["oval space","Entertainment"],["village underground","Entertainment"],
  ["roundhouse","Entertainment"],["barbican","Entertainment"],
  ["royal albert hall","Entertainment"],["o2 arena","Entertainment"],
  ["wembley","Entertainment"],["odeon ","Entertainment"],
  ["vue cinema","Entertainment"],["cineworld","Entertainment"],
  ["picturehouse","Entertainment"],["curzon ","Entertainment"],
  ["ticketmaster","Entertainment"],["eventbrite","Entertainment"],
  ["see tickets","Entertainment"],["stubhub","Entertainment"],
  ["viagogo","Entertainment"],["dice.fm","Entertainment"],
  ["comedy store","Entertainment"],["comedy club","Entertainment"],
  ["go ape","Entertainment"],["legoland","Entertainment"],
  ["thorpe park","Entertainment"],["alton towers","Entertainment"],
  ["chessington","Entertainment"],["kew garden","Entertainment"],
  ["national gallery","Entertainment"],["tate modern","Entertainment"],
  ["theatre","Entertainment"],["theater","Entertainment"],
  ["bowling","Entertainment"],["laser quest","Entertainment"],
  ["escape room","Entertainment"],["mini golf","Entertainment"],
  ["crazy golf","Entertainment"],["karting","Entertainment"],
  ["paintball","Entertainment"],["trampoline park","Entertainment"],
  ["cinema","Entertainment"],["imax","Entertainment"],
  ["nightclub","Entertainment"],["night club","Entertainment"],

  // Shopping — clothing, homeware, electronics, beauty
  ["ikea","Shopping"],["dunelm","Shopping"],["b&q","Shopping"],
  ["screwfix","Shopping"],["toolstation","Shopping"],
  ["sports direct","Shopping"],["jd sports","Shopping"],
  ["foot locker","Shopping"],["schuh","Shopping"],["clarks ","Shopping"],
  ["selfridges","Shopping"],["harrods","Shopping"],["liberty ","Shopping"],
  ["harvey nichols","Shopping"],["the range","Shopping"],
  ["home bargains","Shopping"],["wilko","Shopping"],["poundland","Shopping"],
  ["waterstones","Shopping"],["pets at home","Shopping"],
  ["oliver bonas","Shopping"],["the white company","Shopping"],
  ["fat face","Shopping"],["ted baker","Shopping"],
  ["hugo boss","Shopping"],["uniqlo","Shopping"],
  ["reiss ","Shopping"],["whistles","Shopping"],["jigsaw ","Shopping"],
  ["lk bennett","Shopping"],["lk.bennett","Shopping"],
  ["matalan","Shopping"],["superdry","Shopping"],
  ["jack wills","Shopping"],["river island","Shopping"],
  ["apple.com","Shopping"],["apple store","Shopping"],
  ["microsoft store","Shopping"],["samsung","Shopping"],
  ["currys","Shopping"],["argos","Shopping"],["ao.com","Shopping"],
  ["very.co.uk","Shopping"],["studio ","Shopping"],

  // Health & Fitness
  ["pure gym","Health"],["anytime fitness","Health"],
  ["david lloyd","Health"],["virgin active","Health"],
  ["fitness first","Health"],["the gym group","Health"],
  ["nuffield health","Health"],["lloyds pharmacy","Health"],
  ["superdrug","Health"],["holland & barrett","Health"],
  ["holland and barrett","Health"],["vision express","Health"],
  ["specsavers","Health"],["boots optician","Health"],

  // Transport
  ["trainline","Transport"],["national rail","Transport"],
  ["greater anglia","Transport"],["thameslink","Transport"],
  ["avanti west","Transport"],["great western railway","Transport"],
  ["southeastern","Transport"],["gwr","Transport"],
  ["chiltern rail","Transport"],["scotrail","Transport"],
  ["stagecoach bus","Transport"],["national express","Transport"],
  ["megabus","Transport"],["heathrow express","Transport"],
  ["gatwick express","Transport"],["stansted express","Transport"],
  ["santander cycles","Transport"],["zipcar","Transport"],
  ["enterprise rent","Transport"],["europcar","Transport"],
  ["hertz","Transport"],["addison lee","Transport"],
  ["lime ebike","Transport"],["voi ","Transport"],

  // Utilities — energy, water, telecoms
  ["octopus energy","Utilities"],["british gas","Utilities"],
  ["eon energy","Utilities"],["eon ","Utilities"],
  ["edf energy","Utilities"],["edf ","Utilities"],
  ["npower","Utilities"],["scottish power","Utilities"],
  ["thames water","Utilities"],["severn trent","Utilities"],
  ["anglian water","Utilities"],["talktalk","Utilities"],
  ["plusnet","Utilities"],["shell energy","Utilities"],
  ["bulb energy","Utilities"],["ovo energy","Utilities"],
  ["so energy","Utilities"],["e.on","Utilities"],

  // Housing
  ["foxtons","Housing"],["savills","Housing"],
  ["purplebricks","Housing"],["rightmove","Housing"],
  ["openrent","Housing"],["zoopla","Housing"],
  ["ground rent","Housing"],["service charge","Housing"],
  ["letting agent","Housing"],
];

const CATEGORY_KEYWORDS = {
  "Housing":       { words: ["rent","mortgage","council tax","estate agent","letting","ground rent","service charge"] },
  "Utilities":     { words: ["electric","gas ","water","broadband","internet","phone","mobile","bt ","virgin media","sky ","ee ","vodafone","o2 ","three mobile","utility"] },
  "Groceries":     { words: ["tesco","sainsbury","asda","aldi","lidl","morrisons","waitrose","co-op","ocado","iceland","marks&spencer","marks & spencer","m&s food","whole foods","planet organic","spar ","londis","budgens","nisa ","farm foods"] },
  "Transport":     { words: ["tfl ","tfl.gov","uber ","train","rail","bus ","petrol","fuel","shell ","bp ","esso","parking","dvla","mot ","travel ch","oyster","taxi","cab "] },
  "Dining Out":    { words: ["restaurant","cafe ","caffe","coffee","starbucks","costa","mcdonald","kfc","nando","pub ","bar ","inn ","arms ","tavern ","kitchen ","sushi","burger","grill ","tapas"] },
  "Shopping":      { words: ["amazon","ebay","john lewis","next ","primark","asos","zara","h&m","westfield","shopping","eden centre","hampton court"] },
  "Subscriptions": { words: ["netflix","spotify","disney plus","disney+","apple.com/bill","apple com bill","gym","annual fee"] },
  "Insurance":     { words: ["insurance","aviva","direct line","admiral","axa","zurich","legal & general","prudential","standard life","vitality","bupa ","denplan","simplyhealth","petplan","hastings","lv "] },
  "Childcare":     { words: ["nursery","childcare","childminder","after school","breakfast club","holiday club"] },
  "Health":        { words: ["pharmacy","dentist","optician","doctor","nhs","boots ","vitamin","supplement","physio","therapist"] },
  "Entertainment": { words: ["concert","tickets","casino ","arcade","museum ","gallery ","exhibition","bowling","golf "] },
  "Investments":   { words: ["tesla inc","trading 212","freetrade","hargreaves","vanguard","nutmeg","etoro","invest","moneybox","wealthify"] },
  "Savings":       { words: [" isa ","cash isa","stocks isa","savings","marcus ","atom bank"] },
  "Income":        { words: ["salary","wages","dividend","refund","hmrc","tax credit","child benefit","universal credit","bacs credit","cashback","interest paid"] },
};

function categoriseTransaction(description, type) {
  const lowerType = (type || "").toLowerCase();
  const lower = (description || "").toLowerCase();
  const combined = " " + lowerType + " " + lower + " ";

  // Type-based broad classification (highest priority)
  if (/transfer|tfr/i.test(type)) return "Transfer";
  if (/standing order/i.test(type)) return "Standing Order";
  if (/direct debit|dd /i.test(type)) return "Direct Debit";
  if (/interest/i.test(type)) return "Interest";
  if (/atm|cash/i.test(type)) return "Cash";

  // Specific merchant lookup (checked before general keywords)
  for (const [merchant, category] of MERCHANT_MAP) {
    if (combined.includes(merchant)) return category;
  }

  // General keyword categories
  for (const [category, { words }] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some(kw => combined.includes(kw))) return category;
  }

  return "Other";
}

// Re-categorise all transactions using current rules and persist changes to Supabase
async function recategoriseAllTransactions(userId, transactions, setTransactions) {
  const recategorised = transactions.map(t => ({
    ...t,
    category: categoriseTransaction(t.description || "", t.type || ""),
  }));

  const changed = recategorised.filter((t, i) => t.category !== transactions[i].category);
  if (changed.length === 0) return 0;

  // Group changed transactions by their new category for batch Supabase updates
  const byCategory = {};
  for (const t of changed) {
    if (!byCategory[t.category]) byCategory[t.category] = [];
    byCategory[t.category].push(t.id);
  }
  for (const [category, ids] of Object.entries(byCategory)) {
    await supabase.from("transactions").update({ category }).in("id", ids);
  }

  setTransactions(recategorised);
  return changed.length;
}

function parseAmount(val) {
  if (typeof val === "number") return val;
  const str = String(val);
  // Detect if the original value has any kind of minus/dash before digits
  const isNegative = /^[\s]*[-–—−]/.test(str) || /£[\s]*[-–—−]/.test(str) || /[-–—−][\s]*£/.test(str);
  // Strip currency symbols, commas, spaces, and all dash-like characters
  const cleaned = str.replace(/[£,\s\-–—−]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return isNegative ? -Math.abs(num) : num;
}

// Returns "ingoing" or "outgoing" based on original raw value from CSV
function parseDirection(val) {
  const str = String(val || "");
  // Any kind of minus/dash before or near the number means outgoing
  if (/[-–—−]/.test(str)) return "outgoing";
  return "ingoing";
}

function parseDate(val) {
  if (!val) return null;
  const str = String(val).trim();
  // DD/MM/YYYY
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const year = dmy[3].length === 2 ? 2000 + parseInt(dmy[3]) : parseInt(dmy[3]);
    return new Date(year, parseInt(dmy[2]) - 1, parseInt(dmy[1]));
  }
  // YYYY-MM-DD
  const ymd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymd) return new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]));
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function formatCurrency(n) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

function formatMonth(d) {
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// ─────────────────────────────────────────────
// BANK FORMAT DETECTION
// ─────────────────────────────────────────────

const BANK_FORMATS = {
  midata: {
    name: "Midata (Standard)",
    detect: (headers) => headers.includes("date") && headers.includes("type") && (headers.includes("merchant/description") || headers.includes("description")),
    map: (row) => {
      const rawAmount = row["debit/credit"] || row["amount"] || row["value"] || "0";
      return {
        date: parseDate(row["date"]),
        description: row["merchant/description"] || row["description"] || "",
        amount: parseAmount(rawAmount),
        balance: parseAmount(row["balance"] || 0),
        type: row["type"] || "",
        direction: parseDirection(rawAmount),
      };
    },
  },
  barclays: {
    name: "Barclays",
    detect: (headers) => headers.includes("number") && headers.includes("date") && headers.includes("account") && headers.includes("amount") && headers.includes("subcategory"),
    map: (row) => ({
      date: parseDate(row["date"]),
      description: row["memo"] || row["subcategory"] || "",
      amount: parseAmount(row["amount"]),
      balance: 0,
      type: row["subcategory"] || "",
      direction: parseDirection(row["amount"]),
    }),
  },
  hsbc: {
    name: "HSBC",
    detect: (headers) => headers.includes("date") && headers.includes("description") && (headers.includes("amount") || headers.includes("paid in") || headers.includes("paid out")),
    map: (row) => ({
      date: parseDate(row["date"]),
      description: row["description"] || "",
      amount: row["paid in"] ? parseAmount(row["paid in"]) : -parseAmount(row["paid out"] || row["amount"] || 0),
      balance: parseAmount(row["balance"] || 0),
      type: "",
      direction: row["paid in"] ? "ingoing" : "outgoing",
    }),
  },
  lloyds: {
    name: "Lloyds",
    detect: (headers) => headers.includes("transaction date") && headers.includes("transaction description") && (headers.includes("debit amount") || headers.includes("credit amount")),
    map: (row) => ({
      date: parseDate(row["transaction date"]),
      description: row["transaction description"] || "",
      amount: row["credit amount"] ? parseAmount(row["credit amount"]) : -parseAmount(row["debit amount"] || 0),
      balance: parseAmount(row["balance"] || 0),
      type: row["transaction type"] || "",
      direction: row["credit amount"] ? "ingoing" : "outgoing",
    }),
  },
  natwest: {
    name: "NatWest / RBS",
    detect: (headers) => headers.includes("date") && headers.includes("description") && headers.includes("value") && headers.includes("account name"),
    map: (row) => ({
      date: parseDate(row["date"]),
      description: row["description"] || "",
      amount: parseAmount(row["value"]),
      balance: parseAmount(row["balance"] || 0),
      type: row["type"] || "",
      direction: parseDirection(row["value"]),
    }),
  },
  nationwide: {
    name: "Nationwide",
    detect: (headers) => headers.includes("date") && headers.includes("transactions") && (headers.includes("paid in") || headers.includes("paid out")),
    map: (row) => ({
      date: parseDate(row["date"]),
      description: row["transactions"] || "",
      amount: row["paid in"] ? parseAmount(row["paid in"]) : -parseAmount(row["paid out"] || 0),
      balance: parseAmount(row["balance"] || 0),
      type: "",
      direction: row["paid in"] ? "ingoing" : "outgoing",
    }),
  },
  generic: {
    name: "Generic CSV",
    detect: () => true,
    map: (row) => {
      const keys = Object.keys(row);
      const dateKey = keys.find(k => /date/i.test(k)) || keys[0];
      const descKey = keys.find(k => /desc|narr|memo|ref|merchant|detail/i.test(k) && !/date/i.test(k)) || keys[1];
      // Smart currency field detection: look for known amount column names
      const amountKey = keys.find(k => /debit\/credit|debit.credit|amount|value|sum|paid|credit|debit/i.test(k) && !/balance/i.test(k));
      const balKey = keys.find(k => /balance/i.test(k));
      // If no named amount column found, scan for columns containing £ or numeric-looking values
      let amount = 0;
      if (amountKey) {
        amount = parseAmount(row[amountKey]);
      } else {
        // Fallback: find first column with a £ sign or looks like a currency value
        for (const k of keys) {
          const val = row[k];
          if (val && /^[£\-\+]?\s*[\d,]+\.?\d*$/.test(String(val).trim()) && !/date/i.test(k) && k !== dateKey && k !== descKey) {
            amount = parseAmount(val);
            break;
          }
        }
      }
      const rawAmountVal = amountKey ? row[amountKey] : "";
      return {
        date: parseDate(row[dateKey]),
        description: row[descKey] || "",
        amount,
        balance: balKey ? parseAmount(row[balKey]) : 0,
        type: "",
        direction: parseDirection(rawAmountVal),
      };
    },
  },
};

function detectBankFormat(headers) {
  const normalised = headers.map(h => h.toLowerCase().trim());
  for (const [key, format] of Object.entries(BANK_FORMATS)) {
    if (key === "generic") continue;
    if (format.detect(normalised)) return { key, format };
  }
  return { key: "generic", format: BANK_FORMATS.generic };
}

// ─────────────────────────────────────────────
// CSV PARSER (handles quoted fields, newlines)
// ─────────────────────────────────────────────

function parseCSV(text) {
  const lines = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "\n" && !inQuotes) { lines.push(current); current = ""; continue; }
    if (ch === "\r" && !inQuotes) continue;
    current += ch;
  }
  if (current.trim()) lines.push(current);

  const rows = lines.map(l => l.split(",").map(c => c.trim()));
  if (rows.length < 2) return { headers: [], data: [] };

  // Smart header detection: midata and some bank CSVs have preamble rows
  // (e.g. "midata statement download...", "Account Number: ****...", blank rows)
  // Find the real header row by looking for a row that contains known column names
  const KNOWN_HEADERS = ["date","type","description","amount","balance","merchant","debit","credit","paid","value","transaction","memo","number","account"];
  let headerIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const lower = rows[i].map(c => c.toLowerCase().trim());
    const matchCount = lower.filter(c => KNOWN_HEADERS.some(kh => c.includes(kh))).length;
    // If 2+ cells in this row look like column headers, treat it as the header row
    if (matchCount >= 2) { headerIdx = i; break; }
  }

  const headers = rows[headerIdx];
  const data = rows.slice(headerIdx + 1)
    .filter(r => r.length >= headers.length - 1 && r.some(c => c))
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => { obj[h.toLowerCase().trim()] = r[i] || ""; });
      return obj;
    });
  return { headers: headers.map(h => h.toLowerCase().trim()), data };
}

// ─────────────────────────────────────────────
// HMRC SCHEMES DATA
// ─────────────────────────────────────────────

const HMRC_SCHEMES = [
  {
    id: "marriage-allowance",
    name: "Marriage Allowance",
    icon: Heart,
    category: "Marriage & Civil Partnership",
    description: "Transfer £1,260 of your Personal Allowance to your spouse/civil partner, reducing their tax by up to £252/year.",
    eligibility: [
      "You're married or in a civil partnership",
      "One partner earns less than £12,570 (Personal Allowance)",
      "The other partner is a basic rate (20%) taxpayer (earning less than £50,270)",
    ],
    potentialSaving: "Up to £252/year",
    canBackdate: "Up to 4 years",
    link: "https://www.gov.uk/marriage-allowance",
    tags: ["married"],
  },
  {
    id: "married-couples-allowance",
    name: "Married Couple's Allowance",
    icon: Heart,
    category: "Marriage & Civil Partnership",
    description: "Tax reduction if you or your spouse were born before 6 April 1935. Worth between £427 and £1,108.10/year.",
    eligibility: [
      "You're married or in a civil partnership",
      "One of you was born before 6 April 1935",
      "Higher income partner's adjusted net income below £39,200 (2026/27)",
    ],
    potentialSaving: "£427 – £1,108.10/year",
    canBackdate: null,
    link: "https://www.gov.uk/married-couples-allowance",
    tags: ["married"],
  },
  {
    id: "child-benefit",
    name: "Child Benefit",
    icon: Baby,
    category: "Children & Families",
    description: "Weekly payments for each child. £26.05/week for the eldest, £17.25 for additional children. Subject to High Income Child Benefit Charge if either parent earns over £60,000.",
    eligibility: [
      "You're responsible for a child under 16 (or under 20 if in approved education/training)",
      "You live in the UK",
      "If either parent earns over £60,000, you may need to repay some via the HICBC",
    ],
    potentialSaving: "£1,354.60/year (first child) + £897/year (each additional)",
    canBackdate: "Up to 3 months",
    link: "https://www.gov.uk/child-benefit",
    tags: ["children"],
  },
  {
    id: "tax-free-childcare",
    name: "Tax-Free Childcare",
    icon: Baby,
    category: "Children & Families",
    description: "Government tops up childcare payments by 25% — for every £8 you pay, the government adds £2, up to £2,000/year per child (£4,000 for disabled children).",
    eligibility: [
      "You have a child under 12 (or under 17 if disabled)",
      "Both parents work (or one works and one is disabled/carer)",
      "Each parent earns at least National Minimum Wage for 16 hours/week",
      "Neither parent earns over £100,000/year",
      "You're not receiving Tax Credits, Universal Credit, or childcare vouchers",
    ],
    potentialSaving: "Up to £2,000/year per child",
    canBackdate: null,
    link: "https://www.gov.uk/tax-free-childcare",
    tags: ["children"],
  },
  {
    id: "pension-tax-relief",
    name: "Pension Tax Relief",
    icon: Landmark,
    category: "Pensions & Savings",
    description: "Get tax relief on pension contributions. Basic rate taxpayers get 20% relief automatically; higher/additional rate taxpayers can claim extra relief via Self Assessment.",
    eligibility: [
      "You pay into a workplace or personal pension",
      "You're a UK taxpayer under 75",
      "Annual allowance: up to £60,000 or 100% of earnings (whichever is lower)",
    ],
    potentialSaving: "20–45% of contributions (depending on tax band)",
    canBackdate: null,
    link: "https://www.gov.uk/tax-on-your-private-pension/pension-tax-relief",
    tags: ["all"],
  },
  {
    id: "salary-sacrifice-pension",
    name: "Salary Sacrifice – Pension",
    icon: Briefcase,
    category: "Salary Sacrifice Schemes",
    description: "Reduce your gross salary in exchange for employer pension contributions. Saves both Income Tax and National Insurance.",
    eligibility: [
      "Your employer offers a salary sacrifice pension scheme",
      "Your reduced salary stays above National Minimum Wage",
      "Note: From April 2029, only first £2,000 of employee contributions via salary sacrifice will be NI-exempt",
    ],
    potentialSaving: "Income Tax + NI savings on sacrificed amount",
    canBackdate: null,
    link: "https://www.gov.uk/guidance/salary-sacrifice-and-the-effects-on-paye",
    tags: ["all"],
  },
  {
    id: "cycle-to-work",
    name: "Cycle to Work Scheme",
    icon: Bike,
    category: "Salary Sacrifice Schemes",
    description: "Get a bike and safety equipment tax-free through your employer. Save up to 42% on the cost of a bike.",
    eligibility: [
      "Your employer offers the scheme",
      "You use the bike mainly for commuting (at least 50%)",
      "Your reduced salary remains above National Minimum Wage",
    ],
    potentialSaving: "25–42% of bike cost (depending on tax band)",
    canBackdate: null,
    link: "https://www.gov.uk/government/publications/cycle-to-work-scheme-implementation-guidance",
    tags: ["all"],
  },
  {
    id: "ev-salary-sacrifice",
    name: "Electric Vehicle Salary Sacrifice",
    icon: Car,
    category: "Salary Sacrifice Schemes",
    description: "Lease an electric car through salary sacrifice. Benefit-in-kind rate for EVs is just 2%, making this very tax efficient.",
    eligibility: [
      "Your employer offers an EV salary sacrifice scheme",
      "You choose a fully electric vehicle (0g/km CO₂)",
      "Your reduced salary remains above National Minimum Wage",
    ],
    potentialSaving: "Typically 30–60% vs personal lease (due to tax/NI savings)",
    canBackdate: null,
    link: "https://www.gov.uk/tax-on-company-benefits/tax-on-benefit-in-kind",
    tags: ["all"],
  },
  {
    id: "gift-aid",
    name: "Gift Aid",
    icon: Gift,
    category: "Charitable Giving",
    description: "Charities reclaim 25p for every £1 you donate. Higher/additional rate taxpayers can claim extra relief via Self Assessment.",
    eligibility: [
      "You're a UK taxpayer",
      "You've paid enough Income Tax or Capital Gains Tax to cover the Gift Aid claimed",
      "You make a Gift Aid declaration with the charity",
    ],
    potentialSaving: "Higher rate: claim back 20% of donation. Additional rate: claim back 25%.",
    canBackdate: null,
    link: "https://www.gov.uk/donating-to-charity/gift-aid",
    tags: ["all"],
  },
  {
    id: "isa-allowance",
    name: "ISA Tax-Free Savings",
    icon: Shield,
    category: "Pensions & Savings",
    description: "Save or invest up to £20,000/year in ISAs (Cash ISA, Stocks & Shares ISA, Lifetime ISA, Innovative Finance ISA) with no tax on interest or gains.",
    eligibility: [
      "You're a UK resident aged 16+ (18+ for Stocks & Shares ISA)",
      "Annual allowance: £20,000 across all ISA types",
      "Lifetime ISA: 18–39 to open, 25% government bonus on up to £4,000/year",
    ],
    potentialSaving: "Tax-free growth on up to £20,000/year",
    canBackdate: null,
    link: "https://www.gov.uk/individual-savings-accounts",
    tags: ["all"],
  },
  {
    id: "wfh-tax-relief",
    name: "Working from Home Tax Relief",
    icon: Home,
    category: "Employment",
    description: "Claim tax relief on additional household costs if you work from home. Flat rate of £6/week (£312/year) without receipts.",
    eligibility: [
      "Your employer requires you to work from home (not by choice)",
      "You incur additional costs (heating, electricity, broadband)",
      "Your employer doesn't already reimburse these costs",
    ],
    potentialSaving: "£62.40/year (basic rate) – £140.40/year (additional rate)",
    canBackdate: "Up to 4 years",
    link: "https://www.gov.uk/tax-relief-for-employees/working-at-home",
    tags: ["all"],
  },
  {
    id: "blind-persons-allowance",
    name: "Blind Person's Allowance",
    icon: Shield,
    category: "Disability & Health",
    description: "Extra tax-free allowance of £3,070 if you're registered blind or severely sight impaired. Can be transferred to a spouse.",
    eligibility: [
      "Registered as blind or severely sight impaired with your local authority",
      "In Scotland/Northern Ireland: unable to perform work for which eyesight is essential",
    ],
    potentialSaving: "Up to £614/year (basic rate)",
    canBackdate: null,
    link: "https://www.gov.uk/blind-persons-allowance",
    tags: ["all"],
  },
];

// ─────────────────────────────────────────────
// UK BANKS
// ─────────────────────────────────────────────

const UK_BANKS = [
  "Barclays","HSBC","Lloyds","NatWest","Santander","Halifax","Nationwide",
  "Monzo","Starling Bank","First Direct","Metro Bank","TSB",
  "Co-operative Bank","RBS","Bank of Scotland","Chase UK","Revolut","Tide",
  "American Express","Capital One","Virgin Money",
];

// ─────────────────────────────────────────────
// COLOUR PALETTE
// ─────────────────────────────────────────────

const COLORS = ["#6366f1","#f43f5e","#10b981","#f59e0b","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#f97316","#06b6d4","#84cc16","#a855f7"];

// ─────────────────────────────────────────────
// TAB COMPONENTS
// ─────────────────────────────────────────────

// === TRANSACTIONS IMPORT TAB ===
function TransactionsTab({ transactions, setTransactions, userId }) {
  const [saving, setSaving] = useState(false);
  const [importSuccess, setImportSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [pendingImport, setPendingImport] = useState(null);
  const [importMeta, setImportMeta] = useState({ bankName: "", customBank: "", accountType: "debit" });
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const fileRef = useRef(null);

  const doImport = useCallback(async (file, hash, tagged, format, bankName, accountType) => {
    const storagePath = await uploadCSVToStorage(userId, file);
    await saveTransactionsToDB(userId, tagged, file.name, format.name, bankName, accountType);
    await trackCSVUpload(userId, file.name, storagePath, "midata", format.name, tagged.length, hash, bankName, accountType);
    setTransactions(prev => [...prev, ...tagged]);
    setImportSuccess({ count: tagged.length, bankName, accountType });
  }, [userId, setTransactions]);

  const handleFile = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError(null); setPendingImport(null); setImportSuccess(null); setSaving(true);
    try {
      const text = await file.text();
      const { headers, data } = parseCSV(text);
      if (data.length === 0) { setError("No data rows found in file."); setSaving(false); return; }
      const { key, format } = detectBankFormat(headers);
      if (key !== "midata") {
        setError("Only midata CSV files are accepted. Export your transactions from your bank using the midata standard and try again.");
        setSaving(false);
        return;
      }
      const hash = await hashFileContent(text);
      const mapped = data.map(row => {
        const t = format.map(row);
        return { ...t, category: categoriseTransaction(t.description, t.type) };
      }).filter(t => t.date);
      const existing = await findDuplicateUpload(userId, hash);
      setPendingImport({ file, hash, mapped, format, existing: existing || null });
    } catch (err) {
      setError("Failed to read file: " + err.message);
    }
    setSaving(false);
    e.target.value = "";
  }, [userId]);

  const handleConfirmImport = useCallback(async () => {
    if (!pendingImport) return;
    const bankName = importMeta.bankName === "other" ? importMeta.customBank.trim() : importMeta.bankName;
    if (!bankName) { setError("Please select or enter a bank name."); return; }
    setSaving(true); setError(null);
    try {
      const { file, hash, mapped, format, existing } = pendingImport;
      const tagged = mapped.map(t => ({ ...t, bank_name: bankName, account_type: importMeta.accountType }));
      if (existing) {
        await deleteTransactionsBySource(userId, existing.file_name);
        await deleteUploadRecord(existing.id);
        setTransactions(prev => prev.filter(t => t.source_file !== existing.file_name));
      }
      await doImport(file, hash, tagged, format, bankName, importMeta.accountType);
      setPendingImport(null);
      setImportMeta({ bankName: "", customBank: "", accountType: "debit" });
    } catch (err) {
      setError("Failed to import: " + err.message);
    }
    setSaving(false);
  }, [pendingImport, importMeta, userId, doImport, setTransactions]);

  const clearAll = async () => {
    try {
      await deleteAllTransactions(userId);
      setTransactions([]);
      setDetectedBank(null);
      setImportCount(0);
    } catch (err) {
      setError("Failed to clear: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Import Bank Transactions</h2>
        <p className="text-sm text-gray-500 mb-4">Upload your midata CSV export. In your bank's app or website, go to <strong>Export transactions → midata format</strong> and upload the file here.</p>

        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
        >
          <Upload className="mx-auto mb-3 text-gray-400" size={36} />
          <p className="text-sm font-medium text-gray-700">{saving ? "Uploading and saving..." : "Click to upload midata CSV"}</p>
          <p className="text-xs text-gray-400 mt-1">Midata format only — other CSV formats will be rejected</p>
          <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {pendingImport && (
          <div className="mt-4 space-y-3">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-gray-800 mb-3">
                {pendingImport.mapped.length} transactions ready — confirm import details
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Bank</label>
                  <select
                    value={importMeta.bankName}
                    onChange={e => setImportMeta(p => ({ ...p, bankName: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select bank…</option>
                    {UK_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                    <option value="other">Other…</option>
                  </select>
                  {importMeta.bankName === "other" && (
                    <input
                      className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Enter bank name"
                      value={importMeta.customBank}
                      onChange={e => setImportMeta(p => ({ ...p, customBank: e.target.value }))}
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Account Type</label>
                  <div className="flex gap-2">
                    {["debit","credit"].map(type => (
                      <button
                        key={type}
                        onClick={() => setImportMeta(p => ({ ...p, accountType: type }))}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                          importMeta.accountType === type
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {type === "debit" ? "Debit Card" : "Credit Card"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {pendingImport.existing && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5 text-amber-600" />
                <span>
                  This file was already imported on{" "}
                  <strong>{new Date(pendingImport.existing.uploaded_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</strong>
                  {" "}({pendingImport.existing.row_count} transactions). Confirming will replace them.
                </span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleConfirmImport}
                disabled={saving || !importMeta.bankName || (importMeta.bankName === "other" && !importMeta.customBank.trim())}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40"
              >
                {saving ? "Importing…" : pendingImport.existing ? "Replace & Import" : "Confirm Import"}
              </button>
              <button
                onClick={() => setPendingImport(null)}
                disabled={saving}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {importSuccess && !pendingImport && (
          <div className="mt-4 flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg text-sm">
            <CheckCircle size={16} />
            Imported <strong>{importSuccess.count}</strong> transactions from <strong>{importSuccess.bankName}</strong>
            {" "}(<span className="capitalize">{importSuccess.accountType}</span>)
          </div>
        )}
      </div>

      {transactions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{transactions.length} Transactions Loaded</h3>
            <button onClick={clearAll} className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1"><Trash2 size={14}/> Clear All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-600">Date</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">Type</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">Description</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">Category</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600">Direction</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">Amount</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">Balance</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(page * pageSize, (page + 1) * pageSize).map((t, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-600">{t.date?.toLocaleDateString("en-GB")}</td>
                    <td className="py-2 px-3 text-gray-500 text-xs">{t.type || "—"}</td>
                    <td className="py-2 px-3 text-gray-800 max-w-xs truncate">{t.description}</td>
                    <td className="py-2 px-3"><span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">{t.category}</span></td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.direction === "ingoing" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                        {t.direction === "ingoing" ? "Ingoing" : "Outgoing"}
                      </span>
                    </td>
                    <td className={`py-2 px-3 text-right font-medium ${t.direction === "ingoing" ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(Math.abs(t.amount))}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-600">{t.balance ? formatCurrency(t.balance) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Pagination */}
            {transactions.length > pageSize && (() => {
              const totalPages = Math.ceil(transactions.length / pageSize);
              return (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, transactions.length)} of {transactions.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(0)}
                      disabled={page === 0}
                      className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >First</button>
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="px-3 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >← Prev</button>
                    <span className="text-xs text-gray-600 font-medium px-2">
                      Page {page + 1} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="px-3 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >Next →</button>
                    <button
                      onClick={() => setPage(totalPages - 1)}
                      disabled={page >= totalPages - 1}
                      className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >Last</button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// === PAYSLIP TAB ===
function PayslipTab({ payslips, setPayslips, transactions, userId }) {
  const [mode, setMode] = useState("manual"); // manual | csv
  const [form, setForm] = useState({ month: "", year: new Date().getFullYear(), grossPay: "", taxDeducted: "", nationalInsurance: "", pensionContribution: "", studentLoan: "", otherDeductions: "", netPay: "" });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [employer, setEmployer] = useState("");
  const [skipGross, setSkipGross] = useState(false);
  const fileRef = useRef(null);

  // Filter transactions: Bank credit + ingoing + matches employer name
  const bankCredits = useMemo(() => {
    const search = employer.trim().toLowerCase();
    return transactions
      .filter(t => {
        if (!t.type || !/bank credit/i.test(t.type)) return false;
        if (t.direction !== "ingoing") return false;
        if (!search) return false; // Don't show any until employer is entered
        // Match employer name against the type field (e.g. "Bank credit CLIFFORD CHANCE")
        const typeLower = (t.type || "").toLowerCase();
        const descLower = (t.description || "").toLowerCase();
        return typeLower.includes(search) || descLower.includes(search);
      })
      .sort((a, b) => b.date - a.date)
      .map(t => ({
        label: `${t.date?.toLocaleDateString("en-GB")} — ${t.type} — ${formatCurrency(Math.abs(t.amount))}`,
        amount: Math.abs(t.amount),
        date: t.date,
      }));
  }, [transactions, employer]);

  const handleFormChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleBankCreditSelect = (idx) => {
    if (idx === "") {
      handleFormChange("netPay", "");
      return;
    }
    const selected = bankCredits[parseInt(idx)];
    if (!selected) return;
    setForm(prev => ({
      ...prev,
      netPay: selected.amount,
      month: MONTHS[selected.date.getMonth()],
      year: selected.date.getFullYear(),
    }));
    setSkipGross(true);
  };

  const addManualPayslip = async () => {
    setError(null); setSuccess(null);
    if (!form.month) { setError("Month is required."); return; }
    if (!skipGross && !form.grossPay) { setError("Gross Pay is required (or tick 'Use Net Pay only')."); return; }
    if (skipGross && !form.netPay) { setError("Net Pay is required when skipping Gross Pay."); return; }
    const payslip = {
      month: form.month,
      year: parseInt(form.year),
      employerName: employer || null,
      grossPay: parseAmount(form.grossPay),
      taxDeducted: parseAmount(form.taxDeducted),
      nationalInsurance: parseAmount(form.nationalInsurance),
      pensionContribution: parseAmount(form.pensionContribution),
      studentLoan: parseAmount(form.studentLoan),
      otherDeductions: parseAmount(form.otherDeductions),
      netPay: parseAmount(form.netPay) || (parseAmount(form.grossPay) - parseAmount(form.taxDeducted) - parseAmount(form.nationalInsurance) - parseAmount(form.pensionContribution) - parseAmount(form.studentLoan) - parseAmount(form.otherDeductions)),
      skipGross,
    };
    try {
      await savePayslipToDB(userId, payslip);
      setPayslips(prev => [...prev, payslip]);
      setSuccess(`Payslip for ${form.month} ${form.year} saved.`);
      setForm({ month: "", year: new Date().getFullYear(), grossPay: "", taxDeducted: "", nationalInsurance: "", pensionContribution: "", studentLoan: "", otherDeductions: "", netPay: "" });
      setSkipGross(false);
    } catch (err) {
      setError("Failed to save payslip: " + err.message);
    }
  };

  const handleCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const { headers, data } = parseCSV(evt.target.result);
        const mapped = data.map(row => {
          const keys = Object.keys(row);
          return {
            month: row[keys.find(k => /month/i.test(k))] || "",
            year: parseInt(row[keys.find(k => /year/i.test(k))] || new Date().getFullYear()),
            grossPay: parseAmount(row[keys.find(k => /gross/i.test(k))] || 0),
            taxDeducted: parseAmount(row[keys.find(k => /tax/i.test(k))] || 0),
            nationalInsurance: parseAmount(row[keys.find(k => /ni|national/i.test(k))] || 0),
            pensionContribution: parseAmount(row[keys.find(k => /pension/i.test(k))] || 0),
            studentLoan: parseAmount(row[keys.find(k => /student/i.test(k))] || 0),
            otherDeductions: parseAmount(row[keys.find(k => /other/i.test(k))] || 0),
            netPay: parseAmount(row[keys.find(k => /net/i.test(k))] || 0),
          };
        }).filter(p => p.grossPay > 0);
        setPayslips(prev => [...prev, ...mapped]);
        setSuccess(`Imported ${mapped.length} payslips.`);
      } catch (err) {
        setError("Failed to parse payslip CSV: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Import Payslips</h2>
        <div className="flex gap-2 mb-6">
          <button onClick={() => setMode("manual")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === "manual" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>Manual Entry</button>
          <button onClick={() => setMode("csv")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === "csv" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>CSV Upload</button>
        </div>

        {mode === "manual" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month *</label>
                <select value={form.month} onChange={e => handleFormChange("month", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="">Select month</option>
                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <input type="number" value={form.year} onChange={e => handleFormChange("year", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[["grossPay","Gross Pay *"],["taxDeducted","Tax Deducted"],["nationalInsurance","National Insurance"],["pensionContribution","Pension Contribution"],["studentLoan","Student Loan"],["otherDeductions","Other Deductions"]].map(([key, label]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-400 text-sm">£</span>
                    <input type="number" step="0.01" value={form[key]} onChange={e => handleFormChange(key, e.target.value)} className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="0.00" />
                  </div>
                </div>
              ))}
            </div>
            {/* Employer name — used to match salary payments from bank transactions */}
            {transactions.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employer Name</label>
                <input
                  type="text"
                  value={employer}
                  onChange={e => setEmployer(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g. Clifford Chance, Qube Research..."
                />
                <p className="text-xs text-gray-400 mt-1">
                  {employer.trim()
                    ? `Found ${bankCredits.length} matching salary payment${bankCredits.length !== 1 ? "s" : ""}`
                    : "Type your employer name to find matching salary payments from your bank transactions"}
                </p>
              </div>
            )}

            {/* Net Pay — dropdown from matched Bank Credit transactions or manual entry */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Net Pay</label>
              {bankCredits.length > 0 ? (
                <div className="space-y-2">
                  <select
                    onChange={e => handleBankCreditSelect(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    defaultValue=""
                  >
                    <option value="">Select from Bank Credit transactions</option>
                    {bankCredits.map((bc, i) => (
                      <option key={i} value={i}>{bc.label}</option>
                    ))}
                  </select>
                  {form.netPay && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                      Net Pay: <strong>{formatCurrency(parseFloat(form.netPay))}</strong> — Month/Year auto-filled to <strong>{form.month} {form.year}</strong>
                    </div>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skipGross}
                      onChange={e => setSkipGross(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700">Use Net Pay only (skip Gross Pay requirement)</span>
                  </label>
                  <p className="text-xs text-gray-400">Or enter manually below:</p>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-400 text-sm">£</span>
                    <input type="number" step="0.01" value={form.netPay} onChange={e => handleFormChange("netPay", e.target.value)} className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="0.00" />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-400 text-sm">£</span>
                    <input type="number" step="0.01" value={form.netPay} onChange={e => handleFormChange("netPay", e.target.value)} className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="0.00" />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Import bank transactions first to select from Bank Credit entries, or type manually. Auto-calculated from deductions if left blank.</p>
                </div>
              )}
            </div>
            <button onClick={addManualPayslip} className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"><Plus size={16}/> Add Payslip</button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500 mb-3">Upload a CSV with columns: Month, Year, Gross Pay, Tax, National Insurance, Pension, Student Loan, Other Deductions, Net Pay</p>
            <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
              <Upload className="mx-auto mb-3 text-gray-400" size={36} />
              <p className="text-sm font-medium text-gray-700">Click to upload payslip CSV</p>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleCSV} className="hidden" />
            </div>
          </div>
        )}

        {error && <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm"><AlertCircle size={16}/> {error}</div>}
        {success && <div className="mt-4 flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg text-sm"><CheckCircle size={16}/> {success}</div>}
      </div>

      {payslips.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{payslips.length} Payslips</h3>
            <button onClick={async () => { try { await deleteAllPayslips(userId); setPayslips([]); } catch(err) { setError(err.message); } }} className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1"><Trash2 size={14}/> Clear All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {["Period","Gross","Tax","NI","Pension","Student Loan","Other","Net"].map(h => (
                    <th key={h} className="text-right py-2 px-3 font-medium text-gray-600 first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payslips.map((p, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-800 font-medium">{p.month} {p.year}</td>
                    <td className="py-2 px-3 text-right text-gray-800">{formatCurrency(p.grossPay)}</td>
                    <td className="py-2 px-3 text-right text-red-600">{formatCurrency(p.taxDeducted)}</td>
                    <td className="py-2 px-3 text-right text-red-600">{formatCurrency(p.nationalInsurance)}</td>
                    <td className="py-2 px-3 text-right text-orange-600">{formatCurrency(p.pensionContribution)}</td>
                    <td className="py-2 px-3 text-right text-orange-600">{formatCurrency(p.studentLoan)}</td>
                    <td className="py-2 px-3 text-right text-gray-500">{formatCurrency(p.otherDeductions)}</td>
                    <td className="py-2 px-3 text-right text-green-600 font-medium">{formatCurrency(p.netPay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// === ANALYSIS TAB ===
function AnalysisTab({ transactions, payslips }) {
  const monthlyData = useMemo(() => {
    if (transactions.length === 0) return [];
    const map = {};
    transactions.forEach(t => {
      if (!t.date) return;
      const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}`;
      if (!map[key]) map[key] = { month: key, label: formatMonth(t.date), income: 0, expenditure: 0, net: 0 };
      if (t.direction === "ingoing") map[key].income += Math.abs(t.amount);
      else map[key].expenditure += Math.abs(t.amount);
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).map(m => ({ ...m, net: m.income - m.expenditure }));
  }, [transactions]);

  const categoryData = useMemo(() => {
    const map = {};
    transactions.filter(t => t.direction === "outgoing").forEach(t => {
      const cat = t.category;
      map[cat] = (map[cat] || 0) + Math.abs(t.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value);
  }, [transactions]);

  const totals = useMemo(() => {
    const income = transactions.filter(t => t.direction === "ingoing").reduce((s, t) => s + Math.abs(t.amount), 0);
    const expenditure = transactions.filter(t => t.direction === "outgoing").reduce((s, t) => s + Math.abs(t.amount), 0);
    return { income, expenditure, net: income - expenditure };
  }, [transactions]);

  const payslipTotals = useMemo(() => {
    if (payslips.length === 0) return null;
    return {
      grossPay: payslips.reduce((s, p) => s + p.grossPay, 0),
      taxDeducted: payslips.reduce((s, p) => s + p.taxDeducted, 0),
      nationalInsurance: payslips.reduce((s, p) => s + p.nationalInsurance, 0),
      pensionContribution: payslips.reduce((s, p) => s + p.pensionContribution, 0),
      netPay: payslips.reduce((s, p) => s + p.netPay, 0),
      avgGross: payslips.reduce((s, p) => s + p.grossPay, 0) / payslips.length,
      effectiveTaxRate: (payslips.reduce((s, p) => s + p.taxDeducted, 0) / payslips.reduce((s, p) => s + p.grossPay, 0)) * 100,
    };
  }, [payslips]);

  if (transactions.length === 0 && payslips.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <TrendingUp className="mx-auto mb-3 text-gray-300" size={48} />
        <p className="text-gray-500">Import transactions or payslips to see your analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Income", value: formatCurrency(totals.income), icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
          { label: "Total Expenditure", value: formatCurrency(totals.expenditure), icon: TrendingDown, color: "text-red-600", bg: "bg-red-50" },
          { label: "Net Position", value: formatCurrency(totals.net), icon: PoundSterling, color: totals.net >= 0 ? "text-green-600" : "text-red-600", bg: totals.net >= 0 ? "bg-green-50" : "bg-red-50" },
          { label: "Transactions", value: transactions.length.toLocaleString(), icon: CreditCard, color: "text-indigo-600", bg: "bg-indigo-50" },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className={`${card.bg} rounded-lg p-2`}><card.icon className={card.color} size={20} /></div>
              <div>
                <p className="text-xs text-gray-500 font-medium">{card.label}</p>
                <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly Income vs Expenditure */}
      {monthlyData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Income vs Expenditure</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={monthlyData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ fontSize: 13, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
              <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenditure" name="Expenditure" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Net Position Trend */}
      {monthlyData.length > 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Net Position Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={v => `£${(v / 1000).toFixed(1)}k`} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Area type="monotone" dataKey="net" name="Net" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Spending by Category */}
      {categoryData.length > 0 && (() => {
        const totalSpend = categoryData.reduce((s, c) => s + c.value, 0);
        const mainCats = categoryData.filter(c => c.value / totalSpend >= 0.03);
        const smallCats = categoryData.filter(c => c.value / totalSpend < 0.03);
        const pieData = smallCats.length > 0
          ? [...mainCats, { name: `Other (${smallCats.length})`, value: smallCats.reduce((s, c) => s + c.value, 0) }]
          : mainCats;
        const maxVal = categoryData[0]?.value || 1;
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Spending by Category</h3>
              {smallCats.length > 0 && (
                <p className="text-xs text-gray-400 mb-3">{smallCats.length} small categories grouped into Other</p>
              )}
              <div className="relative">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={75}
                      outerRadius={118}
                      paddingAngle={2}
                    >
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v, name) => [formatCurrency(v), name]}
                      contentStyle={{ fontSize: 13, borderRadius: 8, border: "1px solid #e5e7eb" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-0.5">Total Spend</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(totalSpend)}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Breakdown</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {categoryData.map((cat, i) => {
                  const pct = totalSpend > 0 ? (cat.value / totalSpend) * 100 : 0;
                  const barWidth = (cat.value / maxVal) * 100;
                  const color = COLORS[i % COLORS.length];
                  return (
                    <div key={cat.name}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-sm text-gray-700 flex-1 truncate">{cat.name}</span>
                        <span className="text-xs text-gray-400 tabular-nums">{pct.toFixed(1)}%</span>
                        <span className="text-sm font-semibold text-gray-900 tabular-nums w-24 text-right">{formatCurrency(cat.value)}</span>
                      </div>
                      <div className="ml-4 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Payslip Summary */}
      {payslipTotals && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payslip Summary ({payslips.length} payslips)</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              ["Total Gross", formatCurrency(payslipTotals.grossPay), "text-gray-900"],
              ["Total Tax", formatCurrency(payslipTotals.taxDeducted), "text-red-600"],
              ["Total NI", formatCurrency(payslipTotals.nationalInsurance), "text-red-600"],
              ["Avg Monthly Gross", formatCurrency(payslipTotals.avgGross), "text-indigo-600"],
              ["Effective Tax Rate", `${payslipTotals.effectiveTaxRate.toFixed(1)}%`, "text-orange-600"],
            ].map(([label, value, color]) => (
              <div key={label} className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-lg font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// === HMRC SCHEMES TAB ===
function HMRCTab() {
  const [filters, setFilters] = useState({ married: false, children: false });
  const [checkedSchemes, setCheckedSchemes] = useState({});

  const toggleFilter = (key) => setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleScheme = (id) => setCheckedSchemes(prev => ({ ...prev, [id]: !prev[id] }));

  const filteredSchemes = useMemo(() => {
    return HMRC_SCHEMES.filter(s => {
      if (!filters.married && !filters.children) return true;
      if (s.tags.includes("all")) return true;
      if (filters.married && s.tags.includes("married")) return true;
      if (filters.children && s.tags.includes("children")) return true;
      return false;
    });
  }, [filters]);

  const categories = useMemo(() => {
    const map = {};
    filteredSchemes.forEach(s => {
      if (!map[s.category]) map[s.category] = [];
      map[s.category].push(s);
    });
    return Object.entries(map);
  }, [filteredSchemes]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">HMRC Tax Schemes & Reliefs</h2>
        <p className="text-sm text-gray-500 mb-4">Check which schemes you may be eligible for. Filter by your circumstances.</p>

        <div className="flex gap-3 mb-2">
          <button onClick={() => toggleFilter("married")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filters.married ? "bg-pink-100 text-pink-700 border border-pink-300" : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent"}`}>
            <Heart size={16} /> Married / Civil Partnership
          </button>
          <button onClick={() => toggleFilter("children")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filters.children ? "bg-blue-100 text-blue-700 border border-blue-300" : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent"}`}>
            <Baby size={16} /> Have Children
          </button>
        </div>
        <p className="text-xs text-gray-400">{filters.married || filters.children ? `Showing schemes relevant to: ${[filters.married && "Married/Civil Partnership", filters.children && "Parents"].filter(Boolean).join(", ")}` : "Showing all schemes. Use filters to narrow by your circumstances."}</p>
      </div>

      {categories.map(([category, schemes]) => (
        <div key={category} className="space-y-3">
          <h3 className="text-base font-semibold text-gray-800 px-1">{category}</h3>
          {schemes.map(scheme => {
            const Icon = scheme.icon;
            const checked = checkedSchemes[scheme.id];
            return (
              <div key={scheme.id} className={`bg-white rounded-xl shadow-sm border p-5 transition-colors ${checked ? "border-green-300 bg-green-50/30" : "border-gray-200"}`}>
                <div className="flex items-start gap-4">
                  <button onClick={() => toggleScheme(scheme.id)} className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${checked ? "bg-green-600 border-green-600" : "border-gray-300 hover:border-indigo-400"}`}>
                    {checked && <CheckCircle size={14} className="text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={18} className="text-indigo-600 flex-shrink-0" />
                      <h4 className="font-semibold text-gray-900">{scheme.name}</h4>
                      {scheme.potentialSaving && <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">{scheme.potentialSaving}</span>}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{scheme.description}</p>

                    <div className="mb-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Eligibility</p>
                      <ul className="space-y-1">
                        {scheme.eligibility.map((e, i) => (
                          <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                            <ChevronRight size={14} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                            {e}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      {scheme.canBackdate && (
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Calendar size={12} /> Can backdate: {scheme.canBackdate}
                        </span>
                      )}
                      <a href={scheme.link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                        GOV.UK <ChevronRight size={12} />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex gap-2">
          <Info size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Disclaimer</p>
            <p className="text-sm text-amber-700">This checklist is for informational purposes only and does not constitute tax advice. Eligibility criteria may change. Always verify with HMRC or a qualified tax adviser before claiming.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// === PROFILE TAB ===
function ProfileTab({ userId, session, transactions, payslips }) {
  const [profile, setProfile] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: "", employer_name: "", is_married: false, has_children: false });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([loadProfile(userId), loadCSVUploads(userId)])
      .then(([prof, ups]) => {
        setProfile(prof);
        setForm({
          full_name: prof?.full_name || "",
          employer_name: prof?.employer_name || "",
          is_married: prof?.is_married || false,
          has_children: prof?.has_children || false,
        });
        setUploads(ups);
      })
      .catch(err => setError(err.message));
  }, [userId]);

  const handleSave = async () => {
    setSaving(true); setError(null); setSuccess(null);
    try {
      await updateProfile(userId, form);
      setProfile(prev => ({ ...prev, ...form }));
      setSuccess("Profile updated.");
      setEditing(false);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  const initials = (profile?.full_name || session?.user?.email || "?")
    .split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  const dateRange = transactions.length > 0 ? (() => {
    const dates = transactions.map(t => t.date).filter(Boolean).sort((a, b) => a - b);
    return `${dates[0].toLocaleDateString("en-GB", { month: "short", year: "numeric" })} – ${dates[dates.length - 1].toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`;
  })() : null;

  return (
    <div className="space-y-6">
      {/* Account overview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-indigo-600 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
            {initials}
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900">{profile?.full_name || "—"}</p>
            <p className="text-sm text-gray-500">{session?.user?.email}</p>
            {profile?.created_at && (
              <p className="text-xs text-gray-400 mt-0.5">
                Member since {new Date(profile.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Transactions", value: transactions.length.toLocaleString() },
            { label: "Payslips", value: payslips.length.toLocaleString() },
            { label: "CSV Imports", value: uploads.length.toLocaleString() },
            { label: "Date Range", value: dateRange || "—" },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className="text-sm font-semibold text-gray-900">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Personal details */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Personal Details</h3>
          {!editing
            ? <button onClick={() => setEditing(true)} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
            : <div className="flex gap-2">
                <button onClick={() => { setEditing(false); setSuccess(null); setError(null); }} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="text-sm bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
              </div>
          }
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Full Name</label>
              {editing
                ? <input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                : <p className="text-sm text-gray-900">{profile?.full_name || "—"}</p>
              }
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Email</label>
              <p className="text-sm text-gray-900">{session?.user?.email}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Employer</label>
              {editing
                ? <input value={form.employer_name} onChange={e => setForm(p => ({ ...p, employer_name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. Acme Ltd" />
                : <p className="text-sm text-gray-900">{profile?.employer_name || "—"}</p>
              }
            </div>
          </div>

          <div className="flex gap-6">
            {[
              { key: "is_married", label: "Married / Civil Partnership" },
              { key: "has_children", label: "Has Children" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.checked }))}
                  disabled={!editing}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-60"
                />
                <span className={`text-sm ${editing ? "text-gray-700" : "text-gray-500"}`}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm"><AlertCircle size={14}/> {error}</div>}
        {success && <div className="mt-4 flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg text-sm"><CheckCircle size={14}/> {success}</div>}
      </div>

      {/* Import history */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Import History</h3>
        {uploads.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No CSV files imported yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-500">File</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Bank</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Type</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Imported</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Transactions</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map(u => (
                  <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 px-3 text-gray-800 font-medium max-w-[200px] truncate">{u.file_name}</td>
                    <td className="py-2.5 px-3 text-gray-700 whitespace-nowrap">{u.bank_name || <span className="text-gray-400 italic">Unknown</span>}</td>
                    <td className="py-2.5 px-3">
                      {u.account_type
                        ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.account_type === "credit" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}>
                            {u.account_type === "credit" ? "Credit" : "Debit"}
                          </span>
                        : <span className="text-gray-400 text-xs italic">—</span>
                      }
                    </td>
                    <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">
                      {new Date(u.uploaded_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      <span className="text-gray-400 text-xs ml-1">
                        {new Date(u.uploaded_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-700 font-medium">{(u.row_count || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────

const TABS = [
  { id: "transactions", label: "Transactions", icon: CreditCard },
  { id: "payslips", label: "Payslips", icon: FileText },
  { id: "analysis", label: "Analysis", icon: TrendingUp },
  { id: "hmrc", label: "HMRC Schemes", icon: Landmark },
  { id: "profile", label: "Profile", icon: User },
];

// ─────────────────────────────────────────────
// AUTH COMPONENT
// ─────────────────────────────────────────────

function AuthPage({ onAuth }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null); setMessage(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        setMessage("Check your email for a confirmation link.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleGoogleAuth = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setError(error.message);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="bg-indigo-600 rounded-xl p-3 inline-block mb-4">
            <PoundSterling className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">UK Finance Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">Bank transactions · Payslips · HMRC tax schemes</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{mode === "login" ? "Sign In" : "Create Account"}</h2>

          {/* Google OAuth */}
          <button onClick={handleGoogleAuth} className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-4">
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center text-xs"><span className="px-2 bg-white text-gray-400">or</span></div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-3">
            {mode === "signup" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-2.5 text-gray-400" />
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Your name" required />
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-2.5 text-gray-400" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="you@example.com" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-2.5 text-gray-400" />
                <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="w-full border border-gray-300 rounded-lg pl-9 pr-9 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Min 6 characters" required minLength={6} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
              {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          {error && <div className="mt-3 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm"><AlertCircle size={16}/> {error}</div>}
          {message && <div className="mt-3 flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg text-sm"><CheckCircle size={16}/> {message}</div>}

          <p className="mt-4 text-center text-sm text-gray-500">
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); setMessage(null); }} className="text-indigo-600 font-medium hover:text-indigo-800">
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN APP (with auth wrapper)
// ─────────────────────────────────────────────

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("transactions");
  const [transactions, setTransactions] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [filterBank, setFilterBank] = useState("all");
  const [filterAccountType, setFilterAccountType] = useState("all");

  const uniqueBanks = useMemo(() =>
    [...new Set(transactions.map(t => t.bank_name).filter(Boolean))].sort()
  , [transactions]);

  const filteredTransactions = useMemo(() =>
    transactions.filter(t => {
      if (filterBank !== "all" && t.bank_name !== filterBank) return false;
      if (filterAccountType !== "all" && t.account_type !== filterAccountType) return false;
      return true;
    })
  , [transactions, filterBank, filterAccountType]);

  // Listen for auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load data from Supabase when user logs in
  useEffect(() => {
    if (!session?.user || dataLoaded) return;
    const loadData = async () => {
      try {
        const [txns, slips] = await Promise.all([
          loadTransactionsFromDB(session.user.id),
          loadPayslipsFromDB(session.user.id),
        ]);
        setTransactions(txns);
        setPayslips(slips);
        setDataLoaded(true);
      } catch (err) {
        console.error("Failed to load data:", err);
      }
    };
    loadData();
  }, [session, dataLoaded]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setTransactions([]);
    setPayslips([]);
    setDataLoaded(false);
  };

  // Wrap setTransactions to also save to DB
  const setTransactionsWithDB = useCallback(async (updater) => {
    setTransactions(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-indigo-600 rounded-xl p-3 inline-block mb-4 animate-pulse">
            <PoundSterling className="text-white" size={32} />
          </div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) return <AuthPage />;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 rounded-lg p-2">
                <PoundSterling className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">UK Finance Tracker</h1>
                <p className="text-xs text-gray-500">Bank transactions · Payslips · HMRC tax schemes</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{session.user.email}</span>
              <button onClick={handleSignOut} className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-600 transition-colors">
                <LogOut size={16}/> Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                  {tab.id === "transactions" && transactions.length > 0 && (
                    <span className="bg-indigo-100 text-indigo-700 text-xs px-1.5 py-0.5 rounded-full">{transactions.length}</span>
                  )}
                  {tab.id === "payslips" && payslips.length > 0 && (
                    <span className="bg-indigo-100 text-indigo-700 text-xs px-1.5 py-0.5 rounded-full">{payslips.length}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Filter bar — shown on transactions & analysis tabs when data exists */}
      {transactions.length > 0 && (activeTab === "transactions" || activeTab === "analysis") && (
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 py-2 flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Filter</span>

            {/* Bank filter */}
            <select
              value={filterBank}
              onChange={e => setFilterBank(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1 text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            >
              <option value="all">All Banks</option>
              {uniqueBanks.map(b => <option key={b} value={b}>{b}</option>)}
              {transactions.some(t => !t.bank_name) && <option value="">Unknown</option>}
            </select>

            {/* Account type filter */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {[["all","All"],["debit","Debit"],["credit","Credit"]].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFilterAccountType(val)}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    filterAccountType === val
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Active filter summary */}
            {(filterBank !== "all" || filterAccountType !== "all") && (
              <span className="text-xs text-indigo-600 font-medium">
                {filteredTransactions.length.toLocaleString()} of {transactions.length.toLocaleString()} transactions
              </span>
            )}

            {/* Reset */}
            {(filterBank !== "all" || filterAccountType !== "all") && (
              <button
                onClick={() => { setFilterBank("all"); setFilterAccountType("all"); }}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === "transactions" && <TransactionsTab transactions={filteredTransactions} setTransactions={setTransactions} userId={session.user.id} />}
        {activeTab === "payslips" && <PayslipTab payslips={payslips} setPayslips={setPayslips} transactions={transactions} userId={session.user.id} />}
        {activeTab === "analysis" && <AnalysisTab transactions={filteredTransactions} payslips={payslips} />}
        {activeTab === "hmrc" && <HMRCTab />}
        {activeTab === "profile" && <ProfileTab userId={session.user.id} session={session} transactions={transactions} payslips={payslips} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-8">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center text-xs text-gray-400">
          <p>This tool is for informational purposes only. Always consult a qualified tax adviser for personalised advice.</p>
          <p className="mt-1">Your data is securely stored and encrypted. Only you can access your financial information.</p>
        </div>
      </footer>
    </div>
  );
}