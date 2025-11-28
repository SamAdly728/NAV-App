// Simple migration script to create required tables
const { pool } = require('../db/pool');

const sql = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'client',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS files (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  dropbox_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  stripe_session_id TEXT,
  status TEXT,
  amount INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  external_id TEXT,
  status TEXT,
  starts_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  all_day BOOLEAN DEFAULT FALSE,
  class_name VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  website_url VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ticket_statuses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  label VARCHAR(100) NOT NULL,
  badge_class VARCHAR(100),
  is_closed_state BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS ticket_priorities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  weight INT NOT NULL DEFAULT 1,
  badge_class VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS ticket_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  public_id VARCHAR(50) NOT NULL UNIQUE,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  project_id INTEGER,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status_id INTEGER REFERENCES ticket_statuses(id) ON DELETE RESTRICT,
  priority_id INTEGER REFERENCES ticket_priorities(id) ON DELETE RESTRICT,
  category_id INTEGER REFERENCES ticket_categories(id) ON DELETE SET NULL,
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  due_at TIMESTAMP WITH TIME ZONE
);

INSERT INTO ticket_statuses (name, label, badge_class, is_closed_state)
SELECT 'open', 'Open', 'text-outline-primary', FALSE
WHERE NOT EXISTS (SELECT 1 FROM ticket_statuses WHERE name = 'open');

INSERT INTO ticket_statuses (name, label, badge_class, is_closed_state)
SELECT 'in_progress', 'In Progress', 'text-outline-success', FALSE
WHERE NOT EXISTS (SELECT 1 FROM ticket_statuses WHERE name = 'in_progress');

INSERT INTO ticket_statuses (name, label, badge_class, is_closed_state)
SELECT 'closed', 'Closed', 'text-outline-secondary', TRUE
WHERE NOT EXISTS (SELECT 1 FROM ticket_statuses WHERE name = 'closed');

INSERT INTO ticket_priorities (name, weight, badge_class)
SELECT 'low', 1, 'text-outline-secondary'
WHERE NOT EXISTS (SELECT 1 FROM ticket_priorities WHERE name = 'low');

INSERT INTO ticket_priorities (name, weight, badge_class)
SELECT 'medium', 2, 'text-outline-warning'
WHERE NOT EXISTS (SELECT 1 FROM ticket_priorities WHERE name = 'medium');

INSERT INTO ticket_priorities (name, weight, badge_class)
SELECT 'high', 3, 'text-outline-danger'
WHERE NOT EXISTS (SELECT 1 FROM ticket_priorities WHERE name = 'high');

INSERT INTO ticket_categories (name, description)
SELECT 'general', 'General inquiries'
WHERE NOT EXISTS (SELECT 1 FROM ticket_categories WHERE name = 'general');

INSERT INTO ticket_categories (name, description)
SELECT 'billing', 'Billing or invoicing issues'
WHERE NOT EXISTS (SELECT 1 FROM ticket_categories WHERE name = 'billing');

INSERT INTO ticket_categories (name, description)
SELECT 'technical', 'Technical support requests'
WHERE NOT EXISTS (SELECT 1 FROM ticket_categories WHERE name = 'technical');

CREATE TABLE IF NOT EXISTS session (
  sid varchar NOT NULL COLLATE "default",
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'session_pkey'
      AND conrelid = 'session'::regclass
  ) THEN
    ALTER TABLE session ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);
`;

async function run() {
  try {
    await pool.query(sql);
    console.log('Migration completed');
  } catch (e) {
    console.error('Migration failed', e);
  } finally {
    await pool.end();
  }
}

run();
