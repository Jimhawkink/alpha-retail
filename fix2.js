const fs = require('fs');
let code = fs.readFileSync('E:/Res Pos/AlphaRetail/src/app/dashboard/stock-movement/page.tsx', 'utf8');

// 1. Update imports
if (!code.includes('FiDownload')) {
    code = code.replace(/FiActivity \} from 'react-icons\/fi';/, 'FiActivity, FiDownload, FiPrinter } from \'react-icons/fi\';');
}

// 2. Add Export functions just before return
const exportCode = `
    const exportCSV = () => {
        const csv = [['Product Code', 'Product Name', 'Category', 'Unit', 'Opening', 'In (Purch)', 'Out (Sales)', 'Adj.', 'Closing', 'Total Value (Ksh)'].join(','),
        ...filtered.map(m => [
            m.product_code,
            \`"\${m.product_name}"\`,
            m.category || '',
            m.base_unit,
            m.opening_qty,
            m.purchased_qty,
            m.issued_qty,
            m.adjusted_qty,
            m.closing_qty,
            m.closing_qty * m.cost_price
        ].join(','))].join('\\n');
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'stock-movement.csv'; a.click();
        toast.success('Ledger Exported to Excel/CSV!');
    };

    const handlePrint = () => {
        window.print();
    };

    return (`;

if (!code.includes('const exportCSV = () =>')) {
    code = code.replace(/return \(/, exportCode);
}

// 3. Add buttons to header
const headerCode = `
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700">Stock Movement Ledger</h1>
                    <p className="text-[11px] font-medium text-gray-400 uppercase tracking-widest mt-1.5">Robust ultra-premium tracking of stock lifecycle per product.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={exportCSV} className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300 transition-all text-sm font-semibold flex items-center gap-2 shadow-sm">
                        <FiDownload size={14} /> Export Excel
                    </button>
                    <button onClick={handlePrint} className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 hover:text-purple-600 hover:border-purple-300 transition-all text-sm font-semibold flex items-center gap-2 shadow-sm">
                        <FiPrinter size={14} /> Print / PDF
                    </button>
                </div>
`;
code = code.replace(/<div>\s*<h1 className="text-2xl font-bold[^>]*>Stock Movement Ledger<\/h1>[\s\S]*?<\/div>/, headerCode);

fs.writeFileSync('E:/Res Pos/AlphaRetail/src/app/dashboard/stock-movement/page.tsx', code, 'utf8');
console.log('Export and Print injected.');
