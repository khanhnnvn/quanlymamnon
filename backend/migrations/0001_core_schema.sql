-- Core schema (v1) — see docs/ARCHITECTURE.md section 4.1

CREATE TABLE IF NOT EXISTS tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  address       TEXT,
  phone         TEXT,
  email         TEXT,
  logo_url      TEXT,
  plan          TEXT NOT NULL DEFAULT 'basic',
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','active','suspended','archived')),
  settings      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email               TEXT NOT NULL,
  phone               TEXT,
  password_hash       TEXT NOT NULL,
  full_name           TEXT NOT NULL,
  avatar_url          TEXT,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  failed_login_count  INT NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ NULL,
  refresh_token_hash  TEXT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- UNIQUE(tenant_id, email): NULLs are distinct in a plain unique index, so use
-- partial unique indexes to cover both the tenant-scoped case and the
-- tenant_id IS NULL (super admin) case explicitly.
CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_email_uniq
  ON users (tenant_id, email) WHERE tenant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_super_admin_email_uniq
  ON users (email) WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS users_tenant_id_idx ON users (tenant_id);

CREATE TABLE IF NOT EXISTS roles (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code  TEXT NOT NULL UNIQUE,
  name  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id    UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  tenant_id  UUID NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id)
);
CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON user_roles (user_id);
CREATE INDEX IF NOT EXISTS user_roles_tenant_id_idx ON user_roles (tenant_id);

CREATE TABLE IF NOT EXISTS school_years (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  is_current  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS school_years_tenant_id_idx ON school_years (tenant_id);

CREATE TABLE IF NOT EXISTS grades (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS grades_tenant_id_idx ON grades (tenant_id);

CREATE TABLE IF NOT EXISTS classes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  school_year_id UUID NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
  grade_id       UUID NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  capacity       INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS classes_tenant_id_idx ON classes (tenant_id);
CREATE INDEX IF NOT EXISTS classes_school_year_id_idx ON classes (school_year_id);
CREATE INDEX IF NOT EXISTS classes_grade_id_idx ON classes (grade_id);

CREATE TABLE IF NOT EXISTS class_teachers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  class_id       UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_in_class  TEXT NOT NULL CHECK (role_in_class IN ('main','assistant')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, user_id)
);
CREATE INDEX IF NOT EXISTS class_teachers_tenant_id_idx ON class_teachers (tenant_id);
CREATE INDEX IF NOT EXISTS class_teachers_user_id_idx ON class_teachers (user_id);

CREATE TABLE IF NOT EXISTS students (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name         TEXT NOT NULL,
  dob               DATE,
  gender            TEXT,
  avatar_url        TEXT,
  current_class_id  UUID NULL REFERENCES classes(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'enrolled'
                      CHECK (status IN ('enrolled','on_leave','withdrawn')),
  enrollment_date   DATE,
  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS students_tenant_id_idx ON students (tenant_id);
CREATE INDEX IF NOT EXISTS students_current_class_id_idx ON students (current_class_id);

CREATE TABLE IF NOT EXISTS student_parents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id          UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship        TEXT,
  is_primary_contact  BOOLEAN NOT NULL DEFAULT false,
  can_pickup          BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, parent_user_id)
);
CREATE INDEX IF NOT EXISTS student_parents_tenant_id_idx ON student_parents (tenant_id);
CREATE INDEX IF NOT EXISTS student_parents_parent_user_id_idx ON student_parents (parent_user_id);

CREATE TABLE IF NOT EXISTS attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id        UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('present','absent','late','excused')),
  check_in_time   TIMESTAMPTZ NULL,
  check_out_time  TIMESTAMPTZ NULL,
  picked_up_by    TEXT NULL,
  note            TEXT,
  recorded_by     UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, student_id, date)
);
CREATE INDEX IF NOT EXISTS attendance_tenant_id_idx ON attendance (tenant_id);
CREATE INDEX IF NOT EXISTS attendance_class_id_date_idx ON attendance (class_id, date);
CREATE INDEX IF NOT EXISTS attendance_student_id_idx ON attendance (student_id);

CREATE TABLE IF NOT EXISTS daily_journals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id  UUID NULL REFERENCES students(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  content     TEXT NOT NULL,
  photo_urls  JSONB NOT NULL DEFAULT '[]',
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS daily_journals_tenant_id_idx ON daily_journals (tenant_id);
CREATE INDEX IF NOT EXISTS daily_journals_class_id_date_idx ON daily_journals (class_id, date);
CREATE INDEX IF NOT EXISTS daily_journals_student_id_idx ON daily_journals (student_id);

CREATE TABLE IF NOT EXISTS announcements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  audience      TEXT NOT NULL CHECK (audience IN ('school','grade','class')),
  grade_id      UUID NULL REFERENCES grades(id) ON DELETE CASCADE,
  class_id      UUID NULL REFERENCES classes(id) ON DELETE CASCADE,
  is_urgent     BOOLEAN NOT NULL DEFAULT false,
  created_by    UUID NOT NULL REFERENCES users(id),
  published_at  TIMESTAMPTZ NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS announcements_tenant_id_idx ON announcements (tenant_id);
CREATE INDEX IF NOT EXISTS announcements_class_id_idx ON announcements (class_id);
CREATE INDEX IF NOT EXISTS announcements_grade_id_idx ON announcements (grade_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_id   UUID NULL,
  meta        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_tenant_id_idx ON audit_logs (tenant_id);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs (entity, entity_id);
