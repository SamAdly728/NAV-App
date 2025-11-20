-- Migration: Create bookings table
-- Run with: PGPASSWORD=FnndQlTPxlhcnJcMk4hEB537gu12Xkk2 psql -h dpg-d465ji4hg0os73ebpqv0-a.oregon-postgres.render.com -U nav_productions_db_user nav_productions_db -f create_bookings_table.sql

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  contact_name VARCHAR(255),
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  status VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Optional: create index on status and start_time for faster queries
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON bookings(start_time);

-- Success message
SELECT 'Bookings table created successfully!' AS message;
