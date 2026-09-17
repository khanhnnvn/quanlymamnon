-- Seed the 12 fixed roles — see docs/ARCHITECTURE.md section 3.
-- Idempotent: safe to re-run.

INSERT INTO roles (code, name) VALUES
  ('SUPER_ADMIN',        'Quản trị hệ thống'),
  ('SCHOOL_ADMIN',       'Hiệu trưởng'),
  ('VICE_ADMIN',         'Hiệu phó'),
  ('HEAD_TEACHER',       'Tổ trưởng chuyên môn'),
  ('TEACHER',            'Giáo viên chính'),
  ('ASSISTANT_TEACHER',  'Giáo viên phụ/Trợ giảng'),
  ('ACCOUNTANT',         'Kế toán'),
  ('NURSE',              'Y tế'),
  ('COOK',               'Cấp dưỡng'),
  ('SECURITY',           'Bảo vệ'),
  ('OFFICE_STAFF',       'Văn thư/Nhân viên khác'),
  ('PARENT',             'Phụ huynh')
ON CONFLICT (code) DO NOTHING;
