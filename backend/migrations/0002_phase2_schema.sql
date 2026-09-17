-- Phase 2+ schema — see docs/ARCHITECTURE.md section 4.2.
-- These tables exist so the schema does not need to change later, but there
-- is intentionally no handler/route/UI for them in v1.

CREATE TABLE IF NOT EXISTS lesson_plans (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  class_id     UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  week_start   DATE,
  topic        TEXT,
  content      TEXT,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected')),
  created_by   UUID REFERENCES users(id),
  approved_by  UUID REFERENCES users(id),
  approved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lesson_plans_tenant_id_idx ON lesson_plans (tenant_id);

CREATE TABLE IF NOT EXISTS development_assessments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  period        TEXT,
  domain        TEXT,
  score         TEXT,
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved')),
  assessed_by   UUID REFERENCES users(id),
  approved_by   UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS development_assessments_tenant_id_idx ON development_assessments (tenant_id);
CREATE INDEX IF NOT EXISTS development_assessments_student_id_idx ON development_assessments (student_id);

CREATE TABLE IF NOT EXISTS health_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  measured_at  DATE,
  height_cm    NUMERIC(5,2),
  weight_kg    NUMERIC(5,2),
  note         TEXT,
  recorded_by  UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS health_records_tenant_id_idx ON health_records (tenant_id);
CREATE INDEX IF NOT EXISTS health_records_student_id_idx ON health_records (student_id);

CREATE TABLE IF NOT EXISTS vaccination_records (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  vaccine_name   TEXT NOT NULL,
  dose_number    INT,
  administered_at DATE,
  note           TEXT,
  recorded_by    UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vaccination_records_tenant_id_idx ON vaccination_records (tenant_id);
CREATE INDEX IF NOT EXISTS vaccination_records_student_id_idx ON vaccination_records (student_id);

CREATE TABLE IF NOT EXISTS medical_incidents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  occurred_at  TIMESTAMPTZ,
  type         TEXT,
  description  TEXT,
  action_taken TEXT,
  recorded_by  UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS medical_incidents_tenant_id_idx ON medical_incidents (tenant_id);
CREATE INDEX IF NOT EXISTS medical_incidents_student_id_idx ON medical_incidents (student_id);

CREATE TABLE IF NOT EXISTS menus (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  meal        TEXT CHECK (meal IN ('breakfast','lunch','snack')),
  items       JSONB NOT NULL DEFAULT '[]',
  calories    NUMERIC(6,2),
  note        TEXT,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS menus_tenant_id_idx ON menus (tenant_id);

CREATE TABLE IF NOT EXISTS leave_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  requested_by  UUID REFERENCES users(id),
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  reason        TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_by   UUID REFERENCES users(id),
  approved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leave_requests_tenant_id_idx ON leave_requests (tenant_id);
CREATE INDEX IF NOT EXISTS leave_requests_student_id_idx ON leave_requests (student_id);

CREATE TABLE IF NOT EXISTS conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id    UUID NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  teacher_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversations_tenant_id_idx ON conversations (tenant_id);

CREATE TABLE IF NOT EXISTS messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_user_id   UUID NOT NULL REFERENCES users(id),
  content          TEXT NOT NULL,
  read_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_tenant_id_idx ON messages (tenant_id);
CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages (conversation_id);

CREATE TABLE IF NOT EXISTS fee_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  school_year_id UUID REFERENCES school_years(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_recurring   BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fee_items_tenant_id_idx ON fee_items (tenant_id);

CREATE TABLE IF NOT EXISTS invoices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  period       TEXT,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','partial','paid','void')),
  due_date     DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoices_tenant_id_idx ON invoices (tenant_id);
CREATE INDEX IF NOT EXISTS invoices_student_id_idx ON invoices (student_id);

CREATE TABLE IF NOT EXISTS payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount      NUMERIC(12,2) NOT NULL,
  method      TEXT,
  paid_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_tenant_id_idx ON payments (tenant_id);
CREATE INDEX IF NOT EXISTS payments_invoice_id_idx ON payments (invoice_id);

CREATE TABLE IF NOT EXISTS staff_profiles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position       TEXT,
  hired_at       DATE,
  base_salary    NUMERIC(12,2),
  contract_type  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS staff_profiles_tenant_id_idx ON staff_profiles (tenant_id);

CREATE TABLE IF NOT EXISTS staff_attendance (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  check_in     TIMESTAMPTZ,
  check_out    TIMESTAMPTZ,
  status       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, date)
);
CREATE INDEX IF NOT EXISTS staff_attendance_tenant_id_idx ON staff_attendance (tenant_id);

CREATE TABLE IF NOT EXISTS extracurricular_activities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  schedule     TEXT,
  fee          NUMERIC(12,2) DEFAULT 0,
  teacher_user_id UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS extracurricular_activities_tenant_id_idx ON extracurricular_activities (tenant_id);

CREATE TABLE IF NOT EXISTS activity_enrollments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  activity_id  UUID NOT NULL REFERENCES extracurricular_activities(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered','confirmed','cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (activity_id, student_id)
);
CREATE INDEX IF NOT EXISTS activity_enrollments_tenant_id_idx ON activity_enrollments (tenant_id);

CREATE TABLE IF NOT EXISTS inventory_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  quantity     INT NOT NULL DEFAULT 0,
  unit         TEXT,
  location     TEXT,
  condition    TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_items_tenant_id_idx ON inventory_items (tenant_id);
