-- Add type column to categories table for separating automotive from cleaning categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'limpeza';

-- Add technical fields for automotive products
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS action_type TEXT,
  ADD COLUMN IF NOT EXISTS ph_level TEXT,
  ADD COLUMN IF NOT EXISTS application_area TEXT;