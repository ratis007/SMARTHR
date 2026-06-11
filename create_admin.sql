-- Mot de passe: SmartHR@2026
-- Hash bcrypt (cost 12): $2a$12$1uOlO/nGdpdzbIN4.EXYNu.FWRviaOzH4u1qbYCQzm9acbVB7pgbu

INSERT INTO users (email, password, first_name, last_name, is_active)
VALUES (
  'admin@smarthr.com',
  '$2a$12$1uOlO/nGdpdzbIN4.EXYNu.FWRviaOzH4u1qbYCQzm9acbVB7pgbu',
  'Admin',
  'SmartHR',
  true
)
ON CONFLICT (email) DO UPDATE
  SET password = EXCLUDED.password;
