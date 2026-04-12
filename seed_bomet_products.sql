-- Seed 50 products for BOMET STORES (outlet_id = 3)
-- Each product has retail price, wholesale price, purchase cost, purchase_unit, sales_unit, pieces_per_package

-- First insert products
INSERT INTO retail_products (product_name, product_code, category, purchase_cost, sales_cost, wholesale_price, purchase_unit, sales_unit, pieces_per_package, barcode, supplier_name, reorder_point, margin_per, vat, show_in_pos, active, outlet_id, button_ui_color) VALUES
-- BEVERAGES (10 items)
('Coca Cola 500ml', 'BMS-BEV001', 'Beverages', 30, 50, 45, 'Crate', 'Piece', 24, '5000112611310', 'NAIROBI BOTTLERS', 20, 66, 0, true, true, 3, 'from-red-400 to-red-600'),
('Fanta Orange 500ml', 'BMS-BEV002', 'Beverages', 28, 50, 45, 'Crate', 'Piece', 24, '5000112611327', 'NAIROBI BOTTLERS', 20, 78, 0, true, true, 3, 'from-orange-400 to-orange-600'),
('Sprite 500ml', 'BMS-BEV003', 'Beverages', 28, 50, 45, 'Crate', 'Piece', 24, '5000112611334', 'NAIROBI BOTTLERS', 20, 78, 0, true, true, 3, 'from-green-400 to-green-600'),
('Dasani Water 500ml', 'BMS-BEV004', 'Beverages', 15, 30, 25, 'Crate', 'Piece', 24, '5000112611341', 'NAIROBI BOTTLERS', 30, 100, 0, true, true, 3, 'from-blue-400 to-blue-600'),
('Krest Soda 500ml', 'BMS-BEV005', 'Beverages', 28, 50, 45, 'Crate', 'Piece', 24, '5000112611358', 'NAIROBI BOTTLERS', 15, 78, 0, true, true, 3, 'from-teal-400 to-teal-600'),
('Minute Maid Mango 1L', 'BMS-BEV006', 'Beverages', 90, 150, 130, 'Carton', 'Piece', 12, '5000112611365', 'NAIROBI BOTTLERS', 10, 66, 0, true, true, 3, 'from-orange-400 to-orange-600'),
('Red Bull 250ml', 'BMS-BEV007', 'Beverages', 150, 250, 220, 'Carton', 'Piece', 24, '9002490100070', 'PREMIUM DIST.', 10, 66, 0, true, true, 3, 'from-indigo-400 to-indigo-600'),
('Stoney Tangawizi 500ml', 'BMS-BEV008', 'Beverages', 30, 50, 45, 'Crate', 'Piece', 24, '5000112611372', 'NAIROBI BOTTLERS', 15, 66, 0, true, true, 3, 'from-emerald-400 to-emerald-600'),
('Novida Pineapple 500ml', 'BMS-BEV009', 'Beverages', 28, 50, 45, 'Crate', 'Piece', 24, '5000112611389', 'NAIROBI BOTTLERS', 15, 78, 0, true, true, 3, 'from-purple-400 to-purple-600'),
('Picana Juice Apple 1L', 'BMS-BEV010', 'Beverages', 80, 130, 110, 'Carton', 'Piece', 12, '5000112611396', 'DEL MONTE KENYA', 10, 62, 0, true, true, 3, 'from-pink-400 to-pink-600'),

-- SNACKS & BISCUITS (10 items)
('Digestive Biscuits 400g', 'BMS-SNK001', 'Snacks', 60, 100, 85, 'Carton', 'Piece', 24, '6161100000123', 'BRITANIA FOODS', 15, 66, 0, true, true, 3, 'from-orange-400 to-orange-600'),
('Tropical Heat Crisps 100g', 'BMS-SNK002', 'Snacks', 40, 70, 60, 'Carton', 'Piece', 48, '6161100000130', 'TROPICAL HEAT', 20, 75, 0, true, true, 3, 'from-red-400 to-red-600'),
('Cadbury Dairy Milk 100g', 'BMS-SNK003', 'Snacks', 80, 150, 130, 'Carton', 'Piece', 24, '7622210120014', 'CADBURY KENYA', 10, 87, 0, true, true, 3, 'from-purple-400 to-purple-600'),
('Orbit Chewing Gum', 'BMS-SNK004', 'Snacks', 5, 10, 8, 'Box', 'Piece', 100, '5000159461122', 'WRIGLEY EA', 50, 100, 0, true, true, 3, 'from-blue-400 to-blue-600'),
('Manji Glucose Biscuit 150g', 'BMS-SNK005', 'Snacks', 25, 50, 40, 'Carton', 'Piece', 48, '6161100000147', 'MANJI FOOD IND.', 20, 100, 0, true, true, 3, 'from-emerald-400 to-emerald-600'),
('Lay''s Classic Chips 160g', 'BMS-SNK006', 'Snacks', 80, 150, 130, 'Carton', 'Piece', 24, '6161100000154', 'PEPSICO EA', 10, 87, 0, true, true, 3, 'from-indigo-400 to-indigo-600'),
('Nice Biscuits 300g', 'BMS-SNK007', 'Snacks', 35, 60, 50, 'Carton', 'Piece', 36, '6161100000161', 'BRITANIA FOODS', 15, 71, 0, true, true, 3, 'from-teal-400 to-teal-600'),
('Weetabix 900g', 'BMS-SNK008', 'Snacks', 350, 550, 480, 'Carton', 'Piece', 12, '5010029213805', 'WEETABIX EA', 8, 57, 0, true, true, 3, 'from-pink-400 to-pink-600'),
('Nutri Yoghurt 500ml', 'BMS-SNK009', 'Dairy', 50, 90, 75, 'Crate', 'Piece', 24, '6161100000178', 'BROOKSIDE DAIRY', 15, 80, 0, true, true, 3, 'from-green-400 to-green-600'),
('Mentos Mint Roll', 'BMS-SNK010', 'Snacks', 15, 30, 25, 'Box', 'Piece', 40, '8935001725053', 'PERFETTI EA', 30, 100, 0, true, true, 3, 'from-blue-400 to-blue-600'),

-- HOUSEHOLD & CLEANING (10 items)
('Omo Washing Powder 1kg', 'BMS-HH001', 'Household', 150, 230, 200, 'Bale', 'Piece', 12, '6161100100010', 'UNILEVER KENYA', 10, 53, 0, true, true, 3, 'from-blue-400 to-blue-600'),
('Sunlight Soap 175g', 'BMS-HH002', 'Household', 30, 50, 45, 'Carton', 'Piece', 72, '6161100100027', 'UNILEVER KENYA', 30, 66, 0, true, true, 3, 'from-orange-400 to-orange-600'),
('Harpic Toilet Cleaner 500ml', 'BMS-HH003', 'Household', 120, 200, 180, 'Carton', 'Piece', 12, '5283000306200', 'RECKITT BENCK.', 8, 66, 0, true, true, 3, 'from-purple-400 to-purple-600'),
('Dettol Antiseptic 500ml', 'BMS-HH004', 'Household', 280, 450, 400, 'Carton', 'Piece', 12, '5000158105362', 'RECKITT BENCK.', 6, 60, 0, true, true, 3, 'from-green-400 to-green-600'),
('Jik Bleach 750ml', 'BMS-HH005', 'Household', 60, 100, 85, 'Carton', 'Piece', 12, '6161100100034', 'RECKITT BENCK.', 10, 66, 0, true, true, 3, 'from-teal-400 to-teal-600'),
('Morning Fresh Dish 500ml', 'BMS-HH006', 'Household', 90, 150, 130, 'Carton', 'Piece', 12, '6161100100041', 'PZ CUSSONS', 10, 66, 0, true, true, 3, 'from-emerald-400 to-emerald-600'),
('Serviettes Pack 100', 'BMS-HH007', 'Household', 40, 80, 65, 'Bale', 'Piece', 24, '6161100100058', 'TISSUE KENYA', 15, 100, 0, true, true, 3, 'from-pink-400 to-pink-600'),
('Toilet Paper 10-Pack', 'BMS-HH008', 'Household', 180, 320, 280, 'Bale', 'Piece', 6, '6161100100065', 'TISSUE KENYA', 10, 77, 0, true, true, 3, 'from-indigo-400 to-indigo-600'),
('Doom Insecticide 300ml', 'BMS-HH009', 'Household', 200, 350, 300, 'Carton', 'Piece', 12, '6161100100072', 'SC JOHNSON', 6, 75, 0, true, true, 3, 'from-red-400 to-red-600'),
('Royale Tissue Box 100s', 'BMS-HH010', 'Household', 60, 120, 100, 'Bale', 'Piece', 24, '6161100100089', 'TISSUE KENYA', 10, 100, 0, true, true, 3, 'from-blue-400 to-blue-600'),

-- FOOD & GROCERY (10 items)
('Brookside Full Cream Milk 500ml', 'BMS-FD001', 'Food', 40, 65, 55, 'Crate', 'Piece', 24, '6161100200017', 'BROOKSIDE DAIRY', 20, 62, 0, true, true, 3, 'from-green-400 to-green-600'),
('Mumias Sugar 2kg', 'BMS-FD002', 'Food', 200, 320, 280, 'Bale', 'Piece', 10, '6161100200024', 'MUMIAS SUGAR', 10, 60, 0, true, true, 3, 'from-orange-400 to-orange-600'),
('Soko Maize Flour 2kg', 'BMS-FD003', 'Food', 100, 170, 150, 'Bale', 'Piece', 12, '6161100200031', 'UNGA GROUP', 10, 70, 0, true, true, 3, 'from-teal-400 to-teal-600'),
('Golden Crown Cooking Oil 1L', 'BMS-FD004', 'Food', 180, 280, 250, 'Carton', 'Piece', 12, '6161100200048', 'BIDCO AFRICA', 8, 55, 0, true, true, 3, 'from-purple-400 to-purple-600'),
('Royco Cube Beef 12pk', 'BMS-FD005', 'Food', 20, 40, 35, 'Box', 'Piece', 60, '6161100200055', 'UNILEVER KENYA', 30, 100, 0, true, true, 3, 'from-red-400 to-red-600'),
('Exe White Rice 2kg', 'BMS-FD006', 'Food', 180, 310, 270, 'Bale', 'Piece', 10, '6161100200062', 'RICE IMPORTERS', 8, 72, 0, true, true, 3, 'from-emerald-400 to-emerald-600'),
('Tomato Sauce 400g', 'BMS-FD007', 'Food', 60, 100, 85, 'Carton', 'Piece', 24, '6161100200079', 'TRUFOODS LTD', 15, 66, 0, true, true, 3, 'from-pink-400 to-pink-600'),
('Bread Butter 500g', 'BMS-FD008', 'Food', 120, 200, 175, 'Carton', 'Piece', 12, '6161100200086', 'BROOKSIDE DAIRY', 10, 66, 0, true, true, 3, 'from-indigo-400 to-indigo-600'),
('Blue Band Margarine 500g', 'BMS-FD009', 'Food', 130, 220, 190, 'Carton', 'Piece', 24, '6161100200093', 'UPFIELD KENYA', 10, 69, 0, true, true, 3, 'from-blue-400 to-blue-600'),
('Indomie Noodles Chicken', 'BMS-FD010', 'Food', 15, 30, 25, 'Carton', 'Piece', 40, '0890105600004', 'INDOMIE KENYA', 30, 100, 0, true, true, 3, 'from-orange-400 to-orange-600'),

-- PERSONAL CARE (5 items)
('Vaseline Petroleum Jelly 250ml', 'BMS-PC001', 'Personal Care', 150, 280, 240, 'Carton', 'Piece', 12, '6161100300014', 'UNILEVER KENYA', 8, 86, 0, true, true, 3, 'from-blue-400 to-blue-600'),
('Colgate Toothpaste 100ml', 'BMS-PC002', 'Personal Care', 80, 150, 130, 'Carton', 'Piece', 24, '8901314200624', 'COLGATE PALM.', 12, 87, 0, true, true, 3, 'from-red-400 to-red-600'),
('Amara Shower Gel 400ml', 'BMS-PC003', 'Personal Care', 120, 200, 170, 'Carton', 'Piece', 12, '6161100300021', 'PZ CUSSONS', 8, 66, 0, true, true, 3, 'from-purple-400 to-purple-600'),
('Sure Deodorant 150ml', 'BMS-PC004', 'Personal Care', 180, 320, 280, 'Carton', 'Piece', 12, '6161100300038', 'UNILEVER KENYA', 6, 77, 0, true, true, 3, 'from-green-400 to-green-600'),
('Nice & Lovely Body Lotion 400ml', 'BMS-PC005', 'Personal Care', 150, 250, 220, 'Carton', 'Piece', 12, '6161100300045', 'PZ CUSSONS', 8, 66, 0, true, true, 3, 'from-pink-400 to-pink-600'),

-- STATIONERY (5 items)
('Counter Book A4 2-Quire', 'BMS-ST001', 'Stationery', 80, 150, 120, 'Dozen', 'Piece', 12, '6161100400011', 'STATPACK IND.', 10, 87, 0, true, true, 3, 'from-blue-400 to-blue-600'),
('BIC Ballpoint Pen Blue', 'BMS-ST002', 'Stationery', 10, 20, 15, 'Box', 'Piece', 50, '3086123252509', 'BIC EA', 30, 100, 0, true, true, 3, 'from-indigo-400 to-indigo-600'),
('Sellotape Large', 'BMS-ST003', 'Stationery', 30, 60, 50, 'Box', 'Piece', 24, '6161100400028', 'STATPACK IND.', 15, 100, 0, true, true, 3, 'from-teal-400 to-teal-600'),
('Manila Paper A1', 'BMS-ST004', 'Stationery', 8, 15, 12, 'Ream', 'Piece', 100, '6161100400035', 'STATPACK IND.', 50, 87, 0, true, true, 3, 'from-emerald-400 to-emerald-600'),
('Exercise Book 96pg', 'BMS-ST005', 'Stationery', 20, 40, 35, 'Dozen', 'Piece', 12, '6161100400042', 'STATPACK IND.', 20, 100, 0, true, true, 3, 'from-orange-400 to-orange-600');

-- Now insert stock for each product just inserted (Bomet outlet_id=3)
-- We reference by product_code since pid is auto-generated
INSERT INTO retail_stock (pid, qty, outlet_id, storage_type, invoice_no)
SELECT pid, 
    CASE 
        WHEN category = 'Beverages' THEN pieces_per_package * 5  -- 5 crates/cartons
        WHEN category = 'Snacks' THEN pieces_per_package * 3
        WHEN category = 'Dairy' THEN pieces_per_package * 3
        WHEN category = 'Household' THEN pieces_per_package * 4
        WHEN category = 'Food' THEN pieces_per_package * 6
        WHEN category = 'Personal Care' THEN pieces_per_package * 3
        WHEN category = 'Stationery' THEN pieces_per_package * 4
        ELSE 100
    END,
    3, 'Store', 'BMS-OPENING'
FROM retail_products 
WHERE outlet_id = 3 
AND product_code LIKE 'BMS-%'
AND pid NOT IN (SELECT pid FROM retail_stock WHERE outlet_id = 3);
