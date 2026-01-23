// Thermal Receipt Printing Utilities
// Works with 58mm and 80mm thermal printers

export interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
  total: number;
  notes?: string;
  discount?: number;
}

export interface ReceiptData {
  invoiceNo: string;
  date: string;
  time: string;
  cashier: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  amountPaid: number;
  change: number;
  customerName?: string;
  customerPhone?: string;
  mpesaReceipt?: string;
  tableNo?: string;
  orderNotes?: string;
  shiftCode?: string;
  isPaid?: boolean;
}

export interface KOTData {
  kotNo: string;
  date: string;
  time: string;
  orderType: string;
  tableNo?: string;
  waiter?: string;
  items: {
    name: string;
    qty: number;
    notes?: string;
  }[];
  orderNotes?: string;
  priority?: 'normal' | 'rush';
}

export interface CompanyInfo {
  name: string;
  address: string;
  phone: string;
  email?: string;
  pin?: string;
  logo?: string;
  slogan?: string;
}

// Default company info - will be loaded from database
let cachedCompanyInfo: CompanyInfo | null = null;

const defaultCompanyInfo: CompanyInfo = {
  name: 'ALPHA PLUS RESTAURANT',
  address: 'Main Street, Nairobi',
  phone: '+254 712 345 678',
  email: 'info@alphaplus.co.ke',
  pin: 'P051234567X',
  slogan: 'Quality Food, Great Service!'
};

// Load company info from database (organisation_settings table)
export async function loadCompanyInfo(): Promise<CompanyInfo> {
  if (cachedCompanyInfo) return cachedCompanyInfo;

  try {
    // First try localStorage cache
    const storedSettings = localStorage.getItem('company_settings');
    if (storedSettings) {
      const settings = JSON.parse(storedSettings);
      cachedCompanyInfo = {
        name: settings.company_name || settings.name || defaultCompanyInfo.name,
        address: settings.address || defaultCompanyInfo.address,
        phone: settings.phone || defaultCompanyInfo.phone,
        email: settings.email || defaultCompanyInfo.email,
        pin: settings.kra_pin || settings.pin || defaultCompanyInfo.pin,
        slogan: settings.slogan || settings.tagline || defaultCompanyInfo.slogan,
        logo: settings.logo
      };
      return cachedCompanyInfo;
    }

    // If not in localStorage, try to fetch from Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: settingsData } = await supabase
        .from('organisation_settings')
        .select('setting_key, setting_value');

      if (settingsData && settingsData.length > 0) {
        const settingsMap: { [key: string]: string } = {};
        settingsData.forEach((item: { setting_key: string; setting_value: string }) => {
          settingsMap[item.setting_key] = item.setting_value;
        });

        cachedCompanyInfo = {
          name: settingsMap['company_name'] || defaultCompanyInfo.name,
          address: settingsMap['address'] ?
            (settingsMap['city'] ? `${settingsMap['address']}, ${settingsMap['city']}` : settingsMap['address'])
            : defaultCompanyInfo.address,
          phone: settingsMap['phone'] || defaultCompanyInfo.phone,
          email: settingsMap['email'] || defaultCompanyInfo.email,
          pin: settingsMap['kra_pin'] || defaultCompanyInfo.pin,
          slogan: settingsMap['footer_note'] || settingsMap['slogan'] || defaultCompanyInfo.slogan,
        };

        // Cache to localStorage for faster subsequent loads
        localStorage.setItem('company_settings', JSON.stringify({
          company_name: cachedCompanyInfo.name,
          address: settingsMap['address'] || '',
          city: settingsMap['city'] || '',
          phone: cachedCompanyInfo.phone,
          email: cachedCompanyInfo.email,
          kra_pin: cachedCompanyInfo.pin,
          slogan: cachedCompanyInfo.slogan
        }));

        return cachedCompanyInfo;
      }
    }

    return defaultCompanyInfo;
  } catch (error) {
    console.error('Error loading company info:', error);
    return defaultCompanyInfo;
  }
}

// Get cached or default company info (synchronous)
export function getCompanyInfo(): CompanyInfo {
  return cachedCompanyInfo || defaultCompanyInfo;
}

// Generate SUPER POWERFUL Customer Bill HTML with NOT PAID watermark
export function generateCustomerBillHTML(data: ReceiptData, company: CompanyInfo = defaultCompanyInfo, isPaid: boolean = false): string {
  const itemRows = data.items.map((item, index) => `
    <tr>
      <td style="text-align:left;padding:4px 0;border-bottom:1px dotted #ccc;">${index + 1}. ${item.name}</td>
      <td style="text-align:center;padding:4px 0;border-bottom:1px dotted #ccc;">${item.qty}</td>
      <td style="text-align:right;padding:4px 0;border-bottom:1px dotted #ccc;">${item.price.toLocaleString()}</td>
      <td style="text-align:right;padding:4px 0;border-bottom:1px dotted #ccc;font-weight:bold;">${item.total.toLocaleString()}</td>
    </tr>
    ${item.notes ? `<tr><td colspan="4" style="font-size:10px;color:#c00;padding:2px 0 4px 15px;font-style:italic;">↳ ${item.notes}</td></tr>` : ''}
  `).join('');

  const watermarkStyle = !isPaid ? `
    <div style="
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 60px;
      font-weight: bold;
      color: rgba(255, 0, 0, 0.15);
      text-transform: uppercase;
      letter-spacing: 10px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 1000;
    ">NOT PAID</div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Customer Bill - ${data.invoiceNo}</title>
  <style>
    @page {
      margin: 0;
      size: 80mm auto;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', 'Arial', sans-serif;
      font-size: 11px;
      width: 80mm;
      padding: 4mm;
      background: #fff;
      color: #000;
      position: relative;
    }
    .header {
      text-align: center;
      padding-bottom: 10px;
      border-bottom: 3px double #000;
      margin-bottom: 10px;
    }
    .company-logo {
      font-size: 28px;
      margin-bottom: 5px;
    }
    .company-name {
      font-size: 18px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 3px;
    }
    .company-details {
      font-size: 10px;
      color: #333;
      line-height: 1.4;
    }
    .slogan {
      font-size: 9px;
      font-style: italic;
      color: #666;
      margin-top: 5px;
    }
    .bill-title {
      background: #000;
      color: #fff;
      text-align: center;
      padding: 8px;
      font-size: 16px;
      font-weight: bold;
      letter-spacing: 3px;
      margin: 10px 0;
    }
    .info-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5px;
      padding: 8px;
      background: #f5f5f5;
      border-radius: 5px;
      margin: 10px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
    }
    .info-label {
      color: #666;
      font-size: 10px;
    }
    .info-value {
      font-weight: bold;
      font-size: 11px;
    }
    .table-badge {
      background: #000;
      color: #fff;
      padding: 5px 15px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: bold;
      display: inline-block;
      margin: 5px 0;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
    }
    .items-table th {
      background: #eee;
      padding: 6px 4px;
      text-align: left;
      font-size: 10px;
      font-weight: bold;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
    }
    .items-table th:nth-child(2),
    .items-table th:nth-child(3),
    .items-table th:nth-child(4) {
      text-align: center;
    }
    .items-table th:last-child {
      text-align: right;
    }
    .totals-section {
      border-top: 2px solid #000;
      padding-top: 10px;
      margin-top: 10px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 12px;
    }
    .grand-total {
      background: linear-gradient(135deg, #000 0%, #333 100%);
      color: #fff;
      padding: 12px;
      margin: 10px 0;
      border-radius: 5px;
    }
    .grand-total .total-row {
      font-size: 20px;
      font-weight: bold;
    }
    .payment-section {
      background: #f0fff0;
      border: 2px solid #4CAF50;
      padding: 10px;
      border-radius: 5px;
      margin: 10px 0;
    }
    .payment-section.unpaid {
      background: #fff0f0;
      border-color: #f44336;
    }
    .payment-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .payment-badge.paid {
      background: #4CAF50;
      color: #fff;
    }
    .payment-badge.unpaid {
      background: #f44336;
      color: #fff;
    }
    .order-notes {
      background: #fff3cd;
      border: 1px solid #ffc107;
      padding: 8px;
      border-radius: 5px;
      margin: 10px 0;
      font-size: 10px;
    }
    .footer {
      text-align: center;
      margin-top: 15px;
      padding-top: 10px;
      border-top: 1px dashed #000;
    }
    .thank-you {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .footer-note {
      font-size: 9px;
      color: #666;
      margin-top: 5px;
    }
    .barcode-section {
      text-align: center;
      margin: 15px 0 5px 0;
      padding: 10px;
      border: 1px dashed #ccc;
    }
    .barcode {
      font-family: 'Libre Barcode 39', monospace;
      font-size: 35px;
      letter-spacing: 2px;
    }
    .invoice-no-large {
      font-size: 12px;
      font-weight: bold;
      letter-spacing: 2px;
      margin-top: 5px;
    }
    .qr-code {
      width: 60px;
      height: 60px;
      background: #f0f0f0;
      margin: 5px auto;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 8px;
      color: #999;
    }
    .powered-by {
      font-size: 8px;
      color: #999;
      margin-top: 10px;
    }
    @media print {
      body { width: 80mm; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  ${watermarkStyle}

  <!-- Header -->
  <div class="header">
    <div class="company-logo">🍽️</div>
    <div class="company-name">${company.name}</div>
    <div class="company-details">
      📍 ${company.address}<br>
      📞 ${company.phone}
      ${company.email ? `<br>✉️ ${company.email}` : ''}
      ${company.pin ? `<br>PIN: ${company.pin}` : ''}
    </div>
    ${company.slogan ? `<div class="slogan">"${company.slogan}"</div>` : ''}
  </div>

  <!-- Bill Title -->
  <div class="bill-title">
    ${isPaid ? '✓ TAX INVOICE ✓' : '⚠ CUSTOMER BILL ⚠'}
  </div>

  <!-- Invoice Info -->
  <div class="info-section">
    <div>
      <div class="info-label">Invoice No:</div>
      <div class="info-value">${data.invoiceNo}</div>
    </div>
    <div>
      <div class="info-label">Date:</div>
      <div class="info-value">${data.date}</div>
    </div>
    <div>
      <div class="info-label">Time:</div>
      <div class="info-value">${data.time}</div>
    </div>
    <div>
      <div class="info-label">Cashier:</div>
      <div class="info-value">${data.cashier}</div>
    </div>
  </div>

  ${data.tableNo ? `
  <div style="text-align:center;">
    <span class="table-badge">🪑 TABLE ${data.tableNo}</span>
  </div>
  ` : ''}

  ${data.customerName ? `
  <div style="text-align:center;margin:5px 0;">
    <span style="font-size:12px;">👤 Customer: <strong>${data.customerName}</strong></span>
  </div>
  ` : ''}

  <!-- Items -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width:45%">ITEM</th>
        <th style="width:15%">QTY</th>
        <th style="width:20%">PRICE</th>
        <th style="width:20%">TOTAL</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals-section">
    <div class="total-row">
      <span>Subtotal (${data.items.length} items):</span>
      <span style="font-weight:bold;">Ksh ${data.subtotal.toLocaleString()}</span>
    </div>
    ${data.discount > 0 ? `
    <div class="total-row" style="color:#4CAF50;">
      <span>💰 Discount:</span>
      <span style="font-weight:bold;">- Ksh ${data.discount.toLocaleString()}</span>
    </div>
    ` : ''}
    ${data.tax > 0 ? `
    <div class="total-row">
      <span>VAT (16%):</span>
      <span>Ksh ${data.tax.toLocaleString()}</span>
    </div>
    ` : ''}
  </div>

  <!-- Grand Total -->
  <div class="grand-total">
    <div class="total-row">
      <span>GRAND TOTAL:</span>
      <span>Ksh ${data.total.toLocaleString()}</span>
    </div>
  </div>

  <!-- Payment Status -->
  <div class="payment-section ${isPaid ? '' : 'unpaid'}">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span class="payment-badge ${isPaid ? 'paid' : 'unpaid'}">
        ${isPaid ? '✓ PAID' : '✗ NOT PAID'}
      </span>
      <span style="font-weight:bold;font-size:12px;">
        ${isPaid ? data.paymentMethod.toUpperCase() : 'PENDING'}
      </span>
    </div>
    ${isPaid ? `
    <div style="margin-top:8px;font-size:11px;">
      <div class="total-row">
        <span>Amount Paid:</span>
        <span>Ksh ${data.amountPaid.toLocaleString()}</span>
      </div>
      ${data.change > 0 ? `
      <div class="total-row" style="color:#4CAF50;font-weight:bold;">
        <span>🔄 Change:</span>
        <span>Ksh ${data.change.toLocaleString()}</span>
      </div>
      ` : ''}
      ${data.mpesaReceipt ? `
      <div class="total-row" style="font-size:10px;">
        <span>M-Pesa Ref:</span>
        <span>${data.mpesaReceipt}</span>
      </div>
      ` : ''}
    </div>
    ` : `
    <div style="margin-top:8px;text-align:center;font-size:11px;color:#c00;">
      ⚠️ Please pay at the counter
    </div>
    `}
  </div>

  ${data.orderNotes ? `
  <div class="order-notes">
    📝 <strong>Note:</strong> ${data.orderNotes}
  </div>
  ` : ''}

  <!-- Barcode Section -->
  <div class="barcode-section">
    <div class="barcode">*${data.invoiceNo}*</div>
    <div class="invoice-no-large">${data.invoiceNo}</div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="thank-you">★ THANK YOU FOR DINING WITH US! ★</div>
    <div style="font-size:10px;">We appreciate your business</div>
    <div class="footer-note">
      ${isPaid ? 'This serves as your official tax invoice' : 'This is not a tax invoice until payment is complete'}
    </div>
    <div class="footer-note">
      Goods once sold are not refundable
    </div>
    <div class="powered-by">
      Powered by Alpha Plus POS v2.0
    </div>
  </div>
</body>
</html>
`;
}

// Generate thermal receipt HTML (for paid receipts)
export function generateReceiptHTML(data: ReceiptData, company: CompanyInfo = defaultCompanyInfo): string {
  return generateCustomerBillHTML(data, company, true);
}

// Generate KOT (Kitchen Order Ticket) HTML
export function generateKOTHTML(data: KOTData, company: CompanyInfo = defaultCompanyInfo): string {
  const itemRows = data.items.map((item, index) => `
    <tr>
      <td style="font-size:10px;color:#666;padding:8px 5px;border-bottom:1px solid #ddd;">${index + 1}.</td>
      <td style="font-size:16px;font-weight:bold;padding:8px 5px;border-bottom:1px solid #ddd;">${item.name}</td>
      <td style="font-size:20px;font-weight:bold;text-align:center;background:#000;color:#fff;width:50px;padding:8px;">${item.qty}</td>
    </tr>
    ${item.notes ? `
    <tr>
      <td></td>
      <td colspan="2" style="font-size:13px;color:#c00;padding:5px 15px;background:#fff0f0;border-radius:5px;font-weight:bold;">
        ⚠️ ${item.notes.toUpperCase()}
      </td>
    </tr>
    ` : ''}
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>KOT - ${data.kotNo}</title>
  <style>
    @page {
      margin: 0;
      size: 80mm auto;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Arial', sans-serif;
      font-size: 12px;
      width: 80mm;
      padding: 5mm;
      background: #fff;
      color: #000;
    }
    .header {
      background: #000;
      color: #fff;
      text-align: center;
      padding: 12px;
      margin: -5mm -5mm 10px -5mm;
    }
    .kot-title {
      font-size: 28px;
      font-weight: bold;
      letter-spacing: 3px;
    }
    .kot-no {
      font-size: 24px;
      font-weight: bold;
      margin-top: 5px;
    }
    .rush {
      background: #c00 !important;
      animation: blink 0.5s infinite;
    }
    @keyframes blink {
      50% { opacity: 0.7; }
    }
    .info-box {
      border: 2px solid #000;
      padding: 10px;
      margin: 10px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin: 4px 0;
      font-size: 13px;
    }
    .table-no {
      font-size: 36px;
      font-weight: bold;
      text-align: center;
      padding: 15px;
      border: 4px solid #000;
      margin: 10px 0;
      background: #f0f0f0;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    .items-table td {
      vertical-align: middle;
    }
    .order-notes {
      background: #fff3cd;
      border: 3px solid #ffc107;
      padding: 12px;
      margin: 10px 0;
      font-size: 14px;
      font-weight: bold;
      text-align: center;
    }
    .footer {
      text-align: center;
      margin-top: 15px;
      font-size: 10px;
      color: #666;
    }
    .time-stamp {
      font-size: 16px;
      font-weight: bold;
      text-align: center;
      border-top: 3px solid #000;
      padding-top: 12px;
      margin-top: 10px;
    }
    @media print {
      body { width: 80mm; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header ${data.priority === 'rush' ? 'rush' : ''}">
    <div class="kot-title">🍳 K.O.T 🍳</div>
    <div class="kot-no">#${data.kotNo}</div>
    ${data.priority === 'rush' ? '<div style="font-size:20px;margin-top:5px;">⚡ RUSH ORDER ⚡</div>' : ''}
  </div>

  <!-- Table Number -->
  ${data.tableNo ? `
  <div class="table-no">
    🪑 TABLE ${data.tableNo}
  </div>
  ` : `
  <div class="table-no" style="background:#ffe0b2;border-color:#ff9800;">
    🛍️ ${data.orderType.toUpperCase()}
  </div>
  `}

  <!-- Order Info -->
  <div class="info-box">
    <div class="info-row">
      <span>Order Type:</span>
      <span style="font-weight:bold;font-size:14px;">${data.orderType.toUpperCase()}</span>
    </div>
    <div class="info-row">
      <span>Date:</span>
      <span>${data.date}</span>
    </div>
    <div class="info-row">
      <span>Time:</span>
      <span style="font-size:18px;font-weight:bold;">${data.time}</span>
    </div>
    ${data.waiter ? `
    <div class="info-row">
      <span>Waiter:</span>
      <span style="font-weight:bold;">${data.waiter}</span>
    </div>
    ` : ''}
  </div>

  <!-- Items -->
  <table class="items-table">
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <!-- Order Notes -->
  ${data.orderNotes ? `
  <div class="order-notes">
    📝 ${data.orderNotes.toUpperCase()}
  </div>
  ` : ''}

  <!-- Time Stamp -->
  <div class="time-stamp">
    ⏰ ${data.date} ${data.time}
  </div>

  <!-- Footer -->
  <div class="footer">
    ${company.name}
  </div>
</body>
</html>
`;
}

// Print function - uses iframe to avoid popup blockers
export function printReceipt(html: string): void {
  console.log('🖨️ Printing receipt...');

  // Create hidden iframe for printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();

    // Wait for content to load then print
    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          console.log('🖨️ Print dialog opened');
        } catch (e) {
          console.error('Print error:', e);
        }
        // Remove iframe after printing
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 300);
    };
  } else {
    console.error('Could not create print iframe');
    document.body.removeChild(iframe);
  }
}

// Direct print to thermal printer (for connected printers)
export async function printToThermalPrinter(html: string, printerName?: string): Promise<boolean> {
  try {
    // Create a hidden iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 100));

      // Print
      iframe.contentWindow?.print();

      // Remove iframe after print
      setTimeout(() => document.body.removeChild(iframe), 1000);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Print error:', error);
    return false;
  }
}

// Generate receipt data from cart
export function createReceiptData(
  invoiceNo: string,
  items: { name: string; qty: number; price: number; notes?: string; discount?: number }[],
  paymentMethod: string,
  amountPaid: number,
  cashier: string,
  options?: {
    customerName?: string;
    mpesaReceipt?: string;
    tableNo?: string;
    orderNotes?: string;
    shiftCode?: string;
    discount?: number;
    tax?: number;
    isPaid?: boolean;
  }
): ReceiptData {
  const now = new Date();
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const itemDiscounts = items.reduce((sum, item) => sum + (item.discount || 0), 0);
  const totalDiscount = itemDiscounts + (options?.discount || 0);
  const total = subtotal - totalDiscount + (options?.tax || 0);
  const change = paymentMethod === 'cash' ? Math.max(0, amountPaid - total) : 0;

  return {
    invoiceNo,
    date: now.toLocaleDateString('en-GB'),
    time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    cashier,
    items: items.map(item => ({
      name: item.name,
      qty: item.qty,
      price: item.price,
      total: item.price * item.qty,
      notes: item.notes,
      discount: item.discount
    })),
    subtotal,
    discount: totalDiscount,
    tax: options?.tax || 0,
    total,
    paymentMethod,
    amountPaid,
    change,
    customerName: options?.customerName,
    mpesaReceipt: options?.mpesaReceipt,
    tableNo: options?.tableNo,
    orderNotes: options?.orderNotes,
    shiftCode: options?.shiftCode,
    isPaid: options?.isPaid ?? true
  };
}

// Generate KOT data from cart
export function createKOTData(
  kotNo: string,
  items: { name: string; qty: number; notes?: string }[],
  orderType: string = 'Dine-In',
  options?: {
    tableNo?: string;
    waiter?: string;
    orderNotes?: string;
    priority?: 'normal' | 'rush';
  }
): KOTData {
  const now = new Date();

  return {
    kotNo,
    date: now.toLocaleDateString('en-GB'),
    time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    orderType,
    tableNo: options?.tableNo,
    waiter: options?.waiter,
    items: items.map(item => ({
      name: item.name,
      qty: item.qty,
      notes: item.notes
    })),
    orderNotes: options?.orderNotes,
    priority: options?.priority || 'normal'
  };
}

// Print customer receipt
export function printCustomerReceipt(data: ReceiptData, company?: CompanyInfo): void {
  const html = generateReceiptHTML(data, company);
  printReceipt(html);
}

// Print KOT
export function printKOT(data: KOTData, company?: CompanyInfo): void {
  const html = generateKOTHTML(data, company);
  printReceipt(html);
}

// Print unpaid customer bill (with NOT PAID watermark)
export function printUnpaidBill(data: ReceiptData, company?: CompanyInfo): void {
  const html = generateCustomerBillHTML(data, company, false);
  printReceipt(html);
}

// Mask phone number for privacy (e.g., 0712345678 -> 0712xxxx78)
export function maskPhoneNumber(phone: string): string {
  if (!phone) return '';
  // Clean phone number
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length >= 10) {
    // Format: 0712xxxx78 (show first 4 and last 2 digits)
    const prefix = cleaned.slice(0, 4);
    const suffix = cleaned.slice(-2);
    return `${prefix}xxxx${suffix}`;
  }
  return phone;
}

// Generate professional M-Pesa receipt HTML with classic thermal POS style
export function generateMpesaReceiptHTML(data: ReceiptData, company: CompanyInfo = getCompanyInfo()): string {
  // Generate item rows with classic thermal style (item name on top, qty/price/amount below)
  const itemRows = data.items.map((item) => `
<div style="margin:8px 0;">
  <div style="font-weight:bold;">${item.name}</div>
  <div style="display:flex;justify-content:space-between;padding-left:20px;">
    <span>${item.qty}</span>
    <span>${item.price.toFixed(2)}</span>
    <span style="font-weight:bold;">${item.total.toFixed(2)}</span>
  </div>
</div>
  `).join('');

  const maskedPhone = maskPhoneNumber(data.customerPhone || '');
  const dashLine = '----------------------------------------';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt - ${data.invoiceNo}</title>
  <style>
    @page { margin: 0; size: 80mm auto; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      width: 80mm;
      padding: 5mm;
      background: #fff;
      color: #000;
      line-height: 1.4;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .right { text-align: right; }
    .dash-line { 
      text-align: center; 
      letter-spacing: -1px;
      margin: 5px 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      margin: 3px 0;
    }
    .item-header {
      display: flex;
      justify-content: space-between;
      font-weight: bold;
      border-bottom: 1px dashed #000;
      padding-bottom: 3px;
      margin-bottom: 5px;
    }
    .total-section {
      border-top: 1px dashed #000;
      padding-top: 8px;
      margin-top: 8px;
    }
    .grand-total {
      font-size: 14px;
      font-weight: bold;
      border: 1px solid #000;
      padding: 5px;
      margin: 8px 0;
    }
    .mpesa-box {
      border: 1px dashed #000;
      padding: 8px;
      margin: 10px 0;
      text-align: center;
    }
    @media print { body { width: 80mm; } }
  </style>
</head>
<body>
  <!-- Company Header -->
  <div class="center">
    <div class="bold" style="font-size:14px;text-transform:uppercase;">${company.name}</div>
    <div>${company.address}</div>
    <div>Tel: ${company.phone}</div>
    ${company.pin ? `<div>PIN: ${company.pin}</div>` : ''}
  </div>

  <div class="dash-line">${dashLine}</div>

  <!-- Sale Type & Receipt Info -->
  <div class="header-row">
    <span class="bold">M-PESA SALE</span>
    <span>${data.customerName || 'Walk-in'}</span>
  </div>
  <div class="header-row">
    <span>${data.invoiceNo}</span>
    <span>${data.date} ${data.time}</span>
  </div>
  <div>Cashier: ${data.cashier}</div>

  <div class="dash-line">${dashLine}</div>

  <!-- Items Header -->
  <div class="item-header">
    <span style="width:40%;">Item</span>
    <span style="width:15%;text-align:center;">Qty</span>
    <span style="width:20%;text-align:right;">Price</span>
    <span style="width:25%;text-align:right;">Amount</span>
  </div>

  <!-- Items -->
  ${data.items.map((item) => `
  <div style="margin:6px 0;">
    <div class="bold">${item.name}</div>
    <div class="row" style="padding-left:15px;">
      <span style="width:15%;text-align:center;">${item.qty}</span>
      <span style="width:20%;text-align:right;">${item.price.toFixed(2)}</span>
      <span style="width:25%;text-align:right;font-weight:bold;">${item.total.toFixed(2)}</span>
    </div>
  </div>
  `).join('')}

  <div class="dash-line">${dashLine}</div>

  <!-- Totals Section -->
  <div class="total-section">
    <div class="row">
      <span>TOTAL:</span>
      <span class="bold">${data.items.length} Items</span>
      <span class="bold">${data.total.toFixed(2)}</span>
    </div>
    <div class="row">
      <span>Payment Received</span>
      <span>${data.amountPaid.toFixed(2)}</span>
    </div>
    ${data.change > 0 ? `
    <div class="row" style="margin-top:5px;">
      <span class="bold">CHANGE</span>
      <span class="bold">${data.change.toFixed(2)}</span>
    </div>
    ` : ''}
  </div>

  <div class="dash-line">${dashLine}</div>

  <!-- M-Pesa Details -->
  <div class="mpesa-box">
    <div class="bold">PAID VIA M-PESA</div>
    ${data.mpesaReceipt ? `<div style="font-size:14px;font-weight:bold;margin:5px 0;">${data.mpesaReceipt}</div>` : ''}
    ${maskedPhone ? `<div>Phone: ${maskedPhone}</div>` : ''}
  </div>

  ${data.customerName ? `
  <div class="row">
    <span>Customer:</span>
    <span class="bold">${data.customerName}</span>
  </div>
  ` : ''}

  <div class="dash-line">${dashLine}</div>

  <!-- QR Code for Verification -->
  <div class="center" style="margin:10px 0;">
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=https://alpha-retail.vercel.app/verify/${encodeURIComponent(data.invoiceNo)}" 
         alt="Verify Receipt" style="width:80px;height:80px;"/>
    <div style="font-size:8px;margin-top:3px;">Scan to verify receipt</div>
  </div>

  <!-- Footer -->
  <div class="center" style="margin-top:10px;">
    <div class="bold">*** THANK YOU! ***</div>
    <div style="font-size:10px;margin-top:5px;">Goods once sold are not refundable</div>
    <div style="font-size:9px;margin-top:8px;color:#666;">Powered by Alpha Retail POS</div>
  </div>
</body>
</html>
`;
}

// Print M-Pesa receipt
export function printMpesaReceipt(data: ReceiptData, company?: CompanyInfo): void {
  const html = generateMpesaReceiptHTML(data, company);
  printReceipt(html);
}

export default {
  generateReceiptHTML,
  generateCustomerBillHTML,
  generateKOTHTML,
  generateMpesaReceiptHTML,
  printReceipt,
  printToThermalPrinter,
  createReceiptData,
  createKOTData,
  printCustomerReceipt,
  printKOT,
  printUnpaidBill,
  printMpesaReceipt,
  maskPhoneNumber
};

