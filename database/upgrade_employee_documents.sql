-- Module Documents employes
-- A executer sur les bases existantes avant d'utiliser l'import/export.

CREATE TABLE IF NOT EXISTS employee_documents (
  id SERIAL PRIMARY KEY,
  employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
  document_type VARCHAR(50) DEFAULT 'other' CHECK (document_type IN ('contract', 'diploma', 'id_card', 'cv', 'other')),
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT DEFAULT 0,
  mime_type VARCHAR(150),
  uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS document_type VARCHAR(50) DEFAULT 'other';
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS original_name VARCHAR(255);
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0;
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS mime_type VARCHAR(150);
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS uploaded_by INT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_documents' AND column_name = 'name'
  ) THEN
    UPDATE employee_documents SET file_name = COALESCE(file_name, name, 'document') WHERE file_name IS NULL;
  ELSE
    UPDATE employee_documents SET file_name = COALESCE(file_name, 'document') WHERE file_name IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_documents' AND column_name = 'type'
  ) THEN
    UPDATE employee_documents SET document_type = COALESCE(document_type, type, 'other') WHERE document_type IS NULL;
  ELSE
    UPDATE employee_documents SET document_type = COALESCE(document_type, 'other') WHERE document_type IS NULL;
  END IF;
END $$;

UPDATE employee_documents SET file_path = 'missing' WHERE file_path IS NULL;
ALTER TABLE employee_documents ALTER COLUMN file_name SET NOT NULL;
ALTER TABLE employee_documents ALTER COLUMN file_path SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employee_documents_employee_id ON employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_created_at ON employee_documents(created_at);
