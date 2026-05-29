// Helper to extract Spreadsheet ID from Google Sheet URL
function getSpreadsheetId(urlOrId) {
  if (!urlOrId) return "";
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : urlOrId;
}

// Application State
let state = {
  budgetData: null,
  connectionMode: "live", // Force always live
  // Baked-in defaults (used when localStorage doesn't contain overrides)
  sheetUrl: localStorage.getItem("budget_sheet_url") || "https://docs.google.com/spreadsheets/d/1t7xcElLKqloriI4eFa-kw7VLzrDHczNvBUeBQ1fI_ME/edit?gid=1298310580",
  googleClientId: localStorage.getItem("budget_google_client_id") || "36220003517-cpohmrn5slh6tpd1pt4h55p0id8bs8c3.apps.googleusercontent.com",
  googleAccessToken: sessionStorage.getItem("budget_google_access_token") || "",
  activeMonth: localStorage.getItem("budget_active_month") || "June '26",
  availableMonths: ["June '26", "May '26", "April '26"],
  activeTab: "overview",
  theme: localStorage.getItem("budget_theme") || "light",
  paidStates: JSON.parse(localStorage.getItem("budget_paid_states")) || {}
};

// DOM Elements
const elements = {
  syncStatus: document.getElementById("sync-status"),
  refreshBtn: document.getElementById("refresh-btn"),
  themeToggle: document.getElementById("theme-toggle"),
  themeSun: document.getElementById("theme-sun"),
  themeMoon: document.getElementById("theme-moon"),
  settingsBtn: document.getElementById("settings-btn"),
  settingsModal: document.getElementById("settings-modal"),
  settingsCloseBtn: document.getElementById("settings-close-btn"),
  settingsCancelBtn: document.getElementById("settings-cancel-btn"),
  settingsSaveBtn: document.getElementById("settings-save-btn"),
  sheetUrlInput: document.getElementById("sheet-url"),
  googleClientIdInput: document.getElementById("google-client-id"),
  googleSignInBtn: document.getElementById("google-signin-btn"),
  googleSignOutBtn: document.getElementById("google-signout-btn"),
  googleAuthStatus: document.getElementById("google-auth-status"),
  
  // Header Month Selector
  monthSelect: document.getElementById("header-month-select"),
  
  // Cards
  cardMonthlyIncome: document.getElementById("card-monthly-income"),
  labelKyleMonthly: document.getElementById("label-kyle-monthly"),
  labelJustineMonthly: document.getElementById("label-justine-monthly"),
  cardBiweeklyDeposit: document.getElementById("card-biweekly-deposit"),
  cardPocketCash: document.getElementById("card-pocket-cash"),
  cardSafetySurplus: document.getElementById("card-safety-surplus"),
  
  // Deposit Logic
  logicW12Income: document.getElementById("logic-w12-income"),
  logicW12Deposit: document.getElementById("logic-w12-deposit"),
  logicW12Pocket: document.getElementById("logic-w12-pocket"),
  logicW34Income: document.getElementById("logic-w34-income"),
  logicW34Deposit: document.getElementById("logic-w34-deposit"),
  logicW34Pocket: document.getElementById("logic-w34-pocket"),
  
  // Tabs
  tabOverview: document.getElementById("tab-overview"),
  tabLedger: document.getElementById("tab-ledger"),
  tabMyZone: document.getElementById("tab-myzone"),
  viewOverview: document.getElementById("view-overview"),
  viewLedger: document.getElementById("view-ledger"),
  viewMyZone: document.getElementById("view-myzone"),
  
  // Ledger
  ledgerSearch: document.getElementById("ledger-search"),
  ledgerCategoryFilter: document.getElementById("ledger-category-filter"),
  ledgerTbody: document.getElementById("ledger-tbody"),
  
  // My Zone
  myzoneTotal: document.getElementById("myzone-total"),
  myzoneBiweekly: document.getElementById("myzone-biweekly"),
  myzoneOtherTotal: document.getElementById("myzone-other-total"),
  myzoneBillsTbody: document.getElementById("myzone-bills-tbody"),
  upcomingBillsList: document.getElementById("upcoming-bills-list"),
  
  footerSyncTime: document.getElementById("footer-sync-time")
};

// Initialize Application
function init() {
  // Global Remote Debugging Error Handler (displays exact JS errors in the Sync badge!)
  window.onerror = function(msg, url, line) {
    if (elements.syncStatus) {
      elements.syncStatus.innerText = `JS Err: ${msg} (L${line})`;
      elements.syncStatus.className = "text-[10px] font-bold uppercase tracking-wider text-brand-red";
    }
    return false;
  };
  window.onunhandledrejection = function(event) {
    if (elements.syncStatus) {
      elements.syncStatus.innerText = `Promise: ${event.reason}`;
      elements.syncStatus.className = "text-[10px] font-bold uppercase tracking-wider text-brand-red";
    }
  };

  setupTheme();
  setupEventListeners();
  loadSettingsUI();
  
  // Trigger initial list load and data load (with automatic silent token refresh on page load!)
  if (state.googleClientId && !state.googleAccessToken) {
    requestGoogleAuthToken(true);
  } else {
    loadMonthsDropdown().then(() => {
      fetchData();
    });
  }
}

// Setup Theme
function setupTheme() {
  if (state.theme === "dark") {
    document.documentElement.classList.add("dark");
    elements.themeSun.classList.remove("hidden");
    elements.themeMoon.classList.add("hidden");
  } else {
    document.documentElement.classList.remove("dark");
    elements.themeSun.classList.add("hidden");
    elements.themeMoon.classList.remove("hidden");
  }
}

// Toggle Theme
function toggleTheme() {
  state.theme = state.theme === "light" ? "dark" : "light";
  localStorage.setItem("budget_theme", state.theme);
  setupTheme();
}

// Tab Switching
function switchTab(tabId) {
  state.activeTab = tabId;
  
  const tabs = [
    { btn: elements.tabOverview, view: elements.viewOverview },
    { btn: elements.tabLedger, view: elements.viewLedger },
    { btn: elements.tabMyZone, view: elements.viewMyZone }
  ];
  
  tabs.forEach(t => {
    t.view.classList.add("hidden");
    t.btn.classList.remove("bg-white", "text-brand-primary", "shadow-sm", "dark:bg-slate-700", "dark:text-white");
    t.btn.classList.add("text-slate-500", "hover:text-slate-700", "dark:text-slate-400", "dark:hover:text-slate-200");
  });
  
  const activeTabObj = tabs.find(t => t.btn.id === `tab-${tabId}`);
  if (activeTabObj) {
    activeTabObj.view.classList.remove("hidden");
    activeTabObj.btn.classList.add("bg-white", "text-brand-primary", "shadow-sm", "dark:bg-slate-700", "dark:text-white");
    activeTabObj.btn.classList.remove("text-slate-500", "hover:text-slate-700", "dark:text-slate-400", "dark:hover:text-slate-200");
  }

  if (tabId === "ledger") renderLedger();
  else if (tabId === "myzone") renderMyZone();
}


// Populate the Available Month Tabs in Header Dropdown Select
async function loadMonthsDropdown() {
  const spreadsheetId = getSpreadsheetId(state.sheetUrl);
  
  if (spreadsheetId && state.googleAccessToken) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${state.googleAccessToken}` } });
      if (!response.ok) throw new Error();
      const res = await response.json();
      
      const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
      const titles = res.sheets.map(s => s.properties.title);
      
      // Filter tabs matching months (Restricting to April '26 onwards!)
      const monthSheets = titles.filter(t => {
        const nameLower = t.toLowerCase();
        if (nameLower.includes("draft") || nameLower.includes("v2") || nameLower.includes("template")) return false;
        
        // Ensure it matches a known month name and extract month index (0-11)
        const monthsFull = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
        const monthsAbbr = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        
        let monthIndex = -1;
        for (let i = 0; i < 12; i++) {
          if (nameLower.includes(monthsFull[i]) || nameLower.includes(monthsAbbr[i])) {
            monthIndex = i;
            break;
          }
        }
        
        if (monthIndex === -1) return false;
        
        // Extract Year (4-digit like 2026, or 2-digit like 26)
        let year = null;
        const fourDigitMatch = nameLower.match(/20\d{2}/);
        if (fourDigitMatch) {
          year = parseInt(fourDigitMatch[0], 10);
        } else {
          const twoDigitMatch = nameLower.match(/\d{2}/);
          if (twoDigitMatch) {
            year = 2000 + parseInt(twoDigitMatch[0], 10);
          }
        }
        
        // Exclude sheets if year cannot be found, or is prior to 2026
        if (year === null || year < 2026) return false;
        
        // Exclude January, February, March of 2026
        if (year === 2026 && monthIndex < 3) return false;
        
        return true;
      });
      
      state.availableMonths = monthSheets.length > 0 ? monthSheets : titles;
      
      if (!state.availableMonths.includes(state.activeMonth)) {
        state.activeMonth = state.availableMonths[0];
        localStorage.setItem("budget_active_month", state.activeMonth);
      }
    } catch (e) {
      console.log("Failed to fetch monthly sheets from Google API.");
    }
  }
  
  // Render dropdown options
  elements.monthSelect.innerHTML = "";
  state.availableMonths.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.innerText = m;
    if (m === state.activeMonth) opt.selected = true;
    elements.monthSelect.appendChild(opt);
  });
}

// Change Active Month
function changeActiveMonth(monthVal) {
  state.activeMonth = monthVal;
  localStorage.setItem("budget_active_month", monthVal);
  fetchData();
}

// Settings UI Management
function loadSettingsUI() {
  // If this site is running on a public origin (e.g. GitHub Pages), do not
  // pre-fill or expose the Sheet URL / OAuth Client ID in the UI. This prevents
  // accidental leakage if a value was ever committed or persisted in that origin.
  const hostname = window.location && window.location.hostname ? window.location.hostname : "";
  const isPublicHost = hostname.endsWith("github.io") || (hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1" && hostname !== "");

  if (isPublicHost) {
    elements.sheetUrlInput.value = "";
    elements.sheetUrlInput.placeholder = "Hidden on public site";
    elements.sheetUrlInput.disabled = true;

    elements.googleClientIdInput.value = "";
    elements.googleClientIdInput.placeholder = "Hidden on public site";
    elements.googleClientIdInput.disabled = true;
  } else {
    elements.sheetUrlInput.value = state.sheetUrl;
    elements.googleClientIdInput.value = state.googleClientId;
    elements.sheetUrlInput.disabled = false;
    elements.googleClientIdInput.disabled = false;
  }
  
  if (state.googleAccessToken) {
    elements.googleAuthStatus.innerText = "Status: Signed In";
    elements.googleAuthStatus.className = "text-[11px] font-semibold text-brand-green uppercase tracking-wider";
    elements.googleSignInBtn.classList.add("hidden");
    elements.googleSignOutBtn.classList.remove("hidden");
  } else {
    elements.googleAuthStatus.innerText = "Status: Not Signed In";
    elements.googleAuthStatus.className = "text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider";
    elements.googleSignInBtn.classList.remove("hidden");
    elements.googleSignOutBtn.classList.add("hidden");
  }
}

// Setup Event Listeners
function setupEventListeners() {
  elements.themeToggle.addEventListener("click", toggleTheme);
  
  // Refresh Button
  elements.refreshBtn.addEventListener("click", () => {
    elements.refreshBtn.classList.add("animate-spin");
    loadMonthsDropdown().then(() => {
      fetchData().finally(() => {
        setTimeout(() => elements.refreshBtn.classList.remove("animate-spin"), 500);
      });
    });
  });
  
  // Modal controllers
  elements.settingsBtn.addEventListener("click", () => {
    loadSettingsUI();
    elements.settingsModal.classList.remove("hidden");
  });
  
  const closeModal = () => elements.settingsModal.classList.add("hidden");
  elements.settingsCloseBtn.addEventListener("click", closeModal);
  elements.settingsCancelBtn.addEventListener("click", closeModal);
  
  elements.googleSignInBtn.addEventListener("click", () => {
    // Allow sign-in when the input is disabled/hidden on public hosts by
    // falling back to the value already stored in `state` (from localStorage).
    const inputVal = (elements.googleClientIdInput && elements.googleClientIdInput.value) ? elements.googleClientIdInput.value.trim() : "";
    const clientId = inputVal || state.googleClientId || "";
    if (!clientId) {
      alert("⚠️ Please enter your Google OAuth Client ID first!");
      return;
    }
    state.googleClientId = clientId;
    localStorage.setItem("budget_google_client_id", clientId);
    requestGoogleAuthToken();
  });
  
  elements.googleSignOutBtn.addEventListener("click", () => {
    state.googleAccessToken = "";
    sessionStorage.removeItem("budget_google_access_token");
    loadSettingsUI();
    fetchData();
  });
  
  elements.settingsSaveBtn.addEventListener("click", () => {
    // Prevent saving Sheet/OAuth settings from public hosts.
    const hostname = window.location && window.location.hostname ? window.location.hostname : "";
    const isPublicHost = hostname.endsWith("github.io") || (hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1" && hostname !== "");

    if (isPublicHost) {
      alert("⚠️ Settings are disabled on the public site for privacy. Configure locally.");
      closeModal();
      return;
    }

    state.sheetUrl = elements.sheetUrlInput.value.trim();
    state.googleClientId = elements.googleClientIdInput.value.trim();

    localStorage.setItem("budget_sheet_url", state.sheetUrl);
    localStorage.setItem("budget_google_client_id", state.googleClientId);

    closeModal();
    loadMonthsDropdown().then(() => {
      fetchData();
    });
  });

  // Search & Filter
  elements.ledgerSearch.addEventListener("input", renderLedger);
  elements.ledgerCategoryFilter.addEventListener("change", renderLedger);

  // Category select balance group toggle
  const categorySelect = document.getElementById("bill-category");
  const balanceGroup = document.getElementById("bill-balance-group");
  if (categorySelect && balanceGroup) {
    categorySelect.addEventListener("change", (e) => {
      const cat = e.target.value;
      if (cat === "debt" || cat === "kyleszone") {
        balanceGroup.classList.remove("hidden");
      } else {
        balanceGroup.classList.add("hidden");
      }
    });
  }
}

// Fetch Budget Data
async function fetchData() {
  const spreadsheetId = getSpreadsheetId(state.sheetUrl);
  
  if (!spreadsheetId) {
    elements.syncStatus.innerText = "Setup Required";
    elements.syncStatus.className = "text-xs font-semibold uppercase tracking-wider text-amber-500 cursor-pointer hover:underline font-bold";
    elements.syncStatus.title = "Click Settings Cog to enter your Google Sheet URL";
    return;
  }
  
  if (!state.googleAccessToken) {
    elements.syncStatus.innerText = "Authorize Sync";
    elements.syncStatus.className = "text-xs font-semibold uppercase tracking-wider text-amber-500 cursor-pointer hover:underline font-bold";
    elements.syncStatus.title = "Click Settings Cog to authenticate with your Google account";
    return;
  }

  elements.syncStatus.innerText = "Syncing...";
  elements.syncStatus.className = "text-xs font-semibold uppercase tracking-wider text-amber-500 sync-pulse";
  
  try {
    const escapedSheetName = state.activeMonth.replace(/'/g, "''");
    const ranges = [
      `'${escapedSheetName}'!B5:E30`, // Utilities (Expanded to capture row 25 and below!)
      `'${escapedSheetName}'!G5:J30`, // Entertainment (Expanded!)
      `'${escapedSheetName}'!L5:P20`, // Debt (Expanded!)
      `'${escapedSheetName}'!R5:U20`, // Transportation (Corrected columns R to U!)
      `'${escapedSheetName}'!V5:AB30`, // Kyle's Zone (Expanded to AB30 to capture all merged rows!)
      `'${escapedSheetName}'!L22:P30`  // Money In
    ];
    
    const rangeParams = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join("&");
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${rangeParams}`;
    
    const response = await fetch(url, { headers: { 'Authorization': `Bearer ${state.googleAccessToken}` } });
    if (response.status === 401) {
      // Token is expired! Clear it and attempt silent refresh.
      state.googleAccessToken = "";
      sessionStorage.removeItem("budget_google_access_token");
      loadSettingsUI();
      if (state.googleClientId) {
        requestGoogleAuthToken(true);
      }
      return;
    }
    if (!response.ok) throw new Error("Connection failed");
    
    const resData = await response.json();
    
    if (resData.valueRanges && resData.valueRanges.length >= 6) {
      state.budgetData = parseGoogleSheetsData(resData.valueRanges);
      updateDashboardData();
      
      const now = new Date();
      elements.footerSyncTime.innerText = `Last updated: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
      elements.syncStatus.innerText = "Synced Live";
      elements.syncStatus.className = "text-xs font-semibold uppercase tracking-wider text-brand-green";
      return;
    }
    throw new Error("Data extraction failed");
  } catch (error) {
    console.error("Fetch Error:", error);
    elements.syncStatus.innerText = "Sync Error";
    elements.syncStatus.className = "text-xs font-semibold uppercase tracking-wider text-brand-red";
  }
}

function parseGoogleSheetsData(valueRanges) {
  const cleanNumber = (val) => {
    if (typeof val === "number") return val;
    if (!val) return 0;
    const cleaned = String(val).replace(/[^0-9.-]+/g, "");
    const num = Number(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const parseGridTable = (values) => {
    if (!values || values.length === 0) return { items: [], total: 0 };
    const headers = values[1] ? values[1].map(h => String(h).trim().toLowerCase()) : [];
    const items = [];
    let total = 0;
    
    for (let r = 2; r < values.length; r++) {
      const row = values[r];
      if (!row || row.length === 0) continue;
      const name = String(row[0] || "").trim();
      if (!name) continue;
      
      if (name.toLowerCase() === "total") {
        total = cleanNumber(row[1]);
        break;
      }
      
      const item = { name: name };
      for (let c = 1; c < headers.length; c++) {
        const header = headers[c] || `col_${c}`;
        let val = row[c];
        if (val === undefined) val = "";
        
        let normalizedHeader = header;
        if (header.includes("cost") || header.includes("monthly") || header.includes("payment")) {
          normalizedHeader = "cost";
        } else if (header.includes("date") || header === "due") {
          normalizedHeader = "date";
        } else if (header.includes("paid") || header === "true" || header === "false") {
          normalizedHeader = "paid";
        } else if (header.includes("debt") || header.includes("balance")) {
          normalizedHeader = "debt";
        }

        let parsedVal;
        if (val === "TRUE" || val === true || String(val).toUpperCase() === "TRUE") {
          parsedVal = true;
        } else if (val === "FALSE" || val === false || String(val).toUpperCase() === "FALSE") {
          parsedVal = false;
        } else if (normalizedHeader === "cost") {
          parsedVal = cleanNumber(val);
        } else {
          if (val !== "" && !isNaN(val) && String(val).trim() !== "") {
            parsedVal = Number(val);
          } else {
            parsedVal = String(val).trim();
          }
        }
        
        item[normalizedHeader] = parsedVal;
        if (normalizedHeader !== header) {
          item[header] = parsedVal;
        }
      }
      items.push(item);
    }
    
    if (!total) {
      total = items.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
    }
    return { items, total };
  };

  const parseKylesZoneTable = (values) => {
    if (!values || values.length === 0) return { items: [], total: 0, title: "", monthlyBills: 0.00, biweeklyBills: 0.00 };
    const title = String(values[0] ? (values[0][1] || "") : "");
    const headers = values[1] ? values[1].map(h => String(h).trim().toLowerCase()) : [];
    const items = [];
    
    for (let r = 2; r < values.length; r++) {
      const row = values[r];
      if (!row || row.length === 0) continue;
      const name = String(row[1] || "").trim(); // Sourced from Column W (index 1)
      if (!name || name.toLowerCase() === "total" || name.toLowerCase().includes("other expenses")) break;
      
      const item = { name: name };
      for (let c = 1; c < headers.length; c++) {
        const header = headers[c] || `col_${c}`;
        if (!header) continue; // Skip empty columns like column V or X
        let val = row[c];
        if (val === undefined) val = "";
        
        let normalizedHeader = header;
        if (header.includes("cost") || header.includes("monthly") || header.includes("payment")) {
          normalizedHeader = "cost";
        } else if (header.includes("date") || header === "due") {
          normalizedHeader = "date";
        } else if (header.includes("paid")) {
          normalizedHeader = "paid";
        } else if (header.includes("debt") || header.includes("balance")) {
          normalizedHeader = "debt";
        }

        let parsedVal;
        if (val === "TRUE" || val === true || String(val).toUpperCase() === "TRUE") {
          parsedVal = true;
        } else if (val === "FALSE" || val === false || String(val).toUpperCase() === "FALSE") {
          parsedVal = false;
        } else if (normalizedHeader === "cost" || normalizedHeader === "debt") {
          parsedVal = cleanNumber(val);
        } else {
          if (val !== "" && !isNaN(val) && String(val).trim() !== "") {
            parsedVal = Number(val);
          } else {
            parsedVal = String(val).trim();
          }
        }
        
        item[normalizedHeader] = parsedVal;
        if (normalizedHeader !== header) {
          item[header] = parsedVal;
        }
      }
      items.push(item);
    }
    const total = items.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
    return { items, total, title, monthlyBills: 0.00, biweeklyBills: 0.00 };
  };

  const parseOtherExpensesTable = (values) => {
    if (!values || values.length === 0) return { items: [], total: 0 };
    const items = [];
    
    for (let r = 0; r < values.length; r++) {
      const row = values[r];
      if (!row || row.length === 0) continue;
      const name = String(row[1] || "").trim(); // Sourced from Column W (index 1)
      if (!name || name.toLowerCase().includes("total")) continue;
      
      const item = {
        name: name,
        cost: Number(String(row[2] || "").replace(/[^0-9.-]+/g,"")) || 0, // Sourced from Column X (index 2)
        when: String(row[3] || "").trim() // Sourced from Column Y (index 3)
      };
      items.push(item);
    }
    const total = items.reduce((sum, item) => {
      let mult = 1;
      if (item.when.toLowerCase().includes("x2")) mult = 2;
      return sum + (item.cost * mult);
    }, 0);
    return { items, total };
  };

  const parseMoneyInTable = (values) => {
    const incomeMonthly = { kyle: 0.00, justine: 0.00, total: 0.00 };
    const billDepositBiweekly = { kyle: 0.00, justine: 0.00, total: 0.00 };
    const incomeBiweekly = { kyle: 0.00, justine: 0.00, total: 0.00 };
    const personalCashBiweekly = { kyle: 0.00, justine: 0.00, total: 0.00 };
    
    if (values && values.length > 0) {
      try {
        console.log("DEBUG: parseMoneyInTable raw values:", JSON.stringify(values));
        for (let r = 1; r < values.length; r++) {
          const row = values[r];
          if (!row || row.length === 0) continue;
          const colL = String(row[0] || "").trim().toLowerCase();
          console.log(`DEBUG: Row ${r}: colL="${colL}", full row:`, row);
          if (colL === "kyle" && r < 5) {
            incomeMonthly.kyle = Number(String(row[1] || "").replace(/[^0-9.-]+/g,"")) || incomeMonthly.kyle;
            billDepositBiweekly.kyle = Number(String(row[3] || "").replace(/[^0-9.-]+/g,"")) || billDepositBiweekly.kyle;
            console.log(`DEBUG: Kyle row - incomeMonthly=${incomeMonthly.kyle}, billDepositBiweekly=${billDepositBiweekly.kyle}`);
          }
          if (colL === "justine" && r < 5) {
            incomeMonthly.justine = Number(String(row[1] || "").replace(/[^0-9.-]+/g,"")) || incomeMonthly.justine;
            billDepositBiweekly.justine = Number(String(row[3] || "").replace(/[^0-9.-]+/g,"")) || billDepositBiweekly.justine;
            console.log(`DEBUG: Justine row - incomeMonthly=${incomeMonthly.justine}, billDepositBiweekly=${billDepositBiweekly.justine}`);
          }
          if (colL === "total" && r < 5) {
            incomeMonthly.total = Number(String(row[1] || "").replace(/[^0-9.-]+/g,"")) || incomeMonthly.total;
            billDepositBiweekly.total = Number(String(row[3] || "").replace(/[^0-9.-]+/g,"")) || billDepositBiweekly.total;
            console.log(`DEBUG: Total row - incomeMonthly=${incomeMonthly.total}, billDepositBiweekly=${billDepositBiweekly.total}`);
          }
          if (r === 5) {
            incomeBiweekly.kyle = Number(String(row[0] || "").replace(/[^0-9.-]+/g,"")) || incomeBiweekly.kyle;
            personalCashBiweekly.kyle = Number(String(row[2] || "").replace(/[^0-9.-]+/g,"")) || personalCashBiweekly.kyle;
          }
          if (r === 6) {
            incomeBiweekly.justine = Number(String(row[0] || "").replace(/[^0-9.-]+/g,"")) || incomeBiweekly.justine;
            personalCashBiweekly.justine = Number(String(row[2] || "").replace(/[^0-9.-]+/g,"")) || personalCashBiweekly.justine;
          }
          if (r === 7) {
            incomeBiweekly.total = Number(String(row[1] || "").replace(/[^0-9.-]+/g,"")) || incomeBiweekly.total;
            personalCashBiweekly.total = Number(String(row[3] || "").replace(/[^0-9.-]+/g,"")) || personalCashBiweekly.total;
          }
        }
      } catch (e) {
        console.error("ERROR in parseMoneyInTable:", e);
      }
    }
    console.log("DEBUG: Final parseMoneyInTable result:", { incomeMonthly, billDepositBiweekly, incomeBiweekly, personalCashBiweekly });
    return { incomeMonthly, billDepositBiweekly, incomeBiweekly, personalCashBiweekly };
  };

  const moneyInData = parseMoneyInTable(valueRanges[5] ? valueRanges[5].values : null);
  console.log("DEBUG: Money In Table Raw Values:", valueRanges[5] ? valueRanges[5].values : null);
  console.log("DEBUG: Parsed Money In Data:", moneyInData);
  
  return {
    sheetName: state.activeMonth,
    utilities: parseGridTable(valueRanges[0] ? valueRanges[0].values : null),
    entertainment: parseGridTable(valueRanges[1] ? valueRanges[1].values : null),
    debt: parseGridTable(valueRanges[2] ? valueRanges[2].values : null),
    transportation: parseGridTable(valueRanges[3] ? valueRanges[3].values : null),
    kylesZone: parseKylesZoneTable(valueRanges[4] ? valueRanges[4].values : null),
    otherExpenses: { items: [], total: 0 }, // Merged into kylesZone
    moneyIn: moneyInData
  };
}

// Request Token implicit flow from GIS
function requestGoogleAuthToken(silent = false) {
  if (typeof google === "undefined" || !google.accounts || !google.accounts.oauth2) {
    // SDK not loaded yet. Retry in 300ms
    setTimeout(() => requestGoogleAuthToken(silent), 300);
    return;
  }

  try {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: state.googleClientId,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      prompt: silent ? '' : 'consent',
      callback: (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
          state.googleAccessToken = tokenResponse.access_token;
          sessionStorage.setItem("budget_google_access_token", tokenResponse.access_token);
          loadSettingsUI();
          loadMonthsDropdown().then(() => {
            fetchData();
          });
        }
      },
      error_callback: (err) => {
        console.error("Google Auth Error:", err);
        const errorMsg = err?.error || String(err) || "Unknown error";
        if (elements.syncStatus) {
          elements.syncStatus.innerText = `Auth Error: ${errorMsg}`;
          elements.syncStatus.className = "text-[10px] font-bold uppercase tracking-wider text-brand-red cursor-help";
          elements.syncStatus.title = `Full error: ${JSON.stringify(err)}`;
        }
        if (!silent) {
          alert(`⚠️ Google Auth Failed: ${errorMsg}\n\nIf you see "origin_mismatch", add your GitHub Pages origin to Google Cloud Console OAuth client authorized origins.`);
        }
      }
    });
    tokenClient.requestAccessToken({ prompt: silent ? '' : 'consent' });
  } catch (e) {
    console.error("GIS load failed:", e);
    if (!silent) {
      alert("⚠️ Failed to load Google Sign-In SDK. Make sure your network connects to google.com!");
    }
  }
}

// Recalculate Core Formulas & Update UI
function updateDashboardData() {
  if (!state.budgetData) return;
  
  const d = state.budgetData;

  const utilitiesTotal = calculateCategorySum(d.utilities.items);
  const entertainmentTotal = calculateCategorySum(d.entertainment.items);
  const debtTotal = calculateCategorySum(d.debt.items);
  const transportationTotal = calculateCategorySum(d.transportation.items);
  
  const totalBills = utilitiesTotal + entertainmentTotal + debtTotal + transportationTotal;
  
  const biweeklyDeposit = d.moneyIn.billDepositBiweekly.total || (totalBills / 2);
  
  const monthlyIncome = d.moneyIn.incomeMonthly.total;
  const kyleMonthly = d.moneyIn.incomeMonthly.kyle;
  const justineMonthly = d.moneyIn.incomeMonthly.justine;
  
  const kyleZoneMonthly = d.kylesZone.total || 279.00;
  const kylePersonalExpenses = kyleZoneMonthly;
  
  const safetySurplus = monthlyIncome - (biweeklyDeposit * 2) - kylePersonalExpenses;
  
  const weeks12PocketCash = d.moneyIn.personalCashBiweekly.kyle;
  const weeks34PocketCash = d.moneyIn.personalCashBiweekly.justine;
  
  // Render Summary Cards
  elements.cardMonthlyIncome.innerText = formatCurrency(monthlyIncome);
  elements.labelKyleMonthly.innerText = formatCurrency(kyleMonthly);
  elements.labelJustineMonthly.innerText = formatCurrency(justineMonthly);
  
  elements.cardBiweeklyDeposit.innerText = formatCurrencyPrecise(biweeklyDeposit);
  const kyleBiweeklyDepositVal = d.moneyIn.billDepositBiweekly.kyle || 0;
  const justineBiweeklyDepositVal = d.moneyIn.billDepositBiweekly.justine || 0;
  if (document.getElementById("label-kyle-biweekly-deposit")) {
    document.getElementById("label-kyle-biweekly-deposit").innerText = formatCurrency(kyleBiweeklyDepositVal);
  }
  if (document.getElementById("label-justine-biweekly-deposit")) {
    document.getElementById("label-justine-biweekly-deposit").innerText = formatCurrency(justineBiweeklyDepositVal);
  }

  const combinedPocketCash = d.moneyIn.personalCashBiweekly.total || (weeks12PocketCash + weeks34PocketCash);
  elements.cardPocketCash.innerText = formatCurrencyPrecise(combinedPocketCash);
  if (document.getElementById("label-kyle-pocket")) {
    document.getElementById("label-kyle-pocket").innerText = formatCurrencyPrecise(weeks12PocketCash);
  }
  if (document.getElementById("label-justine-pocket")) {
    document.getElementById("label-justine-pocket").innerText = formatCurrencyPrecise(weeks34PocketCash);
  }

  elements.cardSafetySurplus.innerText = formatCurrency(safetySurplus);
  
  // Render Weeks 1-2 & Weeks 3-4 Logic Details (using actual individual deposit contributions)
  elements.logicW12Income.innerText = formatCurrency(d.moneyIn.incomeBiweekly.kyle || 0);
  elements.logicW12Deposit.innerText = `-${formatCurrencyPrecise(kyleBiweeklyDepositVal)}`;
  if (document.getElementById("logic-w12-zone")) {
    const kyleZoneBiweeklyVal = (d.kylesZone.total || 0) / 2;
    document.getElementById("logic-w12-zone").innerText = `-${formatCurrencyPrecise(kyleZoneBiweeklyVal)}`;
  }
  elements.logicW12Pocket.innerText = formatCurrencyPrecise(weeks12PocketCash);
  
  elements.logicW34Income.innerText = formatCurrency(d.moneyIn.incomeBiweekly.justine || 0);
  elements.logicW34Deposit.innerText = `-${formatCurrencyPrecise(justineBiweeklyDepositVal)}`;
  elements.logicW34Pocket.innerText = formatCurrency(weeks34PocketCash);
  
  // Render Spending Profile (Progress Bars)
  renderSpendingProfile(utilitiesTotal, entertainmentTotal, debtTotal, transportationTotal);
  
  // Render Upcoming Unpaid Bills Due Soonest
  if (elements.upcomingBillsList) {
    const standardCategories = ["utilities", "entertainment", "debt", "transportation"];
    const unpaidBills = [];
    
    standardCategories.forEach(cat => {
      const lookupCategory = cat === "kyleszone" ? "kylesZone" : cat;
      const items = d[lookupCategory].items || [];
      items.forEach(item => {
        const paidKey = `${state.activeMonth}:${cat}:${item.name}`;
        const isPaid = state.paidStates[paidKey] !== undefined ? state.paidStates[paidKey] : (item.paid || false);
        if (!isPaid) {
          unpaidBills.push({
            ...item,
            category: cat
          });
        }
      });
    });
    
    // Sort by numerical day of the month (soonest first)
    unpaidBills.sort((a, b) => {
      const numA = Number(String(a.date).replace(/[^0-9]/g, "")) || 99;
      const numB = Number(String(b.date).replace(/[^0-9]/g, "")) || 99;
      return numA - numB;
    });
    
    elements.upcomingBillsList.innerHTML = "";
    const displayList = unpaidBills.slice(0, 4);
    
    displayList.forEach(item => {
      const row = document.createElement("div");
      row.className = "grid grid-cols-12 items-center p-3.5 bg-slate-50/50 dark:bg-slate-800/20 border border-slate-50 dark:border-slate-800/30 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all duration-200";
      
      let badgeColorClass = "bg-slate-400";
      switch(item.category) {
        case "utilities": badgeColorClass = "bg-brand-primary"; break;
        case "entertainment": badgeColorClass = "bg-brand-pink"; break;
        case "debt": badgeColorClass = "bg-brand-red"; break;
        case "transportation": badgeColorClass = "bg-brand-teal"; break;
      }
      
      row.innerHTML = `
        <div class="col-span-6 flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center ${badgeColorClass} text-white font-extrabold text-xs select-none shrink-0">
            ${item.category[0].toUpperCase()}
          </div>
          <div class="text-sm font-extrabold text-slate-800 dark:text-slate-100 truncate">${item.name}</div>
        </div>
        <div class="col-span-3 text-center text-xs font-bold uppercase text-slate-400 dark:text-slate-500">
          Due: ${item.date || "N/A"}
        </div>
        <div class="col-span-3 flex items-center gap-2.5 justify-end">
          <span class="text-sm font-extrabold text-slate-800 dark:text-white">${formatCurrency(item.cost)}</span>
          <button onclick="toggleBillPaid('${item.category}', '${item.name.replace(/'/g, "\\'")}', true, this)" class="p-1.5 bg-brand-green/10 text-brand-green rounded-lg hover:bg-brand-green hover:text-white transition-all duration-200 shrink-0" title="Quick Mark Paid">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </button>
        </div>
      `;
      elements.upcomingBillsList.appendChild(row);
    });
    
    if (displayList.length === 0) {
      elements.upcomingBillsList.innerHTML = `
        <div class="flex-1 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 dark:bg-slate-800/10 border border-slate-50 dark:border-slate-800/20 rounded-2xl h-full min-h-[220px]">
          <div class="w-10 h-10 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </div>
          <div class="text-sm font-extrabold text-slate-800 dark:text-slate-100">All Bills Paid!</div>
          <div class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-0.5">Nice job staying on top of it!</div>
        </div>
      `;
    }
  }
  
  if (state.activeTab === "ledger") renderLedger();
  if (state.activeTab === "myzone") renderMyZone();
  
  // Check if all bills are paid and celebrate!
  checkAndCelebrateAllPaid();
}

// Render Spending Profile as SVG Doughnut Chart
function renderSpendingProfile(utilities, entertainment, debt, transportation) {
  const container = document.getElementById("spending-profile-bars");
  if (!container) return;
  
  const categories = [
    { name: "Utilities", value: utilities, color: "#5d5fef" },
    { name: "Fun", value: entertainment, color: "#ec4899" },
    { name: "Debt", value: debt, color: "#ef4444" },
    { name: "Transportation", value: transportation, color: "#06b6d4" }
  ];
  
  const totalBills = categories.reduce((s, c) => s + c.value, 0) || 1;
  
  const viewSize = 200;
  const strokeWidth = 20;
  const radius = (viewSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = viewSize / 2;
  const cy = viewSize / 2;
  
  // Build segments using stroke-dashoffset positioning
  let consumed = 0;
  const segments = categories.map(cat => {
    const segLen = (cat.value / totalBills) * circumference;
    const offset = circumference - consumed; // dashoffset to position this segment
    consumed += segLen;
    return { ...cat, segLen, offset, pct: cat.value / totalBills };
  });
  
  container.innerHTML = `
    <div class="flex flex-col items-center gap-6 w-full">
      <div class="relative w-full" style="max-width:210px; aspect-ratio:1/1;">
        <svg viewBox="0 0 ${viewSize} ${viewSize}" class="w-full h-full" style="transform:rotate(-90deg)">
          <!-- Background track -->
          <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none"
            stroke="currentColor" stroke-width="${strokeWidth}"
            class="text-slate-100 dark:text-slate-800/60" />
          ${segments.map(seg => `
          <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none"
            stroke="${seg.color}" stroke-width="${strokeWidth}"
            stroke-dasharray="${seg.segLen} ${circumference - seg.segLen}"
            stroke-dashoffset="${seg.offset}"
          />
          `).join("")}
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div class="text-xl font-extrabold text-slate-800 dark:text-white tracking-tight">${formatCurrency(totalBills)}</div>
          <div class="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-0.5">Total</div>
        </div>
      </div>
      
      <div class="flex flex-col gap-3 w-full">
        ${categories.map(cat => {
          const pct = Math.round((cat.value / totalBills) * 100);
          return `
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${cat.color}"></div>
              <span class="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">${cat.name}</span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-sm font-extrabold text-slate-800 dark:text-white">${formatCurrency(cat.value)}</span>
              <span class="text-xs font-bold text-slate-400 dark:text-slate-500 w-8 text-right">${pct}%</span>
            </div>
          </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function updateSortHeadersUI() {
  const columns = ["name", "category", "date", "cost", "paid"];
  columns.forEach(col => {
    const span = document.getElementById(`sort-icon-${col}`);
    if (span) {
      if (state.sortColumn === col) {
        span.innerText = state.sortOrder === "asc" ? " ▲" : " ▼";
        span.className = "text-brand-primary font-extrabold text-[10px]";
      } else {
        span.innerText = "";
        span.className = "";
      }
    }
  });
}

// Render Bill Ledger Tab
function renderLedger() {
  if (!state.budgetData) return;
  
  // Set default sorting if not set
  if (!state.sortColumn) state.sortColumn = "name";
  if (!state.sortOrder) state.sortOrder = "asc";
  
  updateSortHeadersUI();
  
  const d = state.budgetData;
  const searchVal = elements.ledgerSearch.value.toLowerCase().trim();
  const categoryFilter = elements.ledgerCategoryFilter.value;
  
  elements.ledgerTbody.innerHTML = "";
  
  const categories = ["utilities", "entertainment", "debt", "transportation"];
  const allFilteredItems = [];
  
  categories.forEach(cat => {
    if (categoryFilter !== "all" && categoryFilter !== cat) return;
    const lookupCategory = cat === "kyleszone" ? "kylesZone" : cat;
    const items = d[lookupCategory].items || [];
    
    items.forEach(item => {
      if (searchVal && !item.name.toLowerCase().includes(searchVal)) return;
      
      // Lookup paid state
      const paidKey = `${state.activeMonth}:${cat}:${item.name}`;
      const isPaid = state.paidStates[paidKey] !== undefined ? state.paidStates[paidKey] : (item.paid || false);
      
      allFilteredItems.push({
        ...item,
        category: cat,
        paid: isPaid,
        paidKey: paidKey
      });
    });
  });
  
  // Sort items
  allFilteredItems.sort((a, b) => {
    let valA = a[state.sortColumn];
    let valB = b[state.sortColumn];
    
    if (state.sortColumn === "cost") {
      valA = Number(valA) || 0;
      valB = Number(valB) || 0;
    } else if (state.sortColumn === "date") {
      const numA = Number(String(valA).replace(/[^0-9]/g, "")) || 99;
      const numB = Number(String(valB).replace(/[^0-9]/g, "")) || 99;
      valA = numA;
      valB = numB;
    } else if (state.sortColumn === "paid") {
      valA = a.paid ? 1 : 0;
      valB = b.paid ? 1 : 0;
    } else {
      valA = String(valA || "").toLowerCase();
      valB = String(valB || "").toLowerCase();
    }
    
    if (valA < valB) return state.sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return state.sortOrder === "asc" ? 1 : -1;
    return 0;
  });
  
  allFilteredItems.forEach(item => {
    const tr = document.createElement("tr");
    tr.className = "border-b border-slate-50 dark:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all";
    
    const dateLabel = item.date && item.date !== "N/A" ? item.date : "Monthly";
    const cat = item.category;
    
    tr.innerHTML = `
      <td class="p-5 font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
        <span class="w-2.5 h-2.5 rounded-full ${getCategoryDotColor(cat)}"></span>
        ${item.name}
      </td>
      <td class="p-5 capitalize text-xs font-extrabold text-slate-400 dark:text-slate-500">${cat === "entertainment" ? "Fun" : cat}</td>
      <td class="p-5 text-slate-400 dark:text-slate-500 font-semibold">${dateLabel}</td>
      <td class="p-5 font-extrabold text-slate-800 dark:text-white">${formatCurrency(item.cost)}</td>
      <td class="p-5 text-center">
        <div class="flex justify-center">
          <input type="checkbox" class="custom-checkbox h-5 w-5" ${item.paid ? "checked" : ""} onchange="toggleBillPaid('${cat}', '${item.name}', this.checked, this)">
        </div>
      </td>
      <td class="p-5 text-center">
        <div class="flex items-center justify-center gap-3">
          <button onclick="openEditBillModal('${cat}', '${item.name.replace(/'/g, "\\'")}')" class="p-1 text-slate-400 hover:text-brand-primary transition-colors duration-200" title="Edit Bill">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
          </button>
          <button onclick="deleteBill('${cat}', '${item.name.replace(/'/g, "\\'")}')" class="p-1 text-slate-400 hover:text-brand-red transition-colors duration-200" title="Delete Bill">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.34 9m-4.78 0L9 9m12 6a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9.78-6h4.78M9 9h6m-7 0v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9H8Z" />
            </svg>
          </button>
        </div>
      </td>
    `;
    elements.ledgerTbody.appendChild(tr);
  });
  
  if (allFilteredItems.length === 0) {
    elements.ledgerTbody.innerHTML = `
      <tr>
        <td colspan="6" class="p-8 text-center text-slate-400 dark:text-slate-500 font-bold">
          No matching active bills found
        </td>
      </tr>
    `;
  }
}

// Toggle Bill Checkbox Paid States and Save (Direct Write-Back Support)
window.toggleBillPaid = async function(category, itemName, isChecked, checkboxElem) {
  const paidKey = `${state.activeMonth}:${category}:${itemName}`;
  
  if (!state.googleAccessToken) {
    alert("⚠️ You must sign in with Google in settings to authorize changes!");
    if (checkboxElem) checkboxElem.checked = !isChecked;
    return;
  }

  // Show Saving State
  elements.syncStatus.innerText = "Saving Check...";
  elements.syncStatus.className = "text-xs font-semibold uppercase tracking-wider text-amber-500 sync-pulse";
  
  const spreadsheetId = getSpreadsheetId(state.sheetUrl);
  
  try {
    // Calculate exact cell address
    let colLetter, rowOffset;
    const lookupCategory = category === "kyleszone" ? "kylesZone" : category;
    const items = state.budgetData[lookupCategory].items || [];
    const itemIdx = items.findIndex(i => i.name.toLowerCase() === itemName.toLowerCase());
    
    if (itemIdx === -1) throw new Error("Item not found");
    
    switch (category.toLowerCase()) {
      case "utilities":
        colLetter = "D";
        rowOffset = 7; // Title at 5, Headers at 6, item 0 is row 7
        break;
      case "entertainment":
        colLetter = "I";
        rowOffset = 7; // Title at 5, Headers at 6, item 0 is row 7
        break;
      case "debt":
        colLetter = "O";
        rowOffset = 7; // Title at 5, Headers at 6, item 0 is row 7
        break;
      case "transportation":
        colLetter = "T"; // Column T has the Paid checkboxes for Transportation!
        rowOffset = 7; // Title at 5, Headers at 6, item 0 is row 7
        break;
      case "kyleszone":
        colLetter = "AA"; // Writes to Column AA
        rowOffset = 7; // Title at 5, Headers at 6, item 0 is row 7
        break;
      default:
        throw new Error("Invalid category");
    }
    
    const cell = `${colLetter}${rowOffset + itemIdx}`;
    const escapedSheetName = state.activeMonth.replace(/'/g, "''");
    const range = `'${escapedSheetName}'!${cell}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    
    const response = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${state.googleAccessToken}` },
      body: JSON.stringify({
        range: range,
        majorDimension: "ROWS",
        values: [[isChecked]]
      })
    });
    
    if (!response.ok) throw new Error();
    
    // Success
    state.paidStates[paidKey] = isChecked;
    localStorage.setItem("budget_paid_states", JSON.stringify(state.paidStates));
    if (items[itemIdx]) items[itemIdx].paid = isChecked;
    
    elements.syncStatus.innerText = "Synced Live";
    elements.syncStatus.className = "text-xs font-semibold uppercase tracking-wider text-brand-green";
    updateDashboardData();
  } catch (e) {
    console.error("Failed to write checkbox change to Google Sheets!", e);
    if (checkboxElem) checkboxElem.checked = !isChecked;
    
    elements.syncStatus.innerText = "Write Error";
    elements.syncStatus.className = "text-xs font-semibold uppercase tracking-wider text-brand-red";
    alert(`⚠️ Could not write checkmark to Google Sheet! Check your connection or token state.`);
  }
};

// Render My Zone Tab
function renderMyZone() {
  if (!state.budgetData) return;
  
  const d = state.budgetData;
  
  elements.myzoneTotal.innerText = formatCurrency(d.kylesZone.total || 0);
  elements.myzoneBiweekly.innerText = formatCurrency((d.kylesZone.total || 0) / 2);
  elements.myzoneOtherTotal.innerText = formatCurrency(d.otherExpenses.total || 0);
  
  // Kyle's Subscription table
  elements.myzoneBillsTbody.innerHTML = "";
  const kyleItems = d.kylesZone.items || [];
  
  kyleItems.forEach(item => {
    const paidKey = `${state.activeMonth}:kyleszone:${item.name}`;
    const isPaid = state.paidStates[paidKey] !== undefined ? state.paidStates[paidKey] : (item.paid || false);
    
    const tr = document.createElement("tr");
    tr.className = "border-b border-slate-50 dark:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-800/10";
    
    const debtLabel = item.debt && item.debt !== "-" ? formatCurrency(item.debt) : "-";
    const dateLabel = item.date || "N/A";
    
    tr.innerHTML = `
      <td class="py-4 px-2 font-bold text-slate-800 dark:text-slate-100">${item.name}</td>
      <td class="py-4 px-2 text-right font-extrabold text-slate-800 dark:text-white">${formatCurrency(item.cost)}</td>
      <td class="py-4 px-2 text-right text-slate-400 dark:text-slate-500 font-semibold">${debtLabel}</td>
      <td class="py-4 px-2 text-right text-slate-400 dark:text-slate-500 font-semibold">${dateLabel}</td>
      <td class="py-4 px-2 text-center">
        <div class="flex justify-center">
          <input type="checkbox" class="custom-checkbox h-4.5 w-4.5" ${isPaid ? "checked" : ""} onchange="toggleBillPaid('kyleszone', '${item.name}', this.checked, this)">
        </div>
      </td>
      <td class="py-4 px-2 text-center">
        <div class="flex items-center justify-center gap-2">
          <button onclick="openEditBillModal('kyleszone', '${item.name.replace(/'/g, "\\'")}')" class="p-1 text-slate-400 hover:text-brand-primary transition-colors duration-200" title="Edit Bill">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
          </button>
          <button onclick="deleteBill('kyleszone', '${item.name.replace(/'/g, "\\'")}')" class="p-1 text-slate-400 hover:text-brand-red transition-colors duration-200" title="Delete Bill">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.34 9m-4.78 0L9 9m12 6a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9.78-6h4.78M9 9h6m-7 0v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9H8Z" />
            </svg>
          </button>
        </div>
      </td>
    `;
    elements.myzoneBillsTbody.appendChild(tr);
  });
  
}

// Helpers
function calculateCategorySum(items) {
  return items.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
}

function formatCurrency(val) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(val);
}

function formatCurrencyPrecise(val) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

function getCategoryDotColor(cat) {
  switch(cat) {
    case "utilities": return "bg-brand-primary";
    case "entertainment": return "bg-brand-pink";
    case "debt": return "bg-brand-red";
    case "transportation": return "bg-brand-teal";
    default: return "bg-slate-400";
  }
}

// Toggle/Add/Edit/Delete Ledger Management Handlers

window.openAddBillModal = function() {
  document.getElementById("bill-modal-title").innerText = "Add New Bill";
  document.getElementById("bill-form").reset();
  document.getElementById("bill-edit-original-name").value = "";
  document.getElementById("bill-edit-original-category").value = "";
  document.getElementById("bill-category").disabled = false;
  
  // Hide balance group by default when adding a new bill (since category resets to default)
  document.getElementById("bill-balance-group").classList.add("hidden");
  document.getElementById("bill-balance").value = "";
  
  document.getElementById("bill-modal").classList.remove("hidden");
};

window.openAddBillModalForMyZone = function() {
  window.openAddBillModal();
  document.getElementById("bill-modal-title").innerText = "Add New Subscription / Bill";
  document.getElementById("bill-category").value = "kyleszone";
  document.getElementById("bill-category").disabled = true; // Lock category to Kyle's Zone
  document.getElementById("bill-balance-group").classList.remove("hidden"); // Show balance group
  document.getElementById("bill-balance").value = "";
};

window.openEditBillModal = function(category, itemName) {
  const lookupCategory = category === "kyleszone" ? "kylesZone" : category;
  const items = state.budgetData[lookupCategory].items || [];
  const item = items.find(i => i.name.toLowerCase() === itemName.toLowerCase());
  
  if (!item) return;
  
  document.getElementById("bill-modal-title").innerText = "Edit Bill";
  document.getElementById("bill-name").value = item.name;
  document.getElementById("bill-category").value = category;
  document.getElementById("bill-cost").value = item.cost;
  document.getElementById("bill-date").value = item.date || "N/A";
  document.getElementById("bill-paid").checked = item.paid || false;
  
  // Show/populate balance group if category has debt balance column
  const balanceGroup = document.getElementById("bill-balance-group");
  const balanceInput = document.getElementById("bill-balance");
  if (category === "debt" || category === "kyleszone") {
    balanceGroup.classList.remove("hidden");
    balanceInput.value = item.debt !== undefined && item.debt !== "-" ? item.debt : "";
  } else {
    balanceGroup.classList.add("hidden");
    balanceInput.value = "";
  }
  
  document.getElementById("bill-edit-original-name").value = item.name;
  document.getElementById("bill-edit-original-category").value = category;
  document.getElementById("bill-category").disabled = true; // Lock category during edit to prevent grid complications
  
  document.getElementById("bill-modal").classList.remove("hidden");
};

window.closeBillModal = function() {
  document.getElementById("bill-modal").classList.add("hidden");
};

window.deleteBill = async function(category, itemName) {
  if (!confirm(`Are you sure you want to delete "${itemName}"?`)) return;
  
  const lookupCategory = category === "kyleszone" ? "kylesZone" : category;
  const items = state.budgetData[lookupCategory].items || [];
  const idx = items.findIndex(i => i.name.toLowerCase() === itemName.toLowerCase());
  
  if (idx !== -1) {
    items.splice(idx, 1);
    
    // Write back
    await writeCategoryToGoogleSheets(category);
    
    // Re-render
    if (state.activeTab === "ledger") renderLedger();
    if (state.activeTab === "myzone") renderMyZone();
  }
};

window.saveBillFormData = async function(event) {
  event.preventDefault();
  
  const name = document.getElementById("bill-name").value.trim();
  const category = document.getElementById("bill-category").value;
  const cost = Number(document.getElementById("bill-cost").value);
  const date = document.getElementById("bill-date").value.trim();
  const paid = document.getElementById("bill-paid").checked;
  const balance = document.getElementById("bill-balance").value.trim();
  
  const originalName = document.getElementById("bill-edit-original-name").value;
  const originalCategory = document.getElementById("bill-edit-original-category").value;
  
  const lookupCategory = category === "kyleszone" ? "kylesZone" : category;
  const lookupOriginalCategory = originalCategory === "kyleszone" ? "kylesZone" : originalCategory;
  
  const isEditing = originalName !== "";
  
  if (isEditing) {
    // If editing, find and replace in the original category first
    const originalItems = state.budgetData[lookupOriginalCategory].items || [];
    const idx = originalItems.findIndex(i => i.name.toLowerCase() === originalName.toLowerCase());
    
    if (idx !== -1) {
      if (originalCategory === category) {
        // Updating in place
        originalItems[idx] = {
          name,
          cost,
          paid,
          date,
          ...((originalCategory === "kyleszone" || originalCategory === "debt") ? { debt: balance || "-" } : {})
        };
      } else {
        // Moved categories: remove from original, add to new
        originalItems.splice(idx, 1);
        await writeCategoryToGoogleSheets(originalCategory);
        
        const newItems = state.budgetData[lookupCategory].items || [];
        newItems.push({
          name,
          cost,
          paid,
          date,
          ...((category === "kyleszone" || category === "debt") ? { debt: balance || "-" } : {})
        });
      }
    }
  } else {
    // Adding a new bill
    const items = state.budgetData[lookupCategory].items || [];
    items.push({
      name,
      cost,
      paid,
      date,
      ...((category === "kyleszone" || category === "debt") ? { debt: balance || "-" } : {})
    });
  }
  
  closeBillModal();
  
  // Write the updated category back to Google Sheets
  await writeCategoryToGoogleSheets(category);
  
  // Re-render
  if (state.activeTab === "ledger") renderLedger();
  if (state.activeTab === "myzone") renderMyZone();
};

async function writeCategoryToGoogleSheets(category) {
  const spreadsheetId = getSpreadsheetId(state.sheetUrl);
  if (!spreadsheetId || !state.googleAccessToken) {
    alert("⚠️ Authentication credentials or Spreadsheet ID missing!");
    return;
  }
  
  elements.syncStatus.innerText = "Syncing...";
  elements.syncStatus.className = "text-xs font-semibold uppercase tracking-wider text-amber-500 sync-pulse";

  let startColLetter, endColLetter, maxRows;
  
  switch (category.toLowerCase()) {
    case "utilities":
      startColLetter = "B";
      endColLetter = "E";
      maxRows = 24; // Rows 7 to 30 (Expanded to capture row 25 and below!)
      break;
    case "entertainment":
      startColLetter = "G";
      endColLetter = "J";
      maxRows = 24; // Rows 7 to 30 (Expanded!)
      break;
    case "debt":
      startColLetter = "L";
      endColLetter = "P"; // Column P has the Due Dates
      maxRows = 14; // Rows 7 to 20 (Expanded!)
      break;
    case "transportation":
      startColLetter = "R";
      endColLetter = "U"; // Column U has the Dates for Transportation!
      maxRows = 14; // Rows 7 to 20 (Expanded!)
      break;
    case "kyleszone":
      startColLetter = "V";
      endColLetter = "AB"; // Column AB has Due Dates, Column AA has Paid status!
      maxRows = 22; // Rows 7 to 28 (expanded for merged subscriptions + pet supplies + ferret treats!)
      break;
    default:
      throw new Error("Invalid category");
  }
  
  const lookupCategory = category === "kyleszone" ? "kylesZone" : category;
  const items = state.budgetData[lookupCategory].items || [];
  const escapedSheetName = state.activeMonth.replace(/'/g, "''");
  const writeRange = `'${escapedSheetName}'!${startColLetter}7:${endColLetter}${7 + maxRows - 1}`;
  
  // Format as 2D array
  const values = [];
  for (let i = 0; i < maxRows; i++) {
    const item = items[i];
    if (item) {
      if (category.toLowerCase() === "kyleszone") {
        values.push([
          "", // Column V: Spacing
          item.name || "", // Column W: Name
          "", // Column X: Spacing
          item.cost || 0, // Column Y: Cost
          item.debt || "-", // Column Z: Debt
          item.paid !== undefined ? item.paid : false, // Column AA: Paid
          item.date || "N/A" // Column AB: Date
        ]);
      } else if (category.toLowerCase() === "debt") {
        values.push([
          item.name || "",
          item.cost || 0,
          item.debt || 0,
          item.paid !== undefined ? item.paid : false,
          item.date || "N/A"
        ]);
      } else {
        values.push([
          item.name || "",
          item.cost || 0,
          item.paid !== undefined ? item.paid : false,
          item.date || "N/A"
        ]);
      }
    } else {
      // Pad empty row
      if (category.toLowerCase() === "kyleszone") {
        values.push(["", "", "", "", "", "", ""]);
      } else if (category.toLowerCase() === "debt") {
        values.push(["", "", "", "", ""]);
      } else {
        values.push(["", "", "", ""]);
      }
    }
  }
  
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`;
    const response = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${state.googleAccessToken}` },
      body: JSON.stringify({
        range: writeRange,
        majorDimension: "ROWS",
        values: values
      })
    });
    
    if (!response.ok) throw new Error("API call failed");
    
    elements.syncStatus.innerText = "Synced Live";
    elements.syncStatus.className = "text-xs font-semibold uppercase tracking-wider text-brand-green";
    
    const now = new Date();
    elements.footerSyncTime.innerText = `Last updated: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    
    updateDashboardData();
  } catch (err) {
    console.error("Failed to write updated category items to Google Sheet!", err);
    elements.syncStatus.innerText = "Write Error";
    elements.syncStatus.className = "text-xs font-semibold uppercase tracking-wider text-brand-red";
    alert("⚠️ Could not write ledger updates to Google Sheet! Check your connection.");
  }
}

window.toggleLedgerSort = function(colName) {
  if (state.sortColumn === colName) {
    state.sortOrder = state.sortOrder === "asc" ? "desc" : "asc";
  } else {
    state.sortColumn = colName;
    state.sortOrder = "asc";
  }
  localStorage.setItem("budget_ledger_sort_col", state.sortColumn);
  localStorage.setItem("budget_ledger_sort_order", state.sortOrder);
  renderLedger();
};

// Confetti Celebration System
function launchConfetti() {
  // Remove any existing canvas
  const existing = document.getElementById("confetti-canvas");
  if (existing) existing.remove();
  
  const canvas = document.createElement("canvas");
  canvas.id = "confetti-canvas";
  document.body.appendChild(canvas);
  
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  const brandColors = ["#5d5fef", "#ec4899", "#10b981", "#06b6d4", "#ef4444", "#f59e0b", "#8b5cf6"];
  const particles = [];
  const particleCount = 120;
  
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 300,
      y: canvas.height / 2 - 100,
      vx: (Math.random() - 0.5) * 12,
      vy: -(Math.random() * 10 + 4),
      size: Math.random() * 8 + 3,
      color: brandColors[Math.floor(Math.random() * brandColors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      opacity: 1,
      shape: Math.random() > 0.5 ? "rect" : "circle"
    });
  }
  
  let frame = 0;
  const maxFrames = 180; // ~3 seconds at 60fps
  
  function animate() {
    if (frame >= maxFrames) {
      canvas.remove();
      return;
    }
    frame++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    particles.forEach(p => {
      p.x += p.vx;
      p.vy += 0.18; // gravity
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      p.opacity = Math.max(0, 1 - (frame / maxFrames));
      p.vx *= 0.99;
      
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      
      if (p.shape === "rect") {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
    
    requestAnimationFrame(animate);
  }
  
  animate();
}

// Track if confetti was already shown for this session/month combo
let confettiShownKey = "";

function checkAndCelebrateAllPaid() {
  const key = `confetti_${state.activeMonth}`;
  if (confettiShownKey === key) return; // Already celebrated this month
  
  const d = state.budgetData;
  if (!d) return;
  
  const standardCategories = ["utilities", "entertainment", "debt", "transportation"];
  let hasUnpaid = false;
  
  standardCategories.forEach(cat => {
    const lookupCategory = cat === "kyleszone" ? "kylesZone" : cat;
    const items = d[lookupCategory].items || [];
    items.forEach(item => {
      const paidKey = `${state.activeMonth}:${cat}:${item.name}`;
      const isPaid = state.paidStates[paidKey] !== undefined ? state.paidStates[paidKey] : (item.paid || false);
      if (!isPaid) hasUnpaid = true;
    });
  });
  
  if (!hasUnpaid) {
    confettiShownKey = key;
    setTimeout(() => launchConfetti(), 400); // Short delay for UI to update first
  }
}

// Attach active month changer to global scope
window.changeActiveMonth = changeActiveMonth;
window.switchTab = switchTab;

// Start the Dashboard
init();
