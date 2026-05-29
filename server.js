const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json"
};

// Multi-month Mock Data
const MOCK_MONTHS = ["May '26", "June '26", "April '26"];

const MOCK_BUDGET_DATA = {
  "May '26": {
    sheetName: "May '26",
    utilities: {
      total: 0.00,
      items: [
        { name: "Mortgage", cost: 0.00, paid: false, date: "15th" },
        { name: "NYSEG", cost: 0.00, paid: true, date: "3rd" },
        { name: "T-mobile", cost: 0.00, paid: false, date: "27th" },
        { name: "Water", cost: 0.00, paid: true, date: "2nd" },
        { name: "Trash", cost: 0.00, paid: false, date: "15th" },
        { name: "Empire", cost: 0.00, paid: false, date: "22nd" }
      ]
    },
    entertainment: {
      total: 0.00,
      items: [
        { name: "Xbox", cost: 0.00, paid: false, date: "24th" },
        { name: "Disney+", cost: 0.00, paid: true, date: "11th" },
        { name: "Apple+", cost: 0.00, paid: false, date: "26th" },
        { name: "Hulu", cost: 0.00, paid: true, date: "10th" },
        { name: "HBO", cost: 0.00, paid: true, date: "6th" },
        { name: "Apple - Paramount", cost: 0.00, paid: false, date: "21st" },
        { name: "Apple - iCloud", cost: 0.00, paid: false, date: "28th" },
        { name: "Apple - Snapchat", cost: 0.00, paid: false, date: "26th" },
        { name: "Apple - Watch", cost: 0.00, paid: true, date: "9th" },
        { name: "Peacock", cost: 0.00, paid: true, date: "6th" }
      ]
    },
    debt: {
      total: 0.00,
      items: [
        { name: "Corning CU", cost: 0.00, balance: 0.00, paid: false, date: "25th" },
        { name: "SUV Loan", cost: 0.00, balance: 0.00, paid: true, date: "2nd" }
      ]
    },
    transportation: {
      total: 0.00,
      items: [
        { name: "Insurance", cost: 0.00, paid: false, date: "N/A" }
      ]
    },
    kylesZone: {
      title: "Kyle's monthly bills",
      monthlyBills: 0.00,
      biweeklyBills: 0.00,
      total: 0.00,
      items: [
        { name: "Xbox", cost: 0.00, debt: "-", paid: true, date: "24th" },
        { name: "Amazon Prime", cost: 0.00, debt: "-", paid: false, date: "30th" },
        { name: "Minecraft Realms", cost: 0.00, debt: "-", paid: false, date: "26th" },
        { name: "Runescape", cost: 0.00, debt: "-", paid: false, date: "25th" },
        { name: "Ipad Max - Affirm", cost: 0.00, debt: 0.00, paid: true, date: "2nd" },
        { name: "Washer - Affirm", cost: 0.00, debt: 0.00, paid: true, date: "9th" },
        { name: "Walmart - Affirm", cost: 0.00, debt: 0.00, paid: true, date: "5th" },
        { name: "Target - Affirm", cost: 0.00, debt: 0.00, paid: true, date: "22nd" },
        { name: "Amazon - Affirm", cost: 0.00, debt: 0.00, paid: true, date: "22nd" }
      ]
    },
    otherExpenses: {
      total: 0.00,
      items: [
        { name: "Ferret food", cost: 0.00, when: "X2 month" },
        { name: "Ferret treats", cost: 0.00, when: "X1 month" },
        { name: "Talkiatry", cost: 0.00, when: "X1 month" },
        { name: "Medicine Copays", cost: 0.00, when: "X1 month" }
      ]
    },
    moneyIn: {
      incomeMonthly: { kyle: 0.00, justine: 0.00, total: 0.00 },
      billDepositBiweekly: { kyle: 0.00, justine: 0.00, total: 0.00 },
      incomeBiweekly: { kyle: 0.00, justine: 0.00, total: 0.00 },
      personalCashBiweekly: { kyle: 0.00, justine: 0.00, total: 0.00 }
    }
  },
  "June '26": {
    sheetName: "June '26",
    utilities: {
      total: 0.00,
      items: [
        { name: "Mortgage", cost: 0.00, paid: false, date: "15th" },
        { name: "NYSEG", cost: 0.00, paid: false, date: "3rd" },
        { name: "T-mobile", cost: 0.00, paid: false, date: "27th" },
        { name: "Water", cost: 0.00, paid: true, date: "2nd" },
        { name: "Trash", cost: 0.00, paid: false, date: "15th" },
        { name: "Empire", cost: 0.00, paid: false, date: "22nd" }
      ]
    },
    entertainment: {
      total: 0.00,
      items: [
        { name: "Xbox", cost: 0.00, paid: false, date: "24th" },
        { name: "Disney+", cost: 0.00, paid: false, date: "11th" },
        { name: "Apple+", cost: 0.00, paid: false, date: "26th" },
        { name: "Hulu", cost: 0.00, paid: true, date: "10th" },
        { name: "HBO", cost: 0.00, paid: true, date: "6th" },
        { name: "Peacock", cost: 0.00, paid: true, date: "6th" }
      ]
    },
    debt: {
      total: 0.00,
      items: [
        { name: "Corning CU", cost: 0.00, balance: 0.00, paid: false, date: "25th" },
        { name: "SUV Loan", cost: 0.00, balance: 0.00, paid: false, date: "2nd" }
      ]
    },
    transportation: {
      total: 0.00,
      items: [
        { name: "Insurance", cost: 0.00, paid: false, date: "N/A" }
      ]
    },
    kylesZone: {
      title: "Kyle's monthly bills",
      monthlyBills: 0.00,
      biweeklyBills: 0.00,
      total: 0.00,
      items: [
        { name: "Xbox", cost: 0.00, debt: "-", paid: true, date: "24th" },
        { name: "Amazon Prime", cost: 0.00, debt: "-", paid: false, date: "30th" }
      ]
    },
    otherExpenses: {
      total: 0.00,
      items: [
        { name: "Ferret food", cost: 0.00, when: "X2 month" },
        { name: "Ferret treats", cost: 0.00, when: "X1 month" }
      ]
    },
    moneyIn: {
      incomeMonthly: { kyle: 0.00, justine: 0.00, total: 0.00 },
      billDepositBiweekly: { kyle: 0.00, justine: 0.00, total: 0.00 },
      incomeBiweekly: { kyle: 0.00, justine: 0.00, total: 0.00 },
      personalCashBiweekly: { kyle: 0.00, justine: 0.00, total: 0.00 }
    }
  }
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const action = url.searchParams.get("action");

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Handle Mock API Requests
  if (pathname === "/api/budget-data" || pathname.startsWith("/macros/s/")) {
    if (action === "getSheets") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "success", data: MOCK_MONTHS }));
      return;
    }
    
    if (action === "updatePaid") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "success", updated: true }));
      return;
    }
    
    const activeMonth = url.searchParams.get("sheetName") || "May '26";
    const data = MOCK_BUDGET_DATA[activeMonth] || MOCK_BUDGET_DATA["May '26"];
    
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "success", data: data }));
    return;
  }

  // Serve static files
  let filePath = path.join(__dirname, pathname === "/" ? "index.html" : pathname);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Budget Canvas Dashboard dev server running at: http://localhost:${PORT}`);
});
