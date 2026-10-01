const fs = require('fs');
let code = fs.readFileSync('E:/Res Pos/AlphaRetail/src/app/dashboard/stock-movement/page.tsx', 'utf8');

// Fix abnormal characters
code = code.replace(/→/g, '-');
code = code.replace(/•/g, '-');
code = code.replace(/â€¢/g, '-');
code = code.replace(/â†’/g, '-');
code = code.replace(/â€/g, '-');

// Reduce Stats Cards font sizes
code = code.replace(/text-2xl font-black/g, 'text-xl font-bold');

// Reduce Datagrid Font Sizes and boldness
code = code.replace(/font-bold text-gray-900/g, 'font-medium text-xs text-gray-900');
code = code.replace(/font-bold text-gray-700/g, 'font-medium text-xs text-gray-700');
code = code.replace(/font-bold \$\{m.purchased_qty/g, 'font-medium text-xs ${m.purchased_qty');
code = code.replace(/font-bold \$\{m.issued_qty/g, 'font-medium text-xs ${m.issued_qty');
code = code.replace(/font-bold \$\{m.adjusted_qty/g, 'font-medium text-xs ${m.adjusted_qty');
code = code.replace(/font-bold text-white bg-blue-600/g, 'font-medium text-xs text-white bg-blue-600');
code = code.replace(/font-bold text-slate-700/g, 'font-medium text-xs text-slate-700');
code = code.replace(/font-bold text-sm flex items-center/g, 'font-medium text-xs flex items-center');

// Drop table header row sizing slightly too? "text-[11px] font-bold" is fine, already small enough.
// The datagrid values are now text-xs font-medium instead of text-sm font-bold or font-black.

// Fix "Detailed Ledger: "
code = code.replace(/text-sm font-bold text-gray-800 mb-5/g, 'text-sm font-semibold text-gray-800 mb-5');

fs.writeFileSync('E:/Res Pos/AlphaRetail/src/app/dashboard/stock-movement/page.tsx', code, 'utf8');
console.log('Done');
