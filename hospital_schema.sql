-- Hospital Billing Management System Extension
-- Tables added to 'public' schema with 'hospital_' prefix to ensure API availability

-- Patients Table
CREATE TABLE IF NOT EXISTS hospital_patients (
    patient_id SERIAL PRIMARY KEY,
    patient_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    id_number VARCHAR(50),
    registration_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    active BOOLEAN DEFAULT TRUE
);

-- Hospital Services Table
CREATE TABLE IF NOT EXISTS hospital_services (
    service_id SERIAL PRIMARY KEY,
    service_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL, -- e.g., 'Registration', 'Dental', 'Ultra Sound', 'Laboratory'
    price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    reg_type VARCHAR(50) DEFAULT 'Standard', -- 'SHA', 'Non-SHA'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    active BOOLEAN DEFAULT TRUE
);

-- Company Registration Extension
CREATE TABLE IF NOT EXISTS hospital_companies (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INDEPENDENT Hospital Sales Table
CREATE TABLE IF NOT EXISTS hospital_sales (
    sale_id SERIAL PRIMARY KEY,
    receipt_no VARCHAR(50) UNIQUE NOT NULL,
    patient_id INTEGER REFERENCES hospital_patients(patient_id),
    patient_name VARCHAR(255),
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(50), -- CASH, MPESA, BANK
    mpesa_code VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Completed',
    created_by INTEGER, -- hospital_users.user_id
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verification_hash VARCHAR(255)
);

-- INDEPENDENT Hospital Sales Items Table
CREATE TABLE IF NOT EXISTS hospital_sales_items (
    item_id SERIAL PRIMARY KEY,
    sale_id INTEGER REFERENCES hospital_sales(sale_id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES hospital_services(service_id),
    service_name VARCHAR(255),
    price NUMERIC(15, 2) NOT NULL,
    quantity INTEGER DEFAULT 1,
    subtotal NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Hospital Users Table
CREATE TABLE IF NOT EXISTS hospital_users (
    user_id SERIAL PRIMARY KEY,
    user_code VARCHAR(50) UNIQUE,
    user_name VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    user_type VARCHAR(50) NOT NULL, -- 'Doctor', 'Nurse', 'Cashier', 'Admin'
    phone VARCHAR(20),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert a default hospital admin
INSERT INTO hospital_users (user_code, user_name, password_hash, full_name, user_type) VALUES
('H-001', 'hadmin', 'admin123', 'Hospital Admin', 'Admin')
ON CONFLICT (user_name) DO NOTHING;

-- Insert Superuser account
INSERT INTO hospital_users (user_code, user_name, password_hash, full_name, user_type) VALUES
('H-999', 'superuser', '@JIm47jhC_7%#', 'System Superuser', 'Admin')
ON CONFLICT (user_name) DO NOTHING;

-- Hospital Settings Table
CREATE TABLE IF NOT EXISTS hospital_settings (
    id SERIAL PRIMARY KEY,
    hospital_name VARCHAR(255) DEFAULT 'ALPHA PLUS HOSPITAL',
    hospital_motto VARCHAR(255) DEFAULT 'RECOVER WELL',
    address TEXT DEFAULT '123 Medical Plaza, Nairobi',
    phone VARCHAR(50) DEFAULT '0720316175',
    pin_number VARCHAR(50) DEFAULT 'P051234567X',
    email VARCHAR(255) DEFAULT 'info@alphaplus.med',
    receipt_footer TEXT DEFAULT 'Quality Care, Every Step of the Way.',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO hospital_settings (hospital_name, address, phone, pin_number)
VALUES ('ALPHA PLUS HOSPITAL', '123 Medical Plaza, Nairobi', '0720316175', 'P051234567X')
ON CONFLICT DO NOTHING;

-- Insert some default services
INSERT INTO hospital_services (service_name, category, price, reg_type) VALUES
('SHA Registration', 'Registration', 0.00, 'SHA'),
('Non-SHA Registration (Standard)', 'Registration', 500.00, 'Non-SHA'),
('Insulin (Standard)', 'Pharmacy', 1200.00, 'Non-SHA'),
('Ultra Sound', 'Radiology', 3500.00, 'Non-SHA'),
('Dental Consultation', 'Dental', 1000.00, 'Non-SHA'),
('Tooth Extraction', 'Dental', 2500.00, 'Non-SHA'),
('Laboratory Full CBC', 'Lab', 1500.00, 'Non-SHA'),
('Laboratory Full CBC', 'Lab', 1500.00, 'Non-SHA'),
('X-Ray Chest', 'Radiology', 2000.00, 'Non-SHA'),
('Amoxicillin 500mg', 'Pharmacy', 450.00, 'Non-SHA'),
('Paracetamol 500mg', 'Pharmacy', 20.00, 'Non-SHA'),
('Ciprofloxacin 500mg', 'Pharmacy', 600.00, 'Non-SHA')
ON CONFLICT DO NOTHING;

-- Appointments Table
CREATE TABLE IF NOT EXISTS hospital_appointments (
    appointment_id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES hospital_patients(patient_id),
    patient_name VARCHAR(255),
    doctor_id INTEGER REFERENCES hospital_users(user_id),
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'Scheduled', -- Scheduled, Completed, Cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prescriptions Table
CREATE TABLE IF NOT EXISTS hospital_prescriptions (
    prescription_id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES hospital_patients(patient_id),
    doctor_id INTEGER REFERENCES hospital_users(user_id),
    diagnosis TEXT,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prescription Items
CREATE TABLE IF NOT EXISTS hospital_prescription_items (
    item_id SERIAL PRIMARY KEY,
    prescription_id INTEGER REFERENCES hospital_prescriptions(prescription_id) ON DELETE CASCADE,
    drug_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    duration VARCHAR(100),
    instructions TEXT
);

-- Lab Requests
CREATE TABLE IF NOT EXISTS hospital_lab_requests (
    request_id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES hospital_patients(patient_id),
    doctor_id INTEGER REFERENCES hospital_users(user_id),
    test_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending', -- Pending, Completed
    results TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
