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
      total: 2170.00,
      items: [
        { name: "Mortgage", cost: 1300.00, paid: false, date: "15th" },
        { name: "NYSEG", cost: 400.00, paid: true, date: "3rd" },
        { name: "T-mobile", cost: 250.00, paid: false, date: "27th" },
        { name: "Water", cost: 100.00, paid: true, date: "2nd" },
        { name: "Trash", cost: 50.00, paid: false, date: "15th" },
        { name: "Empire", cost: 70.00, paid: false, date: "22nd" }
      ]
    },
    entertainment: {
      total: 157.99,
      items: [
        { name: "Xbox", cost: 30.00, paid: false, date: "24th" },
        { name: "Disney+", cost: 19.00, paid: true, date: "11th" },
        { name: "Apple+", cost: 28.00, paid: false, date: "26th" },
        { name: "Hulu", cost: 19.00, paid: true, date: "10th" },
        { name: "HBO", cost: 19.00, paid: true, date: "6th" },
        { name: "Apple - Paramount", cost: 13.00, paid: false, date: "21st" },
        { name: "Apple - iCloud", cost: 9.99, paid: false, date: "28th" },
        { name: "Apple - Snapchat", cost: 5.00, paid: false, date: "26th" },
        { name: "Apple - Watch", cost: 4.00, paid: true, date: "9th" },
        { name: "Peacock", cost: 11.00, paid: true, date: "6th" }
      ]
    },
    debt: {
      total: 600.00,
      items: [
        { name: "Corning CU", cost: 100.00, balance: 4950.00, paid: false, date: "25th" },
        { name: "SUV Loan", cost: 500.00, balance: 18000.00, paid: true, date: "2nd" }
      ]
    },
    transportation: {
      total: 90.00,
      items: [
        { name: "Insurance", cost: 90.00, paid: false, date: "N/A" }
      ]
    },
    kylesZone: {
      title: "Kyle's monthly bills: $234.00, BiWeekly bills: $117",
      monthlyBills: 234.00,
      biweeklyBills: 117.00,
      total: 234.00,
      items: [
        { name: "Xbox", cost: 25.00, debt: "-", paid: true, date: "24th" },
        { name: "Amazon Prime", cost: 8.00, debt: "-", paid: false, date: "30th" },
        { name: "Minecraft Realms", cost: 9.00, debt: "-", paid: false, date: "26th" },
        { name: "Runescape", cost: 17.00, debt: "-", paid: false, date: "25th" },
        { name: "Ipad Max - Affirm", cost: 31.00, debt: 306.18, paid: true, date: "2nd" },
        { name: "Washer - Affirm", cost: 58.00, debt: 970.00, paid: true, date: "9th" },
        { name: "Walmart - Affirm", cost: 34.00, debt: 231.36, paid: true, date: "5th" },
        { name: "Target - Affirm", cost: 37.11, debt: 491.20, paid: true, date: "22nd" },
        { name: "Amazon - Affirm", cost: 14.89, debt: 119.07, paid: true, date: "22nd" }
      ]
    },
    otherExpenses: {
      total: 70.00,
      items: [
        { name: "Ferret food", cost: 30.00, when: "X2 month" },
        { name: "Ferret treats", cost: 10.00, when: "X1 month" },
        { name: "Talkiatry", cost: 5.00, when: "X1 month" },
        { name: "Medicine Copays", cost: 15.00, when: "X1 month" }
      ]
    },
    moneyIn: {
      incomeMonthly: { kyle: 3000.00, justine: 1800.00, total: 4800.00 },
      billDepositBiweekly: { kyle: 1202.50, justine: 300.00, total: 1502.50 },
      incomeBiweekly: { kyle: 1500.00, justine: 900.00, total: 2400.00 },
      personalCashBiweekly: { kyle: 180.51, justine: 600.00, total: 780.51 }
    }
  },
  "June '26": {
    sheetName: "June '26",
    utilities: {
      total: 2050.00,
      items: [
        { name: "Mortgage", cost: 1300.00, paid: false, date: "15th" },
        { name: "NYSEG", cost: 280.00, paid: false, date: "3rd" },
        { name: "T-mobile", cost: 250.00, paid: false, date: "27th" },
        { name: "Water", cost: 100.00, paid: true, date: "2nd" },
        { name: "Trash", cost: 50.00, paid: false, date: "15th" },
        { name: "Empire", cost: 70.00, paid: false, date: "22nd" }
      ]
    },
    entertainment: {
      total: 126.00,
      items: [
        { name: "Xbox", cost: 30.00, paid: false, date: "24th" },
        { name: "Disney+", cost: 19.00, paid: false, date: "11th" },
        { name: "Apple+", cost: 28.00, paid: false, date: "26th" },
        { name: "Hulu", cost: 19.00, paid: true, date: "10th" },
        { name: "HBO", cost: 19.00, paid: true, date: "6th" },
        { name: "Peacock", cost: 11.00, paid: true, date: "6th" }
      ]
    },
    debt: {
      total: 600.00,
      items: [
        { name: "Corning CU", cost: 100.00, balance: 4850.00, paid: false, date: "25th" },
        { name: "SUV Loan", cost: 500.00, balance: 17500.00, paid: false, date: "2nd" }
      ]
    },
    transportation: {
      total: 90.00,
      items: [
        { name: "Insurance", cost: 90.00, paid: false, date: "N/A" }
      ]
    },
    kylesZone: {
      title: "Kyle's monthly bills: $234.00, BiWeekly bills: $117",
      monthlyBills: 234.00,
      biweeklyBills: 117.00,
      total: 234.00,
      items: [
        { name: "Xbox", cost: 25.00, debt: "-", paid: true, date: "24th" },
        { name: "Amazon Prime", cost: 8.00, debt: "-", paid: false, date: "30th" }
      ]
    },
    otherExpenses: {
      total: 70.00,
      items: [
        { name: "Ferret food", cost: 30.00, when: "X2 month" },
        { name: "Ferret treats", cost: 10.00, when: "X1 month" }
      ]
    },
    moneyIn: {
      incomeMonthly: { kyle: 3200.00, justine: 2000.00, total: 5200.00 },
      billDepositBiweekly: { kyle: 1133.00, justine: 300.00, total: 1433.00 },
      incomeBiweekly: { kyle: 1600.00, justine: 1000.00, total: 2600.00 },
      personalCashBiweekly: { kyle: 350.00, justine: 700.00, total: 1050.00 }
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
