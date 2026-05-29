/**
 * Google Apps Script for "May Hub" Budget Dashboard Sync (Multi-Month & Write-Back Enabled)
 * 
 * Instructions:
 * 1. Open your Google Sheet.
 * 2. Click "Extensions" > "Apps Script".
 * 3. Replace the entire code with this updated code.
 * 4. Click the "Save" icon (floppy disk).
 * 5. Click "Deploy" > "Manage deployments".
 * 6. Click the pencil icon to edit, change version to "New version", and click "Deploy".
 *    (Make sure it's still configured as "Me" and "Anyone").
 * 7. Enjoy dynamic month selection and direct paid write-backs!
 */

// =========================================================================
// OPTIONAL SECURITY PASSCODE CONFIGURATION
// Add a custom password below to lock down access to your budget.
// If you set a passcode here (e.g. "mySecret123"), you must also enter it
// in your dashboard settings. Leave it as "" to disable passcode protection.
const SECURITY_PASSCODE = "";
// =========================================================================

function doGet(e) {
  try {
    const action = e.parameter.action;
    const passcode = e.parameter.passcode;
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // Check security passcode if configured
    if (SECURITY_PASSCODE !== "") {
      if (passcode !== SECURITY_PASSCODE) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Unauthorized: Invalid passcode" }))
          .setMimeType(ContentService.MimeType.JSON)
          .setHeader("Access-Control-Allow-Origin", "*");
      }
    }
    
    // ACTION 1: Get list of month tabs
    if (action === "getSheets") {
      const allSheets = spreadsheet.getSheets();
      const monthSheets = [];
      const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
      
      allSheets.forEach(sheet => {
        const name = sheet.getName();
        const nameLower = name.toLowerCase();
        
        // Exclude system tabs like "Draft" or names containing "v2"
        if (nameLower.includes("draft") || nameLower.includes("v2") || nameLower.includes("template")) {
          return;
        }
        
        // Match if it looks like a month (e.g. May '26, Dec '25)
        const isMonth = months.some(m => nameLower.includes(m));
        if (isMonth) {
          monthSheets.push(name);
        }
      });
      
      // Fallback: if no month sheets detected, return all sheet names
      if (monthSheets.length === 0) {
        allSheets.forEach(s => monthSheets.push(s.getName()));
      }
      
      return ContentService.createTextOutput(JSON.stringify({ status: "success", data: monthSheets }))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader("Access-Control-Allow-Origin", "*");
    }
    
    // ACTION 2: Write back Paid Checkbox toggles
    if (action === "updatePaid") {
      const sheetName = e.parameter.sheetName || e.parameter.sheet;
      const category = e.parameter.category;
      const itemName = e.parameter.itemName;
      const isPaid = e.parameter.paid === "true";
      
      if (!sheetName || !category || !itemName) {
        throw new Error("Missing update parameters (sheetName, category, or itemName)");
      }
      
      const targetSheet = spreadsheet.getSheetByName(sheetName);
      if (!targetSheet) {
        throw new Error("Sheet not found: " + sheetName);
      }
      
      const updated = updatePaidState(targetSheet, category, itemName, isPaid);
      
      return ContentService.createTextOutput(JSON.stringify({ status: "success", updated: updated }))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader("Access-Control-Allow-Origin", "*");
    }
    
    // ACTION 3: Standard fetch for a specific sheet tab
    const requestedSheetName = e.parameter.sheetName || e.parameter.sheet;
    let activeSheet;
    
    if (requestedSheetName) {
      activeSheet = spreadsheet.getSheetByName(requestedSheetName);
    }
    
    if (!activeSheet) {
      activeSheet = spreadsheet.getActiveSheet();
    }
    
    const data = getBudgetData(activeSheet);
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", data: data }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", "*");
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", "*");
  }
}

function getBudgetData(sheet) {
  const result = {
    sheetName: sheet.getName(),
    utilities: parseTable(sheet, "B", "E", 5, 20),
    entertainment: parseTable(sheet, "G", "J", 5, 20),
    debt: parseTable(sheet, "L", "O", 5, 14),
    transportation: parseTable(sheet, "Q", "T", 5, 14),
    kylesZone: parseKylesZone(sheet, "V", "Z", 5, 20),
    otherExpenses: parseOtherExpenses(sheet, "V", "X", 22, 28),
    moneyIn: parseMoneyIn(sheet, "L", "P", 22, 30)
  };
  
  return result;
}

/**
 * Update the Paid state checkbox inside a sheet
 */
function updatePaidState(sheet, category, itemName, isPaid) {
  let searchCol, checkboxOffset;
  
  switch (category.toLowerCase()) {
    case "utilities":
      searchCol = "B";
      checkboxOffset = 2; // Paid is column D (+2 from B)
      break;
    case "entertainment":
      searchCol = "G";
      checkboxOffset = 2; // Paid is column I (+2 from G)
      break;
    case "debt":
      searchCol = "L";
      checkboxOffset = 3; // Paid is column O (+3 from L)
      break;
    case "transportation":
      searchCol = "Q";
      checkboxOffset = 2; // Paid is column S (+2 from Q)
      break;
    case "kyleszone":
      searchCol = "V";
      checkboxOffset = 3; // Paid is column Y (+3 from V)
      break;
    default:
      throw new Error("Invalid category: " + category);
  }
  
  const searchColIdx = letterToColumn(searchCol);
  // Scan 30 rows in that table
  const range = sheet.getRange(5, searchColIdx, 30, 1);
  const values = range.getValues();
  
  for (let r = 0; r < values.length; r++) {
    const val = String(values[r][0]).trim();
    if (val.toLowerCase() === itemName.toLowerCase()) {
      const sheetRow = 5 + r;
      const checkboxCell = sheet.getRange(sheetRow, searchColIdx + checkboxOffset);
      checkboxCell.setValue(isPaid);
      return true;
    }
  }
  
  throw new Error("Bill item not found in " + category + ": " + itemName);
}

/**
 * Helper to parse a standard grid table
 */
function parseTable(sheet, startCol, endCol, startRow, fallbackEndRow) {
  const startColIdx = letterToColumn(startCol);
  const endColIdx = letterToColumn(endCol);
  const numCols = endColIdx - startColIdx + 1;
  
  const range = sheet.getRange(startRow, startColIdx, 30, numCols);
  const values = range.getValues();
  
  const headers = values[0].map(h => String(h).trim());
  const items = [];
  let total = 0;
  
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const name = String(row[0]).trim();
    if (!name) continue;
    
    if (name.toLowerCase() === "total") {
      total = Number(row[1]) || 0;
      break;
    }
    
    const item = { name: name };
    for (let c = 1; c < numCols; c++) {
      const header = headers[c] ? headers[c].toLowerCase() : `col_${c}`;
      let val = row[c];
      
      if (typeof val === "boolean") {
        item[header] = val;
      } else if (typeof val === "number") {
        item[header] = val;
      } else {
        item[header] = String(val).trim();
      }
    }
    items.push(item);
  }
  
  if (!total) {
    total = items.reduce((sum, item) => {
      const costKey = Object.keys(item).find(k => k.includes("cost") || k.includes("monthly"));
      return sum + (Number(item[costKey]) || 0);
    }, 0);
  }
  
  return { items: items, total: total };
}

/**
 * Parser for Kyle's Zone
 */
function parseKylesZone(sheet, startCol, endCol, startRow, fallbackEndRow) {
  const startColIdx = letterToColumn(startCol);
  const endColIdx = letterToColumn(endCol);
  const numCols = endColIdx - startColIdx + 1;
  
  const titleVal = String(sheet.getRange(startRow, startColIdx).getValue());
  const range = sheet.getRange(startRow + 1, startColIdx, 20, numCols);
  const values = range.getValues();
  
  const headers = values[0].map(h => String(h).trim().toLowerCase());
  const items = [];
  let total = 0;
  
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const name = String(row[0]).trim();
    if (!name) continue;
    
    if (name.toLowerCase() === "total" || name.toLowerCase().includes("other expenses")) {
      break;
    }
    
    const item = { name: name };
    for (let c = 1; c < numCols; c++) {
      const header = headers[c] || `col_${c}`;
      let val = row[c];
      
      if (typeof val === "boolean") {
        item[header] = val;
      } else if (typeof val === "number") {
        item[header] = val;
      } else {
        item[header] = String(val).trim();
      }
    }
    items.push(item);
  }
  
  total = items.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
  
  return {
    title: titleVal,
    monthlyBills: 0.00,
    biweeklyBills: 0.00,
    items: items,
    total: total
  };
}

/**
 * Parser for Other Expenses
 */
function parseOtherExpenses(sheet, startCol, endCol, startRow, fallbackEndRow) {
  const startColIdx = letterToColumn(startCol);
  const endColIdx = letterToColumn(endCol);
  const numCols = endColIdx - startColIdx + 1;
  
  const range = sheet.getRange(startRow + 1, startColIdx, 10, numCols);
  const values = range.getValues();
  
  const headers = values[0].map(h => String(h).trim().toLowerCase());
  const items = [];
  
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const name = String(row[0]).trim();
    if (!name || name.toLowerCase().includes("total")) continue;
    
    const item = {
      name: name,
      cost: Number(row[1]) || 0,
      when: String(row[2]).trim()
    };
    items.push(item);
  }
  
  const total = items.reduce((sum, item) => {
    let multiplier = 1;
    if (item.when.toLowerCase().includes("x2")) multiplier = 2;
    return sum + (item.cost * multiplier);
  }, 0);
  
  return { items: items, total: total };
}

/**
 * Parser for Money In Breakdown
 */
function parseMoneyIn(sheet, startCol, endCol, startRow, fallbackEndRow) {
  const startColIdx = letterToColumn(startCol);
  const endColIdx = letterToColumn(endCol);
  const numCols = endColIdx - startColIdx + 1;
  
  const range = sheet.getRange(startRow, startColIdx, 10, numCols);
  const values = range.getValues();
  
  const incomeMonthly = { kyle: 0.00, justine: 0.00, total: 0.00 };
  const billDepositBiweekly = { kyle: 0.00, justine: 0.00, total: 0.00 }; // Dynamically synced
  const incomeBiweekly = { kyle: 0.00, justine: 0.00, total: 0.00 };
  const personalCashBiweekly = { kyle: 0.00, justine: 0.00, total: 0.00 }; // Dynamically synced
  
  try {
    for (let r = 1; r < values.length; r++) {
      const colL = String(values[r][0]).trim().toLowerCase();
      
      if (colL === "kyle") {
        incomeMonthly.kyle = Number(values[r][1]) || incomeMonthly.kyle;
        billDepositBiweekly.kyle = Number(values[r][3]) || billDepositBiweekly.kyle;
      }
      if (colL === "justine") {
        incomeMonthly.justine = Number(values[r][1]) || incomeMonthly.justine;
        billDepositBiweekly.justine = Number(values[r][3]) || billDepositBiweekly.justine;
      }
      if (colL === "total" && r < 5) {
        incomeMonthly.total = Number(values[r][1]) || incomeMonthly.total;
        billDepositBiweekly.total = Number(values[r][3]) || billDepositBiweekly.total;
      }
      
      if (r === 6) {
        incomeBiweekly.kyle = Number(values[r][1]) || incomeBiweekly.kyle;
        personalCashBiweekly.kyle = Number(values[r][3]) || personalCashBiweekly.kyle;
      }
      if (r === 7) {
        incomeBiweekly.justine = Number(values[r][1]) || incomeBiweekly.justine;
        personalCashBiweekly.justine = Number(values[r][3]) || personalCashBiweekly.justine;
      }
      if (r === 8) {
        incomeBiweekly.total = Number(values[r][1]) || incomeBiweekly.total;
        personalCashBiweekly.total = Number(values[r][3]) || personalCashBiweekly.total;
      }
    }
  } catch (e) {
    // Fall back to defaults
  }
  
  return {
    incomeMonthly: incomeMonthly,
    billDepositBiweekly: billDepositBiweekly,
    incomeBiweekly: incomeBiweekly,
    personalCashBiweekly: personalCashBiweekly
  };
}

function letterToColumn(letter) {
  let column = 0;
  const length = letter.length;
  for (let i = 0; i < length; i++) {
    column += (letter.charCodeAt(i) - 64) * Math.pow(26, length - i - 1);
  }
  return column;
}
