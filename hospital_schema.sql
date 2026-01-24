-- Hospital Billing Management System Extension
-- SCHEMA: hospital

CREATE SCHEMA IF NOT EXISTS hospital;

-- Patients Table
CREATE TABLE IF NOT EXISTS hospital.patients (
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
CREATE TABLE IF NOT EXISTS hospital.services (
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
CREATE TABLE IF NOT EXISTS hospital.companies (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Hospital Sales / Billing Extension
-- This table links the standard public.sales to hospital specific info
CREATE TABLE IF NOT EXISTS hospital.billing (
    billing_id SERIAL PRIMARY KEY,
    sale_id INTEGER REFERENCES public.sales(sale_id),
    receipt_no VARCHAR(50) UNIQUE,
    patient_id INTEGER REFERENCES hospital.patients(patient_id),
    patient_name VARCHAR(255),
    total_amount NUMERIC(15, 2) NOT NULL,
    payment_method VARCHAR(50),
    mpesa_code VARCHAR(50),
    bank_ref VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Completed',
    verification_hash VARCHAR(255), -- For QR code verification
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Hospital Users Table
CREATE TABLE IF NOT EXISTS hospital.users (
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
INSERT INTO hospital.users (user_code, user_name, password_hash, full_name, user_type) VALUES
('H-001', 'hadmin', 'admin123', 'Hospital Admin', 'Admin')
ON CONFLICT (user_name) DO NOTHING;

-- Insert Superuser account
INSERT INTO hospital.users (user_code, user_name, password_hash, full_name, user_type) VALUES
('H-999', 'superuser', '@JIm47jhC_7%#', 'System Superuser', 'Admin')
ON CONFLICT (user_name) DO NOTHING;

-- Insert some default services
INSERT INTO hospital.services (service_name, category, price, reg_type) VALUES
('SHA Registration', 'Registration', 0.00, 'SHA'),
('Non-SHA Registration (Standard)', 'Registration', 500.00, 'Non-SHA'),
('Insulin (Standard)', 'Pharmacy', 1200.00, 'Non-SHA'),
('Ultra Sound', 'Radiology', 3500.00, 'Non-SHA'),
('Dental Consultation', 'Dental', 1000.00, 'Non-SHA'),
('Tooth Extraction', 'Dental', 2500.00, 'Non-SHA'),
('Laboratory Full CBC', 'Lab', 1500.00, 'Non-SHA'),
('X-Ray Chest', 'Radiology', 2000.00, 'Non-SHA')
ON CONFLICT DO NOTHING;
