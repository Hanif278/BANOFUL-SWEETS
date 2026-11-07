/**
 * =========================================================================
 * 🍯 ${Banoful Sweets}
 * গুগল শিট অ্যাপস স্ক্রিপ্ট (Google Apps Script) অটোমেশন ও ফুল-স্ট্যাক ব্যাকএন্ড
 * =========================================================================
 * 
 * ৭টি স্বয়ংক্রিয় গুগল শিট ট্যাব:
 * ১. Sales_Invoices (বিক্রয় ও ইনভয়েস হিসাব)
 * ২. Product_Entries (পণ্য ক্রয় ও এন্ট্রি লগ - প্রতিবার নতুন পারচেস হিস্ট্রি)
 * ৩. Stock_Inventory (লাইভ স্টক রেজিস্টার - নো ডাবল এন্ট্রি, অটো মার্জ)
 * ৪. Daily_Expenses (প্রতিদিনের খরচের হিসাব - দোকান ভাড়া ও অন্যান্য ব্যয়)
 * ৫. Customer_Dues (কাস্টমার বকেয়া রেজিস্টার)
 * ৬. Due_Payments (বকেয়া আদায় হিস্ট্রি)
 * ৭. Users_Permissions (৫টি ইউজার অ্যাকাউন্ট ও নিরাপত্তা রোল)
 * ৮. Shop_Summary (ড্যাশবোর্ড সামারি ও কোম্পানি সেটিংস)
 * 
 * ৫টি সিকিউর ইউজার রোল:
 * - ১. অ্যাডমিন (Admin) -> পূর্ণ নিয়ন্ত্রণ (Full Access)
 * - ২. সেলসম্যান (Salesman) -> সেল এন্ট্রি POS ও স্টক ভিউ
 * - ৩. ক্যাশিয়ার (Cashier) -> সেলস, বকেয়া কালেকশন ও খরচ
 * - ৪. ম্যানেজার (Manager) -> সেলস, স্টক, খরচ ও রিপোর্টস
 * - ৫. স্টক ইনচার্জ (Stock Keeper) -> নতুন মিষ্টি ও ইনভেন্টরি এন্ট্রি
 * 
 * সেটআপ নির্দেশিকা:
 * ১. গুগল ড্রাইভে একটি নতুন গুগল শিট খুলুন।
 * ২. Extensions -> Apps Script ওপেন করুন।
 * ৩. Code.gs ফাইলে এই সম্পূর্ণ কোড পেস্ট করে Save করুন।
 * ৪. বাম পাশের '+' থেকে 'HTML' নির্বাচন করে নাম দিন 'Index' এবং Index.html কোড পেস্ট করুন।
 * ৫. উপরে 'Deploy' -> 'New deployment' -> 'Web app' (Execute as: Me, Who has access: Anyone) দিয়ে Deploy করুন।
 */

function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  try {
    var initialData = getAllSheetsData();
    template.serverData = JSON.stringify(initialData);
  } catch(err) {
    template.serverData = JSON.stringify({ 
      error: err.toString(), 
      products: [], 
      invoices: [], 
      expenses: [], 
      customers: [], 
      duePayments: [], 
      productEntries: [] 
    });
  }
  return template.evaluate()
    .setTitle('${shopName}')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getSpreadsheet() {
  var ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      try { PropertiesService.getScriptProperties().setProperty('SWEET_SHOP_SSID', ss.getId()); } catch(e){}
      return ss;
    }
  } catch(e) {}
  
  try {
    var storedId = PropertiesService.getScriptProperties().getProperty('SWEET_SHOP_SSID');
    if (storedId) {
      ss = SpreadsheetApp.openById(storedId);
      if (ss) return ss;
    }
  } catch(e) {}
  
  throw new Error("গুগল শিট পাওয়া যায়নি! দয়া করে আপনার গুগল শিটটি ওপেন করে Extensions -> Apps Script এ গিয়ে এই কোডটি পেস্ট করে Deploy করুন।");
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var SECRET = PropertiesService.getScriptProperties().getProperty('API_SECRET');
    if (SECRET && data.secret !== SECRET) throw new Error('Unauthorized');
    var result = { status: 'success' };
    
    if (action === 'INITIALIZE_SHEETS') {
      setupSweetShopSheets();
      result.message = '৭টি শিট সফলভাবে প্রস্তুত করা হয়েছে!';
    } else if (action === 'SAVE_SALE') {
      result.invoice = saveSaleInvoice(data.invoice, data.userName || 'ক্যাশিয়ার');
      result.message = 'বিক্রয় ইনভয়েস শিটে সেভ হয়েছে!';
    } else if (action === 'SAVE_PRODUCT') {
      result.data = saveProductRow(data.product, data.userName || 'স্টক ইনচার্জ');
      result.message = result.data.updated ? 'আগের স্টকের সাথে যোগ করা হয়েছে!' : 'নতুন মিষ্টি শিটে যোগ হয়েছে!';
    } else if (action === 'UPDATE_PRODUCT') {
      updateProductInStock(data.product);
      result.message = 'মিষ্টির স্টক সফলভাবে আপডেট হয়েছে!';
    } else if (action === 'UPDATE_INVOICE') {
      updateInvoiceRow(data.invoice);
      result.message = 'ইনভয়েস সফলভাবে আপডেট হয়েছে!';
    } else if (action === 'UPDATE_EXPENSE') {
      updateExpenseRow(data.expense);
      result.message = 'খরচ সফলভাবে আপডেট হয়েছে!';
    } else if (action === 'UPDATE_CUSTOMER') {
      updateCustomerRow(data.customer);
      result.message = 'কাস্টমার তথ্য সফলভাবে আপডেট হয়েছে!';
    } else if (action === 'SAVE_EXPENSE') {
      saveExpenseRow(data.expense, data.userName || 'ক্যাশিয়ার');
      result.message = 'খরচ শিটে রেকর্ড হয়েছে!';
    } else if (action === 'SAVE_DUE_PAYMENT') {
      saveDuePaymentRow(data.payment, data.userName || 'ক্যাশিয়ার');
      result.message = 'বকেয়া কালেকশন আপডেট হয়েছে!';
    } else if (action === 'UPDATE_USER_PIN') {
      updateUserPin(data.userId, data.newPin);
      result.message = 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!';
    } else if (action === 'UPDATE_USER_CREDENTIALS') {
      updateUserCredentials(data.userId, data.name, data.username, data.newPin);
      result.message = 'ইউজারের নাম, আইডি ও পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!';
    } else if (action === 'RPC') {
      // ===== Added for Vercel: lets the website call the same functions =====
      var allowed = ['getAllSheetsData','saveSaleInvoice','saveProductRow','updateProductInStock',
                     'updateInvoiceRow','updateExpenseRow','updateCustomerRow','saveShopSettings',
                     'saveExpenseRow','saveDuePaymentRow','updateUserPin','updateUserCredentials',
                     'clearAllDemoData','setupSweetShopSheets'];
      if (allowed.indexOf(data.method) === -1) throw new Error('Method not allowed: ' + data.method);
      result.data = this[data.method].apply(null, data.args || []);
    } else if (action === 'SAVE_SETTINGS') {
      saveShopSettings(data.settings);
      result.message = 'কোম্পানির নাম ও লোগো আপডেট হয়েছে!';
    } else if (action === 'CLEAR_DEMO_DATA') {
      clearAllDemoData();
      result.message = 'সকল ডেমো ডাটা মুছে ফ্রেশ শিট তৈরি করা হয়েছে!';
    }
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * ৭টি স্বয়ংক্রিয় গুগল শিট ট্যাব তৈরি ও ফরম্যাটিং (সম্পূর্ণ ফ্রেশ — কোনো ডামি ডেটা নেই)
 */
function setupSweetShopSheets() {
  var ss = getSpreadsheet();
  
  // ১. Sales_Invoices (বিক্রয় ও ইনভয়েস শিট)
  var salesSheet = getOrCreateSheet(ss, 'Sales_Invoices');
  setSheetHeaders(salesSheet, [
    'তারিখ ও সময়', 'ইনভয়েস নং', 'কাস্টমার', 'মোবাইল', 'আইটেম বিস্তারিত', 
    'মোট (৳)', 'পরিশোধ (৳)', 'বাকি (৳)', 'মেথড', 'লাভ (৳)', 'ইউজার', 'মন্তব্য', 'আইটেম ডাটা (JSON)'
  ], '#15803d');

  // ২. Product_Entries (পণ্য ক্রয় ও নতুন এন্ট্রি লগ শিট — প্রতিবার নতুন রো)
  var entrySheet = getOrCreateSheet(ss, 'Product_Entries');
  setSheetHeaders(entrySheet, [
    'এন্ট্রি আইডি', 'পারচেস ভাউচার নং', 'তারিখ ও সময়', 'মিষ্টির নাম', 'ক্যাটাগরি', 
    'একক (Unit)', 'পরিমাণ', 'ক্রয় মূল্য (৳)', 'বিক্রয় মূল্য (৳)', 'মোট ক্রয় খরচ (৳)', 
    'সাপ্লায়ার', 'এন্ট্রি করেছেন'
  ], '#0284c7');

  // ৩. Stock_Inventory (লাইভ স্টক রেজিস্টার — নো ডাবল এন্ট্রি, অটো মার্জ)
  var stockSheet = getOrCreateSheet(ss, 'Stock_Inventory');
  setSheetHeaders(stockSheet, [
    'ID', 'মিষ্টির নাম', 'ক্যাটাগরি', 'একক (Unit)', 'বর্তমান স্টক পরিমাণ', 
    'ক্রয় মূল্য (৳)', 'বিক্রয় মূল্য (৳)', 'মোট স্টক ভ্যালু (৳)', 'স্ট্যাটাস', 
    'সাপ্লায়ার', 'সর্বশেষ আপডেট'
  ], '#0f766e');

  // ৪. Daily_Expenses (প্রতিদিনের খরচের হিসাব)
  var expSheet = getOrCreateSheet(ss, 'Daily_Expenses');
  setSheetHeaders(expSheet, [
    'তারিখ', 'ভাউচার আইডি', 'ক্যাটাগরি', 'পরিমাণ (৳)', 'পরিশোধ মেথড', 'বিবরণ / নোট', 'এন্ট্রি করেছেন'
  ], '#b45309');

  // ৫. Customer_Dues (কাস্টমার বকেয়া রেজিস্টার)
  var dueSheet = getOrCreateSheet(ss, 'Customer_Dues');
  setSheetHeaders(dueSheet, [
    'কাস্টমার আইডি', 'নাম', 'মোবাইল', 'ঠিকানা', 'মোট কেনাকাটা (৳)', 'বর্তমান বকেয়া (৳)', 'সর্বশেষ কালেকশন'
  ], '#be123c');

  // ৬. Due_Payments (বকেয়া আদায় হিস্ট্রি)
  var collSheet = getOrCreateSheet(ss, 'Due_Payments');
  setSheetHeaders(collSheet, [
    'কালেকশন আইডি', 'তারিখ', 'কাস্টমার নাম', 'মোবাইল', 'আদায় (৳)', 'মেথড', 'পূর্বের বাকি (৳)', 'বর্তমান বাকি (৳)', 'নোট', 'আদায় করেছেন'
  ], '#6b21a8');

  // ৭. Users_Permissions (৫টি ইউজার আইডি ও পিন)
  var userSheet = getOrCreateSheet(ss, 'Users_Permissions');
  setSheetHeaders(userSheet, [
    'ইউজার আইডি', 'নাম', 'রোল / পদবী', 'ইউজারনেম', 'নিরাপত্তা স্ট্যাটাস', 'অনুমতি সমূহ', 'স্ট্যাটাস', 'সর্বশেষ লগইন', 'পিন'
  ], '#581c87');
  if (userSheet.getLastRow() <= 1) {
    userSheet.appendRow(['USR-01', 'হানিফ ভূঁইয়া (মালিক ও অ্যাডমিন)', '১. অ্যাডমিন (Admin)', 'admin', 'সুরক্ষিত', 'সব সুবিধা (Full Access)', 'active', new Date().toLocaleString(), '1111']);
    userSheet.appendRow(['USR-02', 'রফিকুল ইসলাম (সেলসম্যান)', '২. সেলসম্যান (Salesman)', 'salesman', 'সুরক্ষিত', 'শুধুমাত্র সেলস (POS) ও স্টক', 'active', '', '2222']);
    userSheet.appendRow(['USR-03', 'তানভীর আহমেদ (ক্যাশিয়ার)', '৩. ক্যাশিয়ার (Cashier)', 'cashier', 'সুরক্ষিত', 'সেলস, ডিউ কালেকশন ও খরচ', 'active', '', '3333']);
    userSheet.appendRow(['USR-04', 'জসিম উদ্দিন (দোকান ম্যানেজার)', '৪. ম্যানেজার (Manager)', 'manager', 'সুরক্ষিত', 'সেলস, স্টক, খরচ ও রিপোর্টস', 'active', '', '4444']);
    userSheet.appendRow(['USR-05', 'শাহ আলম (স্টক ইনচার্জ)', '৫. স্টক এন্ট্রি যে করবে', 'stock', 'সুরক্ষিত', 'নতুন প্রোডাক্ট এন্ট্রি ও স্টক ইনভেন্টরি', 'active', '', '5555']);
  }

  // ৮. Shop_Summary (ড্যাশবোর্ড সামারি ও কোম্পানি তথ্য)
  var sumSheet = getOrCreateSheet(ss, 'Shop_Summary');
  setSheetHeaders(sumSheet, ['মেট্রিক নাম', 'মান / পরিমাণ', 'বিবরণ'], '#0f766e');
  if (sumSheet.getLastRow() <= 1) {
    sumSheet.appendRow(['দোকানের নাম', '${shopName}', 'কোম্পানি পূর্ণ নাম']);
    sumSheet.appendRow(['মোট বিক্রয়', '৳ 0', 'সর্বমোট বিক্রি হিসাব']);
    sumSheet.appendRow(['মোট নগদ আদায়', '৳ 0', 'ক্যাশ ও ডিজিটাল আদায়']);
    sumSheet.appendRow(['মোট বকেয়া (Due)', '৳ 0', 'বর্তমান কাস্টমার বাকি']);
    sumSheet.appendRow(['নিট প্রফিট', '৳ 0', 'মোট অর্জিত লাভ']);
  }
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function setSheetHeaders(sheet, headers, bgColor) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground(bgColor);
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  headerRange.setFontSize(10);
  sheet.setFrozenRows(1);
}

/**
 * মিষ্টির প্রোডাক্ট এন্ট্রি ও স্টক আপডেট (ডাবল এন্ট্রি রোধ ফাংশন)
 */
function saveProductRow(p, userName) {
  var ss = getSpreadsheet();
  
  var buyPrice = Number(p.purchasePrice || p.cost || 0);
  var sellPrice = Number(p.salePrice || p.price || 0);
  var qty = Number(p.stockQty || p.quantity || 0);
  var entryUnit = String(p.unit || 'kg').trim().toLowerCase();
  var sweetName = String(p.name || '').trim();
  
  // ১. সর্বদা Product_Entries শিটে প্রতিটি পারচেস রেকর্ড করুন
  var entrySheet = getOrCreateSheet(ss, 'Product_Entries');
  var entryId = p.entryId || ('PE-' + String(entrySheet.getLastRow()));
  var purNo = p.purchaseNo || ('PUR-' + Date.now().toString().slice(-4));
  var entryRow = [
    entryId,
    purNo,
    p.date || new Date().toLocaleString(),
    sweetName,
    p.category || 'সাধারণ মিষ্টি',
    p.unit || 'kg',
    qty,
    buyPrice,
    sellPrice,
    (qty * buyPrice),
    p.supplier || 'নিজস্ব কারখানা',
    userName || 'স্টক ইনচার্জ'
  ];
  entrySheet.appendRow(entryRow);

  // ২. Stock_Inventory শিটে ডাবল এন্ট্রি চেক করুন
  var stockSheet = getOrCreateSheet(ss, 'Stock_Inventory');
  var stockData = stockSheet.getDataRange().getValues();
  var targetRow = -1;
  var existingQty = 0;
  var searchName = sweetName.toLowerCase();

  for (var i = 1; i < stockData.length; i++) {
    var rowName = String(stockData[i][1]).trim().toLowerCase();
    var rowUnit = String(stockData[i][3]).trim().toLowerCase();
    var rowBuy = Number(stockData[i][5]);
    var rowSell = Number(stockData[i][6]);

    if (rowName === searchName && (rowSell === sellPrice || (rowSell === sellPrice && rowBuy === buyPrice))) {
      targetRow = i + 1;
      existingQty = Number(stockData[i][4]) || 0;
      break;
    }
  }

  if (targetRow > -1) {
    var updatedQty = existingQty + qty;
    stockSheet.getRange(targetRow, 5).setValue(updatedQty);
    stockSheet.getRange(targetRow, 8).setValue(updatedQty * buyPrice);
    stockSheet.getRange(targetRow, 9).setValue(updatedQty > 5 ? 'ইন-স্টক (In Stock)' : 'লো-স্টক (Low Stock)');
    stockSheet.getRange(targetRow, 11).setValue(new Date().toLocaleString());
    return { updated: true, name: sweetName, previousStock: existingQty, newStock: updatedQty, unit: p.unit };
  } else {
    var newPId = p.id || ('P00' + stockSheet.getLastRow());
    var newStockRow = [
      newPId,
      sweetName,
      p.category || 'সাধারণ মিষ্টি',
      p.unit || 'kg',
      qty,
      buyPrice,
      sellPrice,
      (qty * buyPrice),
      qty > 5 ? 'ইন-স্টক (In Stock)' : 'লো-স্টক (Low Stock)',
      p.supplier || 'নিজস্ব কারখানা',
      new Date().toLocaleString()
    ];
    stockSheet.appendRow(newStockRow);
    return { updated: false, name: sweetName, stock: qty, unit: p.unit };
  }
}

function updateProductInStock(p) {
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(ss, 'Stock_Inventory');
  var data = sheet.getDataRange().getValues();
  var pId = String(p.id).trim().toLowerCase();
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === pId) {
      var row = i + 1;
      sheet.getRange(row, 2).setValue(p.name);
      sheet.getRange(row, 3).setValue(p.category);
      sheet.getRange(row, 4).setValue(p.unit);
      sheet.getRange(row, 5).setValue(Number(p.stockQty || p.stock || 0));
      sheet.getRange(row, 6).setValue(Number(p.purchasePrice || p.cost || 0));
      sheet.getRange(row, 7).setValue(Number(p.salePrice || p.price || 0));
      sheet.getRange(row, 8).setValue(Number(p.stockQty || p.stock || 0) * Number(p.purchasePrice || p.cost || 0));
      sheet.getRange(row, 9).setValue(Number(p.stockQty || p.stock || 0) > 5 ? 'ইন-স্টক' : 'লো-স্টক');
      sheet.getRange(row, 10).setValue(p.supplier || '');
      sheet.getRange(row, 11).setValue(new Date().toLocaleString());
      break;
    }
  }
}

function updateInvoiceRow(inv) {
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(ss, 'Sales_Invoices');
  var data = sheet.getDataRange().getValues();
  var invId = String(inv.id).trim().toLowerCase();
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim().toLowerCase() === invId) {
      var row = i + 1;
      sheet.getRange(row, 3).setValue(inv.customerName);
      sheet.getRange(row, 4).setValue(inv.customerPhone);
      sheet.getRange(row, 6).setValue(inv.grandTotal);
      sheet.getRange(row, 7).setValue(inv.paidAmount);
      sheet.getRange(row, 8).setValue(inv.dueAmount);
      sheet.getRange(row, 9).setValue(inv.paymentMethod);
      sheet.getRange(row, 12).setValue(inv.remarks || '');
      if (inv.items && inv.items.length > 0) {
        var itemsStr = inv.items.map(function(i) {
          return i.productName + ' (' + i.quantity + (i.unit || '') + ' @ ৳' + i.rate + ')';
        }).join(', ');
        sheet.getRange(row, 5).setValue(itemsStr);
        sheet.getRange(row, 13).setValue(JSON.stringify(inv.items));
      }
      break;
    }
  }
  updateShopSummarySheet();
}

function updateExpenseRow(exp) {
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(ss, 'Daily_Expenses');
  var data = sheet.getDataRange().getValues();
  var expId = String(exp.id).trim().toLowerCase();
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim().toLowerCase() === expId) {
      var row = i + 1;
      sheet.getRange(row, 3).setValue(exp.category);
      sheet.getRange(row, 4).setValue(exp.amount);
      sheet.getRange(row, 5).setValue(exp.paymentMethod);
      sheet.getRange(row, 6).setValue(exp.note || '');
      break;
    }
  }
  updateShopSummarySheet();
}

function updateCustomerRow(cust) {
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(ss, 'Customer_Dues');
  var data = sheet.getDataRange().getValues();
  var cId = String(cust.id).trim().toLowerCase();
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === cId) {
      var row = i + 1;
      sheet.getRange(row, 2).setValue(cust.name);
      sheet.getRange(row, 3).setValue(cust.phone);
      sheet.getRange(row, 4).setValue(cust.address || '');
      sheet.getRange(row, 6).setValue(cust.totalDue);
      break;
    }
  }
  updateShopSummarySheet();
}

function saveShopSettings(st) {
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(ss, 'Shop_Summary');
  if (st && st.shopName) {
    sheet.getRange(2, 2).setValue(st.shopName);
  }
  // Full branding (name, LOGO, tagline, phone, address) is kept permanently in the 'App_Settings' sheet.
  // Long text (logo image) is split across cells because one cell holds max 50,000 characters.
  if (st) {
    var keep = {
      shopName: st.shopName || '',
      shopLogo: st.shopLogo || '',
      shopTagline: st.shopTagline || '',
      phone: st.phone || '',
      address: st.address || ''
    };
    var json = JSON.stringify(keep);
    var cfg = getOrCreateSheet(ss, 'App_Settings');
    cfg.getRange(1, 1).setValue('Shop settings (auto-saved by software - do not edit)');
    var last = cfg.getLastRow();
    if (last > 1) cfg.getRange(2, 1, last - 1, 1).clearContent();
    var CH = 40000, rows = [];
    for (var i = 0; i < json.length; i += CH) rows.push([json.substring(i, i + CH)]);
    cfg.getRange(2, 1, rows.length, 1).setNumberFormat('@').setValues(rows);
  }
}

function saveSaleInvoice(inv, userName) {
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(ss, 'Sales_Invoices');
  var itemsStr = (inv.items || []).map(function(i) {
    return i.productName + ' (' + i.quantity + (i.unit || '') + ' @ ৳' + i.rate + ')';
  }).join(', ');
  
  sheet.appendRow([
    inv.date || new Date().toLocaleString(),
    inv.id,
    inv.customerName || inv.customer || 'ক্যাশ খদ্দের',
    inv.customerPhone || inv.phone || 'N/A',
    itemsStr,
    inv.grandTotal || inv.total || 0,
    inv.paidAmount || inv.paid || 0,
    inv.dueAmount || inv.due || 0,
    inv.paymentMethod || 'Cash',
    inv.totalProfit || 0,
    userName || 'ক্যাশিয়ার',
    inv.remarks || '',
    JSON.stringify(inv.items || [])
  ]);
  
  deductProductStock(inv.items);
  if ((inv.dueAmount || inv.due) > 0) {
    updateCustomerDueRecord(inv);
  }
  updateShopSummarySheet();
}

function deductProductStock(items) {
  if (!items || items.length === 0) return;
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(ss, 'Stock_Inventory');
  var data = sheet.getDataRange().getValues();
  
  items.forEach(function(item) {
    var searchId = String(item.productId || item.id || '').trim().toLowerCase();
    var searchName = String(item.productName || item.name || '').trim().toLowerCase();
    
    for (var i = 1; i < data.length; i++) {
      var rowId = String(data[i][0]).trim().toLowerCase();
      var rowName = String(data[i][1]).trim().toLowerCase();
      if ((searchId && rowId === searchId) || rowName === searchName) {
        var curStock = Number(data[i][4]) || 0;
        var newStock = Math.max(0, curStock - Number(item.quantity));
        var buyPrice = Number(data[i][5]) || 0;
        sheet.getRange(i + 1, 5).setValue(newStock);
        sheet.getRange(i + 1, 8).setValue(newStock * buyPrice);
        sheet.getRange(i + 1, 9).setValue(newStock > 5 ? 'ইন-স্টক (In Stock)' : (newStock > 0 ? 'লো-স্টক (Low Stock)' : 'স্টক শেষ'));
        sheet.getRange(i + 1, 11).setValue(new Date().toLocaleString());
        break;
      }
    }
  });
}

function updateCustomerDueRecord(inv) {
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(ss, 'Customer_Dues');
  var data = sheet.getDataRange().getValues();
  var cName = String(inv.customerName || inv.customer).trim();
  var cPhone = String(inv.customerPhone || inv.phone).trim();
  var found = false;
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === cName || (cPhone !== 'N/A' && String(data[i][2]).trim() === cPhone)) {
      var curDue = Number(data[i][5]) || 0;
      var curTotal = Number(data[i][4]) || 0;
      sheet.getRange(i + 1, 5).setValue(curTotal + Number(inv.grandTotal || inv.total || 0));
      sheet.getRange(i + 1, 6).setValue(curDue + Number(inv.dueAmount || inv.due || 0));
      sheet.getRange(i + 1, 7).setValue(new Date().toLocaleDateString());
      found = true;
      break;
    }
  }
  
  if (!found) {
    sheet.appendRow([
      'CUST-0' + sheet.getLastRow(),
      cName,
      cPhone,
      'কাউন্টার খদ্দের',
      Number(inv.grandTotal || inv.total || 0),
      Number(inv.dueAmount || inv.due || 0),
      new Date().toLocaleDateString()
    ]);
  }
}

function saveExpenseRow(exp, userName) {
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(ss, 'Daily_Expenses');
  sheet.appendRow([
    exp.date || new Date().toLocaleString(),
    exp.id,
    exp.category,
    exp.amount,
    exp.paymentMethod,
    exp.note || '',
    userName || 'ক্যাশিয়ার'
  ]);
  updateShopSummarySheet();
}

function saveDuePaymentRow(pay, userName) {
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(ss, 'Due_Payments');
  sheet.appendRow([
    pay.id,
    pay.date || new Date().toLocaleString(),
    pay.customerName,
    pay.phone,
    pay.paidAmount,
    pay.paymentMethod,
    pay.previousDue,
    pay.remainingDue,
    pay.note || '',
    userName || 'ক্যাশিয়ার'
  ]);
  
  var dueSheet = getOrCreateSheet(ss, 'Customer_Dues');
  var data = dueSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(pay.customerName).trim()) {
      var curDue = Number(data[i][5]) || 0;
      dueSheet.getRange(i + 1, 6).setValue(Math.max(0, curDue - Number(pay.paidAmount)));
      dueSheet.getRange(i + 1, 7).setValue(new Date().toLocaleDateString() + ' (৳' + pay.paidAmount + ' আদায়)');
      break;
    }
  }
  updateShopSummarySheet();
}

function updateShopSummarySheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var salesSheet = getOrCreateSheet(ss, 'Sales_Invoices');
  var dueSheet = getOrCreateSheet(ss, 'Customer_Dues');
  var sumSheet = getOrCreateSheet(ss, 'Shop_Summary');
  
  var salesData = salesSheet.getDataRange().getValues();
  var totalSales = 0, totalPaid = 0, totalProfit = 0;
  for (var i = 1; i < salesData.length; i++) {
    totalSales += Number(salesData[i][5]) || 0;
    totalPaid += Number(salesData[i][6]) || 0;
    totalProfit += Number(salesData[i][9]) || 0;
  }
  
  var dueData = dueSheet.getDataRange().getValues();
  var totalDue = 0;
  for (var j = 1; j < dueData.length; j++) {
    totalDue += Number(dueData[j][5]) || 0;
  }
  
  sumSheet.getRange(3, 2).setValue('৳ ' + totalSales.toLocaleString());
  sumSheet.getRange(4, 2).setValue('৳ ' + totalPaid.toLocaleString());
  sumSheet.getRange(5, 2).setValue('৳ ' + totalDue.toLocaleString());
  sumSheet.getRange(6, 2).setValue('৳ ' + totalProfit.toLocaleString());
}

function updateUserPin(userId, newPin) {
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(ss, 'Users_Permissions');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === String(userId).trim().toLowerCase()) {
      sheet.getRange(i + 1, 5).setValue('সুরক্ষিত');
      if (newPin) {
        try { PropertiesService.getScriptProperties().setProperty('PIN_' + userId, newPin); } catch(e){}
        sheet.getRange(i + 1, 9).setValue(newPin);
      }
      break;
    }
  }
}

function updateUserCredentials(userId, newName, newUsername, newPin) {
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(ss, 'Users_Permissions');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === String(userId).trim().toLowerCase()) {
      var row = i + 1;
      if (newName) sheet.getRange(row, 2).setValue(newName);
      if (newUsername) sheet.getRange(row, 4).setValue(newUsername);
      sheet.getRange(row, 5).setValue('সুরক্ষিত');
      sheet.getRange(row, 8).setValue(new Date().toLocaleString());
      if (newPin) {
        try { PropertiesService.getScriptProperties().setProperty('PIN_' + userId, newPin); } catch(e){}
        sheet.getRange(row, 9).setValue(newPin);
      }
      break;
    }
  }
}

function clearAllDemoData() {
  var ss = getSpreadsheet();
  var sheetsToClear = ['Sales_Invoices', 'Product_Entries', 'Stock_Inventory', 'Daily_Expenses', 'Customer_Dues', 'Due_Payments'];
  sheetsToClear.forEach(function(name) {
    var sh = ss.getSheetByName(name);
    if (sh && sh.getLastRow() > 1) {
      sh.deleteRows(2, sh.getLastRow() - 1);
    }
  });
  setupSweetShopSheets();
}

function getAllSheetsData() {
  var ss = getSpreadsheet();
  setupSweetShopSheets();
  
  return {
    invoices: getInvoiceRows(ss),
    productEntries: getProductEntryRows(ss),
    products: getStockRows(ss, 'Stock_Inventory'),
    expenses: getExpenseRows(ss),
    customers: getCustomerRows(ss),
    duePayments: getDuePaymentRows(ss),
    users: getUserRows(ss),
    settings: getShopSettings(ss)
  };
}

function getShopSettings(ss) {
  var sheet = ss.getSheetByName('Shop_Summary');
  var sName = '${shopName}';
  if (sheet && sheet.getLastRow() >= 2) {
    var val = sheet.getRange(2, 2).getValue();
    if (val && String(val).trim() !== '') sName = String(val).trim();
  }
  var result = {
    shopName: sName,
    shopLogo: '🍯',
    shopTagline: 'খাঁটি ছানার সুস্বাদু মিষ্টি ও দুগ্ধজাত পণ্যের বিশ্বস্ত প্রতিষ্ঠান',
    phone: '01712-345678, 01823-996278',
    address: 'দোকান নং ১২, মিষ্টি গলি, চকবাজার, ঢাকা',
    currency: '৳'
  };
  // Load saved branding (incl. logo) from 'App_Settings'
  try {
    var cfg = ss.getSheetByName('App_Settings');
    if (cfg && cfg.getLastRow() >= 2) {
      var parts = cfg.getRange(2, 1, cfg.getLastRow() - 1, 1).getValues();
      var json = parts.map(function(r) { return String(r[0]); }).join('');
      var saved = JSON.parse(json);
      if (saved.shopName) result.shopName = saved.shopName;
      if (saved.shopLogo) result.shopLogo = saved.shopLogo;
      if (saved.shopTagline !== undefined) result.shopTagline = saved.shopTagline;
      if (saved.phone !== undefined) result.phone = saved.phone;
      if (saved.address !== undefined) result.address = saved.address;
      result.saved = true;
    }
  } catch (e) {}
  return result;
}

function getUserRows(ss) {
  var sheet = ss.getSheetByName('Users_Permissions');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var defaultRoles = {
    'USR-01': { role: 'admin', roleTitle: '১. অ্যাডমিন (Admin)', color: 'bg-purple-600', badge: 'ADMIN', pin: '1111' },
    'USR-02': { role: 'salesman', roleTitle: '২. সেলসম্যান (Salesman)', color: 'bg-emerald-600', badge: 'SALES', pin: '2222' },
    'USR-03': { role: 'cashier', roleTitle: '৩. ক্যাশিয়ার (Cashier)', color: 'bg-amber-600', badge: 'CASHIER', pin: '3333' },
    'USR-04': { role: 'manager', roleTitle: '৪. ম্যানেজার (Manager)', color: 'bg-blue-600', badge: 'MANAGER', pin: '4444' },
    'USR-05': { role: 'stock', roleTitle: '৫. স্টক এন্ট্রি যে করবে', color: 'bg-teal-600', badge: 'STOCK', pin: '5555' }
  };
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var uId = String(data[i][0] || '').trim();
    var def = defaultRoles[uId] || { role: 'salesman', roleTitle: 'স্টাফ', color: 'bg-slate-600', badge: 'STAFF', pin: '1234' };
    var pinProp = '';
    try { pinProp = PropertiesService.getScriptProperties().getProperty('PIN_' + uId) || ''; } catch(e){}
    var pinVal = pinProp || (data[i][8] ? String(data[i][8]).trim() : def.pin);
    rows.push({
      id: uId,
      name: String(data[i][1] || ''),
      role: def.role,
      roleTitle: String(data[i][2] || def.roleTitle),
      username: String(data[i][3] || ''),
      pin: pinVal,
      color: def.color,
      badge: def.badge
    });
  }
  return rows;
}

function getInvoiceRows(ss) {
  var sheet = ss.getSheetByName('Sales_Invoices');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var rawItems = [];
    if (data[i][12]) {
      try {
        rawItems = JSON.parse(data[i][12]);
      } catch(e) {}
    }
    if (!rawItems || rawItems.length === 0) {
      var txt = String(data[i][4] || '');
      if (txt) {
        var parts = txt.split(',');
        rawItems = parts.map(function(p, pIdx) {
          var pTrim = p.trim();
          var m = pTrim.match(/^(.+?)s*(([d.]+)s*([a-zA-Z]+)?s*@s*৳?([d.]+))$/);
          if (m) {
            var q = Number(m[2]) || 1;
            var r = Number(m[4]) || 0;
            return {
              productId: 'P' + (pIdx + 1),
              productName: m[1].trim(),
              quantity: q,
              unit: m[3] || 'kg',
              rate: r,
              total: q * r
            };
          }
          return {
            productId: 'P' + (pIdx + 1),
            productName: pTrim,
            quantity: 1,
            unit: 'একক',
            rate: 0,
            total: 0
          };
        });
      }
    }
    rows.push({
      date: String(data[i][0] || ''),
      id: String(data[i][1] || ''),
      customerName: String(data[i][2] || 'ক্যাশ খদ্দের'),
      customerPhone: String(data[i][3] || ''),
      itemsText: String(data[i][4] || ''),
      items: rawItems || [],
      subtotal: Number(data[i][5]) || 0,
      discount: 0,
      grandTotal: Number(data[i][5]) || 0,
      paidAmount: Number(data[i][6]) || 0,
      dueAmount: Number(data[i][7]) || 0,
      paymentMethod: String(data[i][8] || 'Cash'),
      totalProfit: Number(data[i][9]) || 0,
      servedBy: String(data[i][10] || ''),
      remarks: String(data[i][11] || '')
    });
  }
  return rows;
}

function getProductEntryRows(ss) {
  var sheet = ss.getSheetByName('Product_Entries');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    rows.push({
      id: String(data[i][0] || ''),
      purchaseNo: String(data[i][1] || ''),
      date: String(data[i][2] || ''),
      name: String(data[i][3] || ''),
      category: String(data[i][4] || ''),
      unit: String(data[i][5] || 'kg'),
      quantity: Number(data[i][6]) || 0,
      purchasePrice: Number(data[i][7]) || 0,
      salePrice: Number(data[i][8]) || 0,
      totalCost: Number(data[i][9]) || 0,
      supplier: String(data[i][10] || ''),
      enteredBy: String(data[i][11] || '')
    });
  }
  return rows;
}

function getExpenseRows(ss) {
  var sheet = ss.getSheetByName('Daily_Expenses');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    rows.push({
      date: String(data[i][0] || ''),
      id: String(data[i][1] || ('EXP-00' + i)),
      category: String(data[i][2] || 'দোকান ভাড়া (Shop Rent)'),
      amount: Number(data[i][3]) || 0,
      paymentMethod: String(data[i][4] || 'নগদ টাকা (Cash)'),
      note: String(data[i][5] || ''),
      enteredBy: String(data[i][6] || '')
    });
  }
  return rows;
}

function getCustomerRows(ss) {
  var sheet = ss.getSheetByName('Customer_Dues');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    rows.push({
      id: String(data[i][0] || ('CUST-0' + i)),
      name: String(data[i][1] || ''),
      phone: String(data[i][2] || ''),
      address: String(data[i][3] || ''),
      totalPurchased: Number(data[i][4]) || 0,
      totalDue: Number(data[i][5]) || 0,
      lastPaymentDate: String(data[i][6] || '')
    });
  }
  return rows;
}

function getDuePaymentRows(ss) {
  var sheet = ss.getSheetByName('Due_Payments');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    rows.push({
      id: String(data[i][0] || ''),
      date: String(data[i][1] || ''),
      customerName: String(data[i][2] || ''),
      phone: String(data[i][3] || ''),
      paidAmount: Number(data[i][4]) || 0,
      paymentMethod: String(data[i][5] || 'Cash'),
      previousDue: Number(data[i][6]) || 0,
      remainingDue: Number(data[i][7]) || 0,
      note: String(data[i][8] || ''),
      collectedBy: String(data[i][9] || '')
    });
  }
  return rows;
}

function getSheetRows(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    rows.push(row);
  }
  return rows;
}

function getStockRows(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    rows.push({
      id: data[i][0],
      name: data[i][1],
      category: data[i][2],
      unit: data[i][3],
      stock: Number(data[i][4]) || 0,
      cost: Number(data[i][5]) || 0,
      price: Number(data[i][6]) || 0,
      status: data[i][8],
      supplier: data[i][9]
    });
  }
  return rows;
}
