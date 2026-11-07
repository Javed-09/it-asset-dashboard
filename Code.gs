/**
 * ============================================================
 *  COMPANY IT ASSET MANAGEMENT DASHBOARD
 *  Backend (Google Apps Script) - Code.gs
 * ------------------------------------------------------------
 *  This single file contains the entire backend:
 *    1. Configuration
 *    2. App entry point (doGet)
 *    3. HTML include helper
 *    4. Spreadsheet / sheet initialisation
 *    5. Authentication & users
 *    6. Activity logging
 *    7. CRUD APIs for: Assets, Branches, Employees,
 *       Stock, Maintenance, Assignments, Transfers
 *    8. Dashboard stats + Reports
 * ============================================================
 */

/* ============================================================
 *  1. CONFIGURATION
 * ============================================================ */

const CONFIG = {
  SHEET_NAME: 'IT_Asset_Manager',
  // Change these to your company details
  COMPANY_NAME: 'RestaurantCo IT',
  CURRENCY: 'AED',
  // Default admin created on first run
  DEFAULT_ADMIN: {
    username: 'admin',
    password: 'admin123',   // CHANGE after first login
    fullName: 'System Administrator',
    role: 'admin',
    email: ''
  }
};

// Sheet (tab) names - do not change after first run
const SHEETS = {
  ASSETS: 'Assets',
  BRANCHES: 'Branches',
  EMPLOYEES: 'Employees',
  STOCK: 'Stock',
  STOCK_MOVEMENTS: 'StockMovements',
  ASSIGNMENTS: 'Assignments',
  TRANSFERS: 'Transfers',
  MAINTENANCE: 'Maintenance',
  USERS: 'Users',
  ACTIVITY_LOG: 'ActivityLog',
  SETTINGS: 'Settings',
  SESSIONS: 'Sessions'
};

/* ============================================================
 *  2. APP ENTRY POINTS (HTML + JSON API)
 * ------------------------------------------------------------
 *  The backend supports TWO ways of being called:
 *
 *  A) HTML mode (embedded) — open the Apps Script URL in a
 *     browser. doGet() with no `action` parameter returns the
 *     HTML page. The page uses google.script.run to call the
 *     backend functions directly.
 *
 *  B) JSON API mode (hosted elsewhere) — a static HTML file
 *     hosted on Netlify/Vercel/etc calls doGet or doPost with
 *     `action` parameter. The backend returns JSON. Auth uses
 *     a session token (stored in Sessions sheet).
 * ============================================================ */

function doGet(e) {
  // First-run auto setup
  const ss = getSpreadsheet_();
  ensureSheetsExist_(ss);

  const p = (e && e.parameter) || {};

  // JSON API mode
  if (p.action) {
    return jsonOut_(handleApi_(p.action, p));
  }

  // HTML mode (serve the page)
  const tpl = HtmlService.createTemplateFromFile('Index');
  tpl.companyName = CONFIG.COMPANY_NAME;
  return tpl.evaluate()
    .setTitle(CONFIG.COMPANY_NAME + ' - IT Asset Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  // First-run auto setup
  const ss = getSpreadsheet_();
  ensureSheetsExist_(ss);

  let body = {};
  try {
    body = JSON.parse(e.postData.contents || '{}');
  } catch (err) {
    body = {};
  }
  if (!body.action) {
    return jsonOut_({ success: false, message: 'Missing action parameter' });
  }
  return jsonOut_(handleApi_(body.action, body));
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
 *  API ROUTER + TOKEN AUTH
 * ============================================================ */

const PUBLIC_ACTIONS_ = ['login', 'setupDatabase', 'getCategories'];

function handleApi_(action, params) {
  try {
    // Auth check (skip for public actions)
    if (PUBLIC_ACTIONS_.indexOf(action) === -1) {
      const token = params.token || '';
      const user = validateToken_(token);
      if (!user) {
        return { success: false, message: 'Unauthorized. Please log in again.' };
      }
      // Inject currentUser into the first object arg (for activity logging)
      const args = params.args || [];
      if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null) {
        if (!args[0].currentUser) args[0].currentUser = user.username;
      }
      params._user = user;
    }
    const args = params.args || [];

    switch (action) {
      case 'login':               return loginWithToken_(args[0], args[1]);
      case 'setupDatabase':       return setupDatabase();
      case 'getSpreadsheetUrl':   return getSpreadsheetUrl();
      case 'getCategories':       return getCategories();
      case 'saveCategories':      return saveCategories(args[0]);
      case 'getAllData':          return getAllData();
      case 'getDashboardStats':   return getDashboardStats();
      case 'listAssets':          return listAssets();
      case 'addAsset':            return addAsset(args[0]);
      case 'updateAsset':         return updateAsset(args[0]);
      case 'deleteAsset':         return deleteAsset(args[0]);
      case 'listBranches':        return listBranches();
      case 'addBranch':           return addBranch(args[0]);
      case 'updateBranch':        return updateBranch(args[0]);
      case 'deleteBranch':        return deleteBranch(args[0]);
      case 'listEmployees':       return listEmployees();
      case 'addEmployee':         return addEmployee(args[0]);
      case 'updateEmployee':      return updateEmployee(args[0]);
      case 'deleteEmployee':      return deleteEmployee(args[0]);
      case 'listAssignments':     return listAssignments();
      case 'assignAsset':         return assignAsset(args[0]);
      case 'returnAsset':         return returnAsset(args[0]);
      case 'listTransfers':       return listTransfers();
      case 'transferAsset':       return transferAsset(args[0]);
      case 'listStock':           return listStock();
      case 'addStockItem':        return addStockItem(args[0]);
      case 'updateStockItem':     return updateStockItem(args[0]);
      case 'deleteStockItem':     return deleteStockItem(args[0]);
      case 'recordStockMovement': return recordStockMovement(args[0]);
      case 'listStockMovements':  return listStockMovements();
      case 'listMaintenance':     return listMaintenance();
      case 'addMaintenance':      return addMaintenance(args[0]);
      case 'updateMaintenance':   return updateMaintenance(args[0]);
      case 'deleteMaintenance':   return deleteMaintenance(args[0]);
      case 'listUsers':           return listUsers();
      case 'addUser':             return addUser(args[0]);
      case 'updateUser':          return updateUser(args[0]);
      case 'deleteUser':          return deleteUser(args[0]);
      case 'listActivityLog':     return listActivityLog();
      case 'getReport':           return getReport(args[0]);
      default: return { success: false, message: 'Unknown action: ' + action };
    }
  } catch (err) {
    return { success: false, message: 'Server error: ' + err.message };
  }
}

/* ============================================================
 *  TOKEN AUTH (Sessions sheet)
 * ============================================================ */

function loginWithToken_(username, password) {
  const r = login(username, password);
  if (!r.success) return r;
  // Generate token
  const token = Utilities.getUuid();
  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const sh = getSheet_(SHEETS.SESSIONS);
  sh.appendRow([token, r.user.userId, r.user.username, now, expires]);
  r.token = token;
  return r;
}

function validateToken_(token) {
  if (!token) return null;
  const sh = getSheet_(SHEETS.SESSIONS);
  const rows = sheetToObjects_(sh);
  const now = new Date();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (String(r.Token) === String(token)) {
      const exp = new Date(r.Expires);
      if (exp > now) {
        // Look up the user fresh
        const ush = getSheet_(SHEETS.USERS);
        const uRowIdx = findRowByCol_(ush, 'Username', r.Username);
        if (uRowIdx !== -1) {
          const u = sheetToObjects_(ush).filter(function (x) { return x.Username === r.Username; })[0];
          if (u) {
            return { userId: u.UserID, username: u.Username, fullName: u.FullName, role: u.Role, email: u.Email };
          }
        }
      } else {
        // Expired - delete
        sh.deleteRow(r._row);
      }
    }
  }
  return null;
}

function logoutToken_(token) {
  if (!token) return { success: true };
  const sh = getSheet_(SHEETS.SESSIONS);
  const rowIdx = findRowByCol_(sh, 'Token', token);
  if (rowIdx !== -1) sh.deleteRow(rowIdx);
  return { success: true };
}

/** Include another HTML file (CSS / JS partials). */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* ============================================================
 *  3. SPREADSHEET HELPERS
 * ============================================================ */

function getSpreadsheet_() {
  let ss;
  try {
    const props = PropertiesService.getScriptProperties();
    let id = props.getProperty('SPREADSHEET_ID');
    if (id) {
      ss = SpreadsheetApp.openById(id);
    } else {
      ss = SpreadsheetApp.getActiveSpreadsheet();
      if (!ss) {
        ss = SpreadsheetApp.create(CONFIG.SHEET_NAME);
      }
      props.setProperty('SPREADSHEET_ID', ss.getId());
    }
  } catch (err) {
    ss = SpreadsheetApp.create(CONFIG.SHEET_NAME);
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  }
  return ss;
}

function getSheet_(name) {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }
  return sh;
}

function sheetToObjects_(sh) {
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  const out = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row.every(function (c) { return c === '' || c === null; })) continue;
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    obj._row = i + 1;
    out.push(obj);
  }
  return out;
}

function findRowByCol_(sh, colName, value) {
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return -1;
  const headers = data[0];
  const colIdx = headers.indexOf(colName);
  if (colIdx === -1) return -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colIdx]) === String(value)) return i + 1;
  }
  return -1;
}

/** Generate sequential IDs like AST-0001 */
function generateId_(prefix, sh, idCol) {
  const lastRow = sh.getLastRow();
  let maxNum = 0;
  if (lastRow > 1) {
    const data = sh.getRange(2, idCol, lastRow - 1, 1).getValues();
    for (let i = 0; i < data.length; i++) {
      const v = String(data[i][0]);
      const m = v.match(/(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
  }
  const next = maxNum + 1;
  return prefix + '-' + ('0000' + next).slice(-4);
}

/* ============================================================
 *  4. SHEET INITIALISATION (auto creates all tabs + headers)
 * ============================================================ */

function ensureSheetsExist_(ss) {
  const defs = getSheetDefinitions_();
  const existing = ss.getSheets().map(function (s) { return s.getName(); });

  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    if (existing.indexOf(d.name) === -1) {
      const sh = ss.insertSheet(d.name);
      sh.getRange(1, 1, 1, d.headers.length).setValues([d.headers])
        .setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
      sh.setFrozenRows(1);
    }
  }

  // Make sure the default admin exists
  ensureDefaultUser_();
  // Make sure default categories/branches are seeded
  ensureSeedData_();
}

function getSheetDefinitions_() {
  return [
    { name: SHEETS.ASSETS, headers: [
      'AssetID','AssetName','Category','Brand','Model','SerialNumber',
      'PurchaseDate','PurchasePrice','WarrantyExpiry','BranchID','BranchName',
      'EmployeeID','EmployeeName','Status','Remarks','CreatedDate','UpdatedDate'
    ]},
    { name: SHEETS.BRANCHES, headers: [
      'BranchID','BranchName','Address','City','Phone','Manager','CreatedDate'
    ]},
    { name: SHEETS.EMPLOYEES, headers: [
      'EmployeeID','EmployeeName','BranchID','BranchName','Designation',
      'Email','Phone','Status','CreatedDate'
    ]},
    { name: SHEETS.STOCK, headers: [
      'ItemID','ItemName','Category','Unit','ReceivedQty','IssuedQty',
      'AvailableQty','MinStock','LastUpdated'
    ]},
    { name: SHEETS.STOCK_MOVEMENTS, headers: [
      'MovementID','ItemID','ItemName','Type','Quantity','Person','Date','Remarks'
    ]},
    { name: SHEETS.ASSIGNMENTS, headers: [
      'AssignmentID','AssetID','AssetName','EmployeeID','EmployeeName',
      'BranchID','BranchName','IssueDate','ReturnDate','Status','Remarks'
    ]},
    { name: SHEETS.TRANSFERS, headers: [
      'TransferID','AssetID','AssetName','FromBranchID','FromBranch',
      'ToBranchID','ToBranch','Reason','TransferDate','ApprovedBy'
    ]},
    { name: SHEETS.MAINTENANCE, headers: [
      'RequestID','AssetID','AssetName','IssueDescription','RequestDate',
      'Status','RepairCost','Vendor','ResolutionDate','ResolutionNotes'
    ]},
    { name: SHEETS.USERS, headers: [
      'UserID','Username','Password','FullName','Role','Email','CreatedDate','LastLogin'
    ]},
    { name: SHEETS.ACTIVITY_LOG, headers: [
      'LogID','Timestamp','Username','Action','Details'
    ]},
    { name: SHEETS.SETTINGS, headers: ['Key','Value'] },
    { name: SHEETS.SESSIONS, headers: ['Token','UserID','Username','CreatedDate','Expires'] }
  ];
}

function ensureDefaultUser_() {
  const sh = getSheet_(SHEETS.USERS);
  if (sh.getLastRow() < 2) {
    sh.appendRow([
      'USR-0001',
      CONFIG.DEFAULT_ADMIN.username,
      CONFIG.DEFAULT_ADMIN.password,
      CONFIG.DEFAULT_ADMIN.fullName,
      CONFIG.DEFAULT_ADMIN.role,
      CONFIG.DEFAULT_ADMIN.email || Session.getActiveUser().getEmail(),
      new Date(),
      ''
    ]);
  }
}

function ensureSeedData_() {
  // Seed default branches if empty
  const bsh = getSheet_(SHEETS.BRANCHES);
  if (bsh.getLastRow() < 2) {
    const branches = [
      ['BR-001','Head Office - Dubai','Sheikh Zayed Road','Dubai','+971-4-000-0001','General Manager'],
      ['BR-002','Downtown Branch','Burj Khalifa St','Dubai','+971-4-000-0002','Branch Manager'],
      ['BR-003','Marina Branch','Dubai Marina','Dubai','+971-4-000-0003','Branch Manager'],
      ['BR-004','JBR Branch','Jumeirah Beach Residence','Dubai','+971-4-000-0004','Branch Manager'],
      ['BR-005','Abu Dhabi Mall','Abu Dhabi Mall','Abu Dhabi','+971-2-000-0001','Branch Manager'],
      ['BR-006','Sharjah City Centre','Al Nahda','Sharjah','+971-6-000-0001','Branch Manager']
    ];
    const now = new Date();
    for (let i = 0; i < branches.length; i++) {
      bsh.appendRow(branches[i].concat([now]));
    }
  }

  // Seed sample categories in settings
  const setSh = getSheet_(SHEETS.SETTINGS);
  const existing = sheetToObjects_(setSh);
  const hasCats = existing.some(function (r) { return r.Key === 'Categories'; });
  if (!hasCats) {
    setSh.appendRow([
      'Categories',
      'Laptop,Desktop,Monitor,Printer,Router,Switch,Access Point,CCTV Camera,NVR,POS Machine,Tablet,IP Phone,NAS,UPS,Accessory'
    ]);
  }
}

/** Manually re-run setup (admin button). */
function setupDatabase() {
  const ss = getSpreadsheet_();
  ensureSheetsExist_(ss);
  return { success: true, message: 'Database initialised successfully.',
           spreadsheetId: ss.getId(),
           spreadsheetUrl: ss.getUrl() };
}

function getSpreadsheetUrl() {
  const ss = getSpreadsheet_();
  return { url: ss.getUrl(), id: ss.getId() };
}

/* ============================================================
 *  5. AUTHENTICATION & USERS
 * ============================================================ */

function login(username, password) {
  const sh = getSheet_(SHEETS.USERS);
  const rowIdx = findRowByCol_(sh, 'Username', username);
  if (rowIdx === -1) {
    return { success: false, message: 'User not found.' };
  }
  const row = sh.getRange(rowIdx, 1, 1, sh.getLastColumn()).getValues()[0];
  const storedPass = row[2];
  if (String(storedPass) !== String(password)) {
    return { success: false, message: 'Incorrect password.' };
  }
  // Update last login
  sh.getRange(rowIdx, 8).setValue(new Date());

  const user = {
    userId: row[0],
    username: row[1],
    fullName: row[3],
    role: row[4],
    email: row[5]
  };
  logActivity_(user.username, 'Login', 'User logged in');
  return { success: true, user: user };
}

function listUsers() {
  const sh = getSheet_(SHEETS.USERS);
  const rows = sheetToObjects_(sh);
  // Strip password
  return rows.map(function (r) {
    return {
      userId: r.UserID, username: r.Username,
      fullName: r.FullName, role: r.Role, email: r.Email,
      createdDate: r.CreatedDate, lastLogin: r.LastLogin
    };
  });
}

function addUser(data) {
  const sh = getSheet_(SHEETS.USERS);
  const exists = findRowByCol_(sh, 'Username', data.username);
  if (exists !== -1) return { success: false, message: 'Username already exists.' };
  const id = generateId_('USR', sh, 1);
  sh.appendRow([id, data.username, data.password, data.fullName,
                data.role || 'staff', data.email || '', new Date(), '']);
  logActivity_(data.currentUser || 'system', 'Add User', 'Added user ' + data.username);
  return { success: true, id: id };
}

function updateUser(data) {
  const sh = getSheet_(SHEETS.USERS);
  const rowIdx = findRowByCol_(sh, 'Username', data.username);
  if (rowIdx === -1) return { success: false, message: 'User not found.' };
  sh.getRange(rowIdx, 3).setValue(data.password);
  sh.getRange(rowIdx, 4).setValue(data.fullName);
  sh.getRange(rowIdx, 5).setValue(data.role);
  sh.getRange(rowIdx, 6).setValue(data.email);
  logActivity_(data.currentUser || 'system', 'Update User', 'Updated ' + data.username);
  return { success: true };
}

function deleteUser(username) {
  const sh = getSheet_(SHEETS.USERS);
  const rowIdx = findRowByCol_(sh, 'Username', username);
  if (rowIdx === -1) return { success: false, message: 'User not found.' };
  if (username === CONFIG.DEFAULT_ADMIN.username) {
    return { success: false, message: 'Cannot delete the primary admin.' };
  }
  sh.deleteRow(rowIdx);
  return { success: true };
}

/* ============================================================
 *  6. ACTIVITY LOG
 * ============================================================ */

function logActivity_(username, action, details) {
  const sh = getSheet_(SHEETS.ACTIVITY_LOG);
  const id = generateId_('LOG', sh, 1);
  sh.appendRow([id, new Date(), username, action, details]);
}

function listActivityLog() {
  const sh = getSheet_(SHEETS.ACTIVITY_LOG);
  const rows = sheetToObjects_(sh);
  rows.reverse();
  return rows.slice(0, 200);
}

/* ============================================================
 *  7. ASSETS API
 * ============================================================ */

function listAssets() {
  return sheetToObjects_(getSheet_(SHEETS.ASSETS));
}

function addAsset(a) {
  const sh = getSheet_(SHEETS.ASSETS);
  const id = generateId_('AST', sh, 1);
  const now = new Date();
  const branchName = a.branchId ? getBranchName_(a.branchId) : '';
  const empName = a.employeeId ? getEmployeeName_(a.employeeId) : '';
  sh.appendRow([
    id, a.assetName, a.category, a.brand, a.model, a.serialNumber,
    a.purchaseDate, a.purchasePrice, a.warrantyExpiry,
    a.branchId, branchName, a.employeeId, empName,
    a.status || 'Available', a.remarks || '', now, now
  ]);
  logActivity_(a.currentUser || 'system', 'Add Asset', id + ' - ' + a.assetName);
  return { success: true, id: id };
}

function updateAsset(a) {
  const sh = getSheet_(SHEETS.ASSETS);
  const rowIdx = findRowByCol_(sh, 'AssetID', a.assetId);
  if (rowIdx === -1) return { success: false, message: 'Asset not found.' };
  const branchName = a.branchId ? getBranchName_(a.branchId) : '';
  const empName = a.employeeId ? getEmployeeName_(a.employeeId) : '';
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const updateMap = {
    'AssetName': a.assetName,
    'Category': a.category,
    'Brand': a.brand,
    'Model': a.model,
    'SerialNumber': a.serialNumber,
    'PurchaseDate': a.purchaseDate,
    'PurchasePrice': a.purchasePrice,
    'WarrantyExpiry': a.warrantyExpiry,
    'BranchID': a.branchId,
    'BranchName': branchName,
    'EmployeeID': a.employeeId,
    'EmployeeName': empName,
    'Status': a.status,
    'Remarks': a.remarks,
    'UpdatedDate': new Date()
  };
  for (let k in updateMap) {
    const col = headers.indexOf(k);
    if (col !== -1) sh.getRange(rowIdx, col + 1).setValue(updateMap[k]);
  }
  logActivity_(a.currentUser || 'system', 'Update Asset', a.assetId);
  return { success: true };
}

function deleteAsset(assetId) {
  const sh = getSheet_(SHEETS.ASSETS);
  const rowIdx = findRowByCol_(sh, 'AssetID', assetId);
  if (rowIdx === -1) return { success: false, message: 'Asset not found.' };
  sh.deleteRow(rowIdx);
  return { success: true };
}

function getAsset(assetId) {
  const sh = getSheet_(SHEETS.ASSETS);
  const rowIdx = findRowByCol_(sh, 'AssetID', assetId);
  if (rowIdx === -1) return null;
  const row = sh.getRange(rowIdx, 1, 1, sh.getLastColumn()).getValues()[0];
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const obj = {};
  for (let i = 0; i < headers.length; i++) obj[headers[i]] = row[i];
  return obj;
}

/* ============================================================
 *  8. BRANCHES
 * ============================================================ */

function listBranches() {
  return sheetToObjects_(getSheet_(SHEETS.BRANCHES));
}

function addBranch(b) {
  const sh = getSheet_(SHEETS.BRANCHES);
  const id = generateId_('BR', sh, 1);
  sh.appendRow([id, b.branchName, b.address, b.city, b.phone, b.manager, new Date()]);
  logActivity_(b.currentUser || 'system', 'Add Branch', b.branchName);
  return { success: true, id: id };
}

function updateBranch(b) {
  const sh = getSheet_(SHEETS.BRANCHES);
  const rowIdx = findRowByCol_(sh, 'BranchID', b.branchId);
  if (rowIdx === -1) return { success: false, message: 'Branch not found.' };
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const map = {'BranchName':b.branchName,'Address':b.address,'City':b.city,
               'Phone':b.phone,'Manager':b.manager};
  for (let k in map) {
    const col = headers.indexOf(k);
    if (col !== -1) sh.getRange(rowIdx, col + 1).setValue(map[k]);
  }
  return { success: true };
}

function deleteBranch(branchId) {
  const sh = getSheet_(SHEETS.BRANCHES);
  const rowIdx = findRowByCol_(sh, 'BranchID', branchId);
  if (rowIdx === -1) return { success: false, message: 'Branch not found.' };
  sh.deleteRow(rowIdx);
  return { success: true };
}

function getBranchName_(branchId) {
  const sh = getSheet_(SHEETS.BRANCHES);
  const rowIdx = findRowByCol_(sh, 'BranchID', branchId);
  if (rowIdx === -1) return '';
  return sh.getRange(rowIdx, 2).getValue();
}

/* ============================================================
 *  9. EMPLOYEES
 * ============================================================ */

function listEmployees() {
  return sheetToObjects_(getSheet_(SHEETS.EMPLOYEES));
}

function addEmployee(e) {
  const sh = getSheet_(SHEETS.EMPLOYEES);
  const id = generateId_('EMP', sh, 1);
  const branchName = e.branchId ? getBranchName_(e.branchId) : '';
  sh.appendRow([id, e.employeeName, e.branchId, branchName, e.designation,
                e.email, e.phone, e.status || 'Active', new Date()]);
  logActivity_(e.currentUser || 'system', 'Add Employee', e.employeeName);
  return { success: true, id: id };
}

function updateEmployee(e) {
  const sh = getSheet_(SHEETS.EMPLOYEES);
  const rowIdx = findRowByCol_(sh, 'EmployeeID', e.employeeId);
  if (rowIdx === -1) return { success: false, message: 'Employee not found.' };
  const branchName = e.branchId ? getBranchName_(e.branchId) : '';
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const map = {'EmployeeName':e.employeeName,'BranchID':e.branchId,
               'BranchName':branchName,'Designation':e.designation,
               'Email':e.email,'Phone':e.phone,'Status':e.status};
  for (let k in map) {
    const col = headers.indexOf(k);
    if (col !== -1) sh.getRange(rowIdx, col + 1).setValue(map[k]);
  }
  return { success: true };
}

function deleteEmployee(empId) {
  const sh = getSheet_(SHEETS.EMPLOYEES);
  const rowIdx = findRowByCol_(sh, 'EmployeeID', empId);
  if (rowIdx === -1) return { success: false, message: 'Employee not found.' };
  sh.deleteRow(rowIdx);
  return { success: true };
}

function getEmployeeName_(empId) {
  const sh = getSheet_(SHEETS.EMPLOYEES);
  const rowIdx = findRowByCol_(sh, 'EmployeeID', empId);
  if (rowIdx === -1) return '';
  return sh.getRange(rowIdx, 2).getValue();
}

/* ============================================================
 *  10. ASSIGNMENTS & TRANSFERS
 * ============================================================ */

function listAssignments() {
  return sheetToObjects_(getSheet_(SHEETS.ASSIGNMENTS));
}

function assignAsset(data) {
  const ash = getSheet_(SHEETS.ASSETS);
  const rowIdx = findRowByCol_(ash, 'AssetID', data.assetId);
  if (rowIdx === -1) return { success: false, message: 'Asset not found.' };
  const asset = sheetToObjects_(ash).filter(function (a) {
    return a.AssetID === data.assetId;
  })[0];

  // Update asset assignment + status
  const empName = getEmployeeName_(data.employeeId);
  const branchName = getBranchName_(data.branchId);
  const headers = ash.getRange(1, 1, 1, ash.getLastColumn()).getValues()[0];
  const map = {'EmployeeID':data.employeeId,'EmployeeName':empName,
               'BranchID':data.branchId,'BranchName':branchName,
               'Status':'Assigned','UpdatedDate':new Date()};
  for (let k in map) {
    const col = headers.indexOf(k);
    if (col !== -1) ash.getRange(rowIdx, col + 1).setValue(map[k]);
  }

  // Add to assignments history
  const sh = getSheet_(SHEETS.ASSIGNMENTS);
  const id = generateId_('ASG', sh, 1);
  sh.appendRow([id, data.assetId, asset.AssetName, data.employeeId, empName,
                data.branchId, branchName, data.issueDate || new Date(),
                '', 'Active', data.remarks || '']);
  logActivity_(data.currentUser || 'system', 'Assign Asset',
               data.assetId + ' -> ' + empName);
  return { success: true, id: id };
}

function returnAsset(data) {
  // Mark assignment row as returned
  const sh = getSheet_(SHEETS.ASSIGNMENTS);
  const rows = sheetToObjects_(sh);
  let targetRow = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].AssetID === data.assetId && rows[i].Status === 'Active') {
      targetRow = rows[i]._row; break;
    }
  }
  if (targetRow !== -1) {
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    sh.getRange(targetRow, headers.indexOf('ReturnDate') + 1).setValue(data.returnDate || new Date());
    sh.getRange(targetRow, headers.indexOf('Status') + 1).setValue('Returned');
    if (data.remarks) sh.getRange(targetRow, headers.indexOf('Remarks') + 1).setValue(data.remarks);
  }

  // Update asset to Available
  const ash = getSheet_(SHEETS.ASSETS);
  const aRowIdx = findRowByCol_(ash, 'AssetID', data.assetId);
  if (aRowIdx !== -1) {
    const headers = ash.getRange(1, 1, 1, ash.getLastColumn()).getValues()[0];
    ash.getRange(aRowIdx, headers.indexOf('Status') + 1).setValue('Available');
    ash.getRange(aRowIdx, headers.indexOf('EmployeeID') + 1).setValue('');
    ash.getRange(aRowIdx, headers.indexOf('EmployeeName') + 1).setValue('');
    ash.getRange(aRowIdx, headers.indexOf('UpdatedDate') + 1).setValue(new Date());
  }
  logActivity_(data.currentUser || 'system', 'Return Asset', data.assetId);
  return { success: true };
}

function listTransfers() {
  return sheetToObjects_(getSheet_(SHEETS.TRANSFERS));
}

function transferAsset(data) {
  const ash = getSheet_(SHEETS.ASSETS);
  const rowIdx = findRowByCol_(ash, 'AssetID', data.assetId);
  if (rowIdx === -1) return { success: false, message: 'Asset not found.' };
  const asset = sheetToObjects_(ash).filter(function (a) {
    return a.AssetID === data.assetId;
  })[0];
  const fromBranch = asset.BranchName || '';
  const fromBranchId = asset.BranchID || '';
  const toBranchName = getBranchName_(data.toBranchId);

  // Update asset branch
  const headers = ash.getRange(1, 1, 1, ash.getLastColumn()).getValues()[0];
  ash.getRange(rowIdx, headers.indexOf('BranchID') + 1).setValue(data.toBranchId);
  ash.getRange(rowIdx, headers.indexOf('BranchName') + 1).setValue(toBranchName);
  ash.getRange(rowIdx, headers.indexOf('UpdatedDate') + 1).setValue(new Date());

  // Add transfer record
  const sh = getSheet_(SHEETS.TRANSFERS);
  const id = generateId_('TRF', sh, 1);
  sh.appendRow([id, data.assetId, asset.AssetName, fromBranchId, fromBranch,
                data.toBranchId, toBranchName, data.reason || '',
                data.transferDate || new Date(), data.approvedBy || '']);
  logActivity_(data.currentUser || 'system', 'Transfer Asset',
               data.assetId + ' from ' + fromBranch + ' to ' + toBranchName);
  return { success: true, id: id };
}

/* ============================================================
 *  11. STOCK (CONSUMABLES)
 * ============================================================ */

function listStock() {
  return sheetToObjects_(getSheet_(SHEETS.STOCK));
}

function addStockItem(s) {
  const sh = getSheet_(SHEETS.STOCK);
  const id = generateId_('ITM', sh, 1);
  sh.appendRow([id, s.itemName, s.category, s.unit || 'pcs',
                0, 0, 0, s.minStock || 5, new Date()]);
  logActivity_(s.currentUser || 'system', 'Add Stock Item', s.itemName);
  return { success: true, id: id };
}

function updateStockItem(s) {
  const sh = getSheet_(SHEETS.STOCK);
  const rowIdx = findRowByCol_(sh, 'ItemID', s.itemId);
  if (rowIdx === -1) return { success: false, message: 'Item not found.' };
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const map = {'ItemName':s.itemName,'Category':s.category,
               'Unit':s.unit,'MinStock':s.minStock};
  for (let k in map) {
    const col = headers.indexOf(k);
    if (col !== -1) sh.getRange(rowIdx, col + 1).setValue(map[k]);
  }
  return { success: true };
}

function deleteStockItem(itemId) {
  const sh = getSheet_(SHEETS.STOCK);
  const rowIdx = findRowByCol_(sh, 'ItemID', itemId);
  if (rowIdx === -1) return { success: false, message: 'Item not found.' };
  sh.deleteRow(rowIdx);
  return { success: true };
}

function recordStockMovement(m) {
  const ssh = getSheet_(SHEETS.STOCK);
  const rowIdx = findRowByCol_(ssh, 'ItemID', m.itemId);
  if (rowIdx === -1) return { success: false, message: 'Item not found.' };
  const itemRow = ssh.getRange(rowIdx, 1, 1, ssh.getLastColumn()).getValues()[0];
  const itemName = itemRow[1];
  let received = Number(itemRow[4]) || 0;
  let issued = Number(itemRow[5]) || 0;
  let available = Number(itemRow[6]) || 0;
  const qty = Number(m.quantity) || 0;
  if (m.type === 'Received') {
    received += qty; available += qty;
  } else {
    if (qty > available) return { success: false, message: 'Not enough stock. Available: ' + available };
    issued += qty; available -= qty;
  }
  const headers = ssh.getRange(1, 1, 1, ssh.getLastColumn()).getValues()[0];
  ssh.getRange(rowIdx, headers.indexOf('ReceivedQty') + 1).setValue(received);
  ssh.getRange(rowIdx, headers.indexOf('IssuedQty') + 1).setValue(issued);
  ssh.getRange(rowIdx, headers.indexOf('AvailableQty') + 1).setValue(available);
  ssh.getRange(rowIdx, headers.indexOf('LastUpdated') + 1).setValue(new Date());

  // Movement record
  const msh = getSheet_(SHEETS.STOCK_MOVEMENTS);
  const id = generateId_('MOV', msh, 1);
  msh.appendRow([id, m.itemId, itemName, m.type, qty, m.person,
                 m.date || new Date(), m.remarks || '']);
  logActivity_(m.currentUser || 'system', 'Stock ' + m.type,
               itemName + ' x' + qty);
  return { success: true, id: id, available: available };
}

function listStockMovements() {
  return sheetToObjects_(getSheet_(SHEETS.STOCK_MOVEMENTS));
}

/* ============================================================
 *  12. MAINTENANCE & WARRANTY
 * ============================================================ */

function listMaintenance() {
  return sheetToObjects_(getSheet_(SHEETS.MAINTENANCE));
}

function addMaintenance(r) {
  const sh = getSheet_(SHEETS.MAINTENANCE);
  const id = generateId_('REP', sh, 1);
  const assetName = getAssetName_(r.assetId);
  sh.appendRow([id, r.assetId, assetName, r.issueDescription,
                r.requestDate || new Date(), r.status || 'Pending',
                r.repairCost || 0, r.vendor || '', '', '']);
  // Optionally mark asset Under Repair / Damaged
  if (r.updateAssetStatus) {
    const ash = getSheet_(SHEETS.ASSETS);
    const aRow = findRowByCol_(ash, 'AssetID', r.assetId);
    if (aRow !== -1) {
      const headers = ash.getRange(1, 1, 1, ash.getLastColumn()).getValues()[0];
      ash.getRange(aRow, headers.indexOf('Status') + 1).setValue(r.status === 'Resolved' ? 'Available' : 'Under Repair');
    }
  }
  logActivity_(r.currentUser || 'system', 'Add Repair Request', id + ' - ' + assetName);
  return { success: true, id: id };
}

function updateMaintenance(r) {
  const sh = getSheet_(SHEETS.MAINTENANCE);
  const rowIdx = findRowByCol_(sh, 'RequestID', r.requestId);
  if (rowIdx === -1) return { success: false, message: 'Record not found.' };
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const map = {
    'IssueDescription': r.issueDescription,
    'Status': r.status,
    'RepairCost': r.repairCost || 0,
    'Vendor': r.vendor,
    'ResolutionDate': r.status === 'Resolved' || r.status === 'Closed' ? (r.resolutionDate || new Date()) : '',
    'ResolutionNotes': r.resolutionNotes
  };
  for (let k in map) {
    const col = headers.indexOf(k);
    if (col !== -1) sh.getRange(rowIdx, col + 1).setValue(map[k]);
  }
  logActivity_(r.currentUser || 'system', 'Update Repair', r.requestId);
  return { success: true };
}

function deleteMaintenance(requestId) {
  const sh = getSheet_(SHEETS.MAINTENANCE);
  const rowIdx = findRowByCol_(sh, 'RequestID', requestId);
  if (rowIdx === -1) return { success: false, message: 'Record not found.' };
  sh.deleteRow(rowIdx);
  return { success: true };
}

function getAssetName_(assetId) {
  const sh = getSheet_(SHEETS.ASSETS);
  const rowIdx = findRowByCol_(sh, 'AssetID', assetId);
  if (rowIdx === -1) return '';
  return sh.getRange(rowIdx, 2).getValue();
}

/* ============================================================
 *  13. DASHBOARD STATS
 * ============================================================ */

function getDashboardStats() {
  const assets = sheetToObjects_(getSheet_(SHEETS.ASSETS));
  const branches = sheetToObjects_(getSheet_(SHEETS.BRANCHES));
  const stock = sheetToObjects_(getSheet_(SHEETS.STOCK));
  const today = new Date();

  const counts = { total: assets.length, assigned: 0, available: 0, repair: 0, damaged: 0, warrantyAlert: 0 };
  const byBranch = {};
  const byCategory = {};

  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    const st = String(a.Status || '');
    if (st === 'Assigned') counts.assigned++;
    if (st === 'Available') counts.available++;
    if (st === 'Under Repair') counts.repair++;
    if (st === 'Damaged') counts.damaged++;
    if (a.WarrantyExpiry) {
      const exp = new Date(a.WarrantyExpiry);
      const days = Math.floor((exp - today) / (1000 * 60 * 60 * 24));
      if (days <= 30) counts.warrantyAlert++;
    }
    const bn = a.BranchName || 'Unassigned';
    byBranch[bn] = (byBranch[bn] || 0) + 1;
    const cat = a.Category || 'Other';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  }

  const lowStock = stock.filter(function (s) {
    return Number(s.AvailableQty) <= Number(s.MinStock);
  }).map(function (s) {
    return { itemName: s.ItemName, available: s.AvailableQty, min: s.MinStock };
  });

  return {
    counts: counts,
    byBranch: byBranch,
    byCategory: byCategory,
    branches: branches.length,
    lowStockItems: lowStock
  };
}

/* ============================================================
 *  14. REPORTS (CSV export data)
 * ============================================================ */

function getReport(type) {
  switch (type) {
    case 'assets': return sheetToObjects_(getSheet_(SHEETS.ASSETS));
    case 'branches': return sheetToObjects_(getSheet_(SHEETS.BRANCHES));
    case 'employees': return sheetToObjects_(getSheet_(SHEETS.EMPLOYEES));
    case 'stock': return sheetToObjects_(getSheet_(SHEETS.STOCK));
    case 'stockMovements': return sheetToObjects_(getSheet_(SHEETS.STOCK_MOVEMENTS));
    case 'maintenance': return sheetToObjects_(getSheet_(SHEETS.MAINTENANCE));
    case 'transfers': return sheetToObjects_(getSheet_(SHEETS.TRANSFERS));
    case 'assignments': return sheetToObjects_(getSheet_(SHEETS.ASSIGNMENTS));
    default: return [];
  }
}

function getAllData() {
  return {
    assets: sheetToObjects_(getSheet_(SHEETS.ASSETS)),
    branches: sheetToObjects_(getSheet_(SHEETS.BRANCHES)),
    employees: sheetToObjects_(getSheet_(SHEETS.EMPLOYEES)),
    stock: sheetToObjects_(getSheet_(SHEETS.STOCK)),
    stockMovements: sheetToObjects_(getSheet_(SHEETS.STOCK_MOVEMENTS)),
    maintenance: sheetToObjects_(getSheet_(SHEETS.MAINTENANCE)),
    transfers: sheetToObjects_(getSheet_(SHEETS.TRANSFERS)),
    assignments: sheetToObjects_(getSheet_(SHEETS.ASSIGNMENTS)),
    users: listUsers(),
    activityLog: listActivityLog()
  };
}

/* ============================================================
 *  15. CATEGORIES
 * ============================================================ */

function getCategories() {
  const setSh = getSheet_(SHEETS.SETTINGS);
  const rows = sheetToObjects_(setSh);
  const cat = rows.filter(function (r) { return r.Key === 'Categories'; })[0];
  if (!cat) {
    return ['Laptop','Desktop','Monitor','Printer','Router','Switch',
            'Access Point','CCTV Camera','NVR','POS Machine','Tablet',
            'IP Phone','NAS','UPS','Accessory'];
  }
  return String(cat.Value).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

function saveCategories(list) {
  const setSh = getSheet_(SHEETS.SETTINGS);
  const rowIdx = findRowByCol_(setSh, 'Key', 'Categories');
  const value = list.join(', ');
  if (rowIdx === -1) {
    setSh.appendRow(['Categories', value]);
  } else {
    setSh.getRange(rowIdx, 2).setValue(value);
  }
  return { success: true };
}

/* ============================================================
 *  END
 * ============================================================
 */
