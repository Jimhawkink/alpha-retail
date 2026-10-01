const fs = require('fs');
let code = fs.readFileSync('E:/Res Pos/AlphaRetail/src/app/dashboard/stock-movement/page.tsx', 'utf8');

// 1. Add import
if (!code.includes('import * as XLSX')) {
    code = code.replace(/import toast from 'react-hot-toast';/, "import toast from 'react-hot-toast';\nimport * as XLSX from 'xlsx-js-style';");
}

// 2. Replace exportCSV body
const premiumExportCode = `
    const exportCSV = () => {
        const ws_data = [];

        // Title Row
        ws_data.push([{ v: activeOutlet?.outlet_name || 'Alpha Retail', t: 's', s: { font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "4F46E5" } }, alignment: { horizontal: "center", vertical: "center" } } }]);
        
        // Sub Title
        ws_data.push([{ v: \`Stock Movement Report | Period: \${dateFrom} to \${dateTo}\`, t: 's', s: { font: { bold: true, sz: 11, color: { rgb: "3730A3" } }, fill: { fgColor: { rgb: "E0E7FF" } }, alignment: { horizontal: "center", vertical: "center" } } }]);
        
        // Empty row
        ws_data.push([]);

        // Headers
        const headers = ['Product Code', 'Product Name', 'Category', 'Unit', 'Opening', 'In (Purch)', 'Out (Sales)', 'Adj.', 'Closing', 'Total Value (Ksh)'];
        ws_data.push(headers.map(h => ({
            v: h,
            t: 's',
            s: {
                font: { bold: true, color: { rgb: "FFFFFF" } },
                fill: { fgColor: { rgb: "2563EB" } },
                border: { top: { style: "thin", color: { rgb: "E5E7EB" } }, bottom: { style: "thin", color: { rgb: "E5E7EB" } } },
                alignment: { vertical: "center", horizontal: "center" }
            }
        })));

        // Data Rows
        filtered.forEach(m => {
            const row = [
                { v: m.product_code || '-', s: { alignment: { horizontal: "center" } } },
                { v: m.product_name || '-', s: { font: { bold: true } } },
                { v: m.category || '-', s: { alignment: { horizontal: "center" } } },
                { v: m.base_unit || '-', s: { alignment: { horizontal: "center" } } },
                { v: m.opening_qty || 0, t: 'n', s: { alignment: { horizontal: "center" } } },
                { v: m.purchased_qty || 0, t: 'n', s: { font: { color: { rgb: m.purchased_qty > 0 ? "059669" : "000000" } }, alignment: { horizontal: "center" } } },
                { v: m.issued_qty || 0, t: 'n', s: { font: { color: { rgb: m.issued_qty > 0 ? "E11D48" : "000000" } }, alignment: { horizontal: "center" } } },
                { v: m.adjusted_qty || 0, t: 'n', s: { alignment: { horizontal: "center" } } },
                { v: m.closing_qty || 0, t: 'n', s: { font: { bold: true }, alignment: { horizontal: "center" } } },
                { v: (m.closing_qty || 0) * (m.cost_price || 0), t: 'n', s: { font: { bold: true }, alignment: { horizontal: "right" } } },
            ];
            ws_data.push(row);
        });

        const ws = XLSX.utils.aoa_to_sheet(ws_data);

        // Merge Cells for Headers
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } }
        ];

        // Column Widths
        ws['!cols'] = [
            { wch: 15 }, // Code
            { wch: 35 }, // Name
            { wch: 15 }, // Category
            { wch: 10 }, // Unit
            { wch: 10 }, // Opening
            { wch: 12 }, // In
            { wch: 12 }, // Out
            { wch: 10 }, // Adj
            { wch: 10 }, // Closing
            { wch: 18 }, // Total Value
        ];

        // Row heights
        ws['!rows'] = [
            { hpt: 30 }, // Title
            { hpt: 20 }, // Subtitle
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Stock Movement");

        XLSX.writeFile(wb, \`Stock_Movement_\${dateTo}.xlsx\`);
        toast.success('Premium Excel Report Exported!');
    };
`;

const regex = /const exportCSV = \(\) => \{[\s\S]*?toast\.success\('Ledger Exported to Excel\/CSV!'\);\s*\};/;
if (regex.test(code)) {
    code = code.replace(regex, premiumExportCode);
} else {
    console.error("Regex did not match exportCSV");
}

fs.writeFileSync('E:/Res Pos/AlphaRetail/src/app/dashboard/stock-movement/page.tsx', code, 'utf8');
console.log('Replaced export function.');
