-- =========================================
-- NAV Productions Complete Database Schema
-- =========================================

-- =========================================
-- GROUP 1 – CORE SYSTEM
-- =========================================

-- Create roles table first
CREATE TABLE IF NOT EXISTS roles (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name         VARCHAR(50) NOT NULL UNIQUE,
    permissions  JSONB NULL
);

-- Insert default roles
INSERT INTO roles (name, permissions) VALUES 
    ('admin', '{"all": true}'::jsonb),
    ('nav_staff', '{"projects": true, "tickets": true}'::jsonb),
    ('client', '{"view_own": true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Migrate existing users table structure (preserving all data)
DO $$
BEGIN
    -- Add role_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role_id') THEN
        ALTER TABLE users ADD COLUMN role_id BIGINT;
        
        -- Populate role_id from old role column
        UPDATE users SET role_id = (
            CASE 
                WHEN role = 'admin' THEN (SELECT id FROM roles WHERE name = 'admin')
                WHEN role = 'client' THEN (SELECT id FROM roles WHERE name = 'client')
                ELSE (SELECT id FROM roles WHERE name = 'nav_staff')
            END
        );
        
        -- Make role_id NOT NULL after populating
        ALTER TABLE users ALTER COLUMN role_id SET NOT NULL;
        
        -- Add foreign key constraint
        ALTER TABLE users ADD CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id);
        
        -- Drop old role column if it exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role' AND data_type = 'character varying') THEN
            ALTER TABLE users DROP COLUMN role;
        END IF;
    END IF;
    
    -- Add avatar_url column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'avatar_url') THEN
        ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500);
    END IF;
    
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'updated_at') THEN
        ALTER TABLE users ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS clients (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       BIGINT NOT NULL,
    company_name  VARCHAR(255) NOT NULL,
    phone         VARCHAR(50),
    website_url   VARCHAR(255),
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_clients_user
        FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notifications (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       BIGINT NOT NULL,
    type          VARCHAR(100) NOT NULL,
    title         VARCHAR(255) NOT NULL,
    message       TEXT NOT NULL,
    related_type  VARCHAR(100),
    related_id    BIGINT,
    is_read       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at       TIMESTAMPTZ,
    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS activity_logs (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       BIGINT,
    action_type   VARCHAR(100) NOT NULL,
    description   TEXT NOT NULL,
    related_type  VARCHAR(100),
    related_id    BIGINT,
    occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_activity_logs_user
        FOREIGN KEY (user_id) REFERENCES users(id)
);

-- =========================================
-- GROUP 2 – PROPERTIES & CATALOG
-- =========================================

CREATE TABLE IF NOT EXISTS properties (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_id      BIGINT NOT NULL,
    label          VARCHAR(255) NOT NULL,
    address_line1  VARCHAR(255) NOT NULL,
    address_line2  VARCHAR(255),
    city           VARCHAR(100) NOT NULL,
    state          VARCHAR(100) NOT NULL,
    postal_code    VARCHAR(20) NOT NULL,
    property_type  VARCHAR(50),
    sqft           INT,
    bedrooms       INT,
    bathrooms      NUMERIC(3,1),
    notes          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_properties_client
        FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE TABLE IF NOT EXISTS shoot_types (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    description  TEXT,
    base_price   NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shoot_addons (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    description  TEXT,
    price        NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================
-- GROUP 3 – BOOKINGS & SCHEDULE
-- =========================================

CREATE TABLE IF NOT EXISTS shoot_bookings (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_id          BIGINT NOT NULL,
    property_id        BIGINT NOT NULL,
    shoot_type_id      BIGINT NOT NULL,
    ghl_appointment_id VARCHAR(255),
    scheduled_start    TIMESTAMPTZ NOT NULL,
    scheduled_end      TIMESTAMPTZ NOT NULL,
    status             VARCHAR(50) NOT NULL DEFAULT 'pending',
    payment_status     VARCHAR(50) NOT NULL DEFAULT 'unpaid',
    subtotal_amount    NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_amount       NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_shoot_bookings_client
        FOREIGN KEY (client_id) REFERENCES clients(id),
    CONSTRAINT fk_shoot_bookings_property
        FOREIGN KEY (property_id) REFERENCES properties(id),
    CONSTRAINT fk_shoot_bookings_shoot_type
        FOREIGN KEY (shoot_type_id) REFERENCES shoot_types(id)
);

CREATE TABLE IF NOT EXISTS shoot_booking_addons (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shoot_booking_id  BIGINT NOT NULL,
    addon_id          BIGINT NOT NULL,
    price             NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT fk_booking_addons_booking
        FOREIGN KEY (shoot_booking_id) REFERENCES shoot_bookings(id),
    CONSTRAINT fk_booking_addons_addon
        FOREIGN KEY (addon_id) REFERENCES shoot_addons(id)
);

CREATE TABLE IF NOT EXISTS events (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT NOT NULL,
    title       VARCHAR(255) NOT NULL,
    start_time  TIMESTAMPTZ NOT NULL,
    end_time    TIMESTAMPTZ,
    all_day     BOOLEAN NOT NULL DEFAULT FALSE,
    class_name  VARCHAR(50),
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_events_user
        FOREIGN KEY (user_id) REFERENCES users(id)
);

-- =========================================
-- GROUP 4 – PROJECTS & DELIVERABLES
-- =========================================

CREATE TABLE IF NOT EXISTS projects (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shoot_booking_id BIGINT NOT NULL,
    name             VARCHAR(255) NOT NULL,
    status           VARCHAR(50) NOT NULL DEFAULT 'in_preproduction',
    assigned_lead_id BIGINT,
    started_at       TIMESTAMPTZ,
    delivered_at     TIMESTAMPTZ,
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_projects_booking
        FOREIGN KEY (shoot_booking_id) REFERENCES shoot_bookings(id),
    CONSTRAINT fk_projects_lead
        FOREIGN KEY (assigned_lead_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS project_members (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id      BIGINT NOT NULL,
    user_id         BIGINT NOT NULL,
    role_in_project VARCHAR(100),
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_project_members_project
        FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_project_members_user
        FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS project_assets (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id       BIGINT NOT NULL,
    storage_provider VARCHAR(50) NOT NULL,
    storage_path     VARCHAR(1000) NOT NULL,
    asset_type       VARCHAR(50) NOT NULL,
    is_final         BOOLEAN NOT NULL DEFAULT FALSE,
    label            VARCHAR(255),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_project_assets_project
        FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS revisions (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id   BIGINT NOT NULL,
    client_id    BIGINT NOT NULL,
    description  TEXT NOT NULL,
    status       VARCHAR(50) NOT NULL DEFAULT 'requested',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_revisions_project
        FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_revisions_client
        FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- =========================================
-- GROUP 5 – INTERNAL TASKS
-- =========================================

CREATE TABLE IF NOT EXISTS tasks (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id  BIGINT,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    status      VARCHAR(50) NOT NULL DEFAULT 'todo',
    assigned_to BIGINT,
    start_date  TIMESTAMPTZ,
    due_date    TIMESTAMPTZ,
    priority    VARCHAR(50) NOT NULL DEFAULT 'medium',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_tasks_project
        FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_tasks_user
        FOREIGN KEY (assigned_to) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tags (
    id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name  VARCHAR(100) NOT NULL,
    color VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS task_tags (
    id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_id  BIGINT NOT NULL,
    tag_id   BIGINT NOT NULL,
    CONSTRAINT fk_task_tags_task
        FOREIGN KEY (task_id) REFERENCES tasks(id),
    CONSTRAINT fk_task_tags_tag
        FOREIGN KEY (tag_id) REFERENCES tags(id)
);

-- =========================================
-- GROUP 6 – TICKETS & SUPPORT
-- =========================================

CREATE TABLE IF NOT EXISTS ticket_statuses (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            VARCHAR(50) NOT NULL,
    label           VARCHAR(100) NOT NULL,
    badge_class     VARCHAR(100),
    is_closed_state BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS ticket_priorities (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(50) NOT NULL,
    weight      INT NOT NULL DEFAULT 1,
    badge_class VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS ticket_categories (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS tickets (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id           VARCHAR(50) NOT NULL UNIQUE,
    client_id           BIGINT NOT NULL,
    project_id          BIGINT,
    title               VARCHAR(255) NOT NULL,
    description         TEXT NOT NULL,
    status_id           BIGINT NOT NULL,
    priority_id         BIGINT NOT NULL,
    category_id         BIGINT NOT NULL,
    created_by_user_id  BIGINT NOT NULL,
    assigned_to_user_id BIGINT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_at              TIMESTAMPTZ,
    closed_at           TIMESTAMPTZ,
    last_updated        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_tickets_client
        FOREIGN KEY (client_id) REFERENCES clients(id),
    CONSTRAINT fk_tickets_project
        FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_tickets_status
        FOREIGN KEY (status_id) REFERENCES ticket_statuses(id),
    CONSTRAINT fk_tickets_priority
        FOREIGN KEY (priority_id) REFERENCES ticket_priorities(id),
    CONSTRAINT fk_tickets_category
        FOREIGN KEY (category_id) REFERENCES ticket_categories(id),
    CONSTRAINT fk_tickets_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users(id),
    CONSTRAINT fk_tickets_assigned_to
        FOREIGN KEY (assigned_to_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS ticket_comments (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ticket_id      BIGINT NOT NULL,
    author_user_id BIGINT NOT NULL,
    body           TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_ticket_comments_ticket
        FOREIGN KEY (ticket_id) REFERENCES tickets(id),
    CONSTRAINT fk_ticket_comments_author
        FOREIGN KEY (author_user_id) REFERENCES users(id)
);

-- Seed default ticket metadata
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

-- =========================================
-- GROUP 7 – PAYMENTS
-- =========================================

CREATE TABLE IF NOT EXISTS payments (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shoot_booking_id        BIGINT NOT NULL,
    provider                VARCHAR(50) NOT NULL,
    provider_transaction_id VARCHAR(255) NOT NULL,
    amount                  NUMERIC(10,2) NOT NULL,
    currency                VARCHAR(10) NOT NULL DEFAULT 'USD',
    status                  VARCHAR(50) NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_payments_booking
        FOREIGN KEY (shoot_booking_id) REFERENCES shoot_bookings(id)
);

-- =========================================
-- INDEXES FOR PERFORMANCE
-- =========================================

DO $$
BEGIN
    -- Core system indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_email') THEN
        CREATE INDEX idx_users_email ON users(email);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_role_id') THEN
        CREATE INDEX idx_users_role_id ON users(role_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_clients_user_id') THEN
        CREATE INDEX idx_clients_user_id ON clients(user_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notifications_user_id') THEN
        CREATE INDEX idx_notifications_user_id ON notifications(user_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notifications_is_read') THEN
        CREATE INDEX idx_notifications_is_read ON notifications(is_read);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_logs') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_activity_logs_user_id') THEN
        CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_logs') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_activity_logs_occurred_at') THEN
        CREATE INDEX idx_activity_logs_occurred_at ON activity_logs(occurred_at);
    END IF;
    
    -- Properties indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'properties') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_properties_client_id') THEN
        CREATE INDEX idx_properties_client_id ON properties(client_id);
    END IF;
    
    -- Bookings indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shoot_bookings') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_shoot_bookings_client_id') THEN
        CREATE INDEX idx_shoot_bookings_client_id ON shoot_bookings(client_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shoot_bookings') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_shoot_bookings_property_id') THEN
        CREATE INDEX idx_shoot_bookings_property_id ON shoot_bookings(property_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shoot_bookings') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_shoot_bookings_status') THEN
        CREATE INDEX idx_shoot_bookings_status ON shoot_bookings(status);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shoot_bookings') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_shoot_bookings_scheduled_start') THEN
        CREATE INDEX idx_shoot_bookings_scheduled_start ON shoot_bookings(scheduled_start);
    END IF;

    -- Events indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'events') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_events_user_id') THEN
        CREATE INDEX idx_events_user_id ON events(user_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'events') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_events_start_time') THEN
        CREATE INDEX idx_events_start_time ON events(start_time);
    END IF;
    
    -- Projects indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_projects_shoot_booking_id') THEN
        CREATE INDEX idx_projects_shoot_booking_id ON projects(shoot_booking_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_projects_status') THEN
        CREATE INDEX idx_projects_status ON projects(status);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_members') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_project_members_project_id') THEN
        CREATE INDEX idx_project_members_project_id ON project_members(project_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_members') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_project_members_user_id') THEN
        CREATE INDEX idx_project_members_user_id ON project_members(user_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_assets') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_project_assets_project_id') THEN
        CREATE INDEX idx_project_assets_project_id ON project_assets(project_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revisions') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_revisions_project_id') THEN
        CREATE INDEX idx_revisions_project_id ON revisions(project_id);
    END IF;
    
    -- Tasks indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tasks_project_id') THEN
        CREATE INDEX idx_tasks_project_id ON tasks(project_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tasks_assigned_to') THEN
        CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tasks_status') THEN
        CREATE INDEX idx_tasks_status ON tasks(status);
    END IF;
    
    -- Tickets indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tickets') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tickets_client_id') THEN
        CREATE INDEX idx_tickets_client_id ON tickets(client_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tickets') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tickets_status_id') THEN
        CREATE INDEX idx_tickets_status_id ON tickets(status_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tickets') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tickets_assigned_to_user_id') THEN
        CREATE INDEX idx_tickets_assigned_to_user_id ON tickets(assigned_to_user_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ticket_comments') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ticket_comments_ticket_id') THEN
        CREATE INDEX idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
    END IF;
    
    -- Payments indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'shoot_booking_id') AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payments_shoot_booking_id') THEN
            CREATE INDEX idx_payments_shoot_booking_id ON payments(shoot_booking_id);
        END IF;
    END IF;
END $$;

-- =========================================
-- TRIGGER FOR AUTO-UPDATING updated_at
-- =========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at') THEN
        CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_clients_updated_at') THEN
        CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_properties_updated_at') THEN
        CREATE TRIGGER trg_properties_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_shoot_types_updated_at') THEN
        CREATE TRIGGER trg_shoot_types_updated_at BEFORE UPDATE ON shoot_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_shoot_addons_updated_at') THEN
        CREATE TRIGGER trg_shoot_addons_updated_at BEFORE UPDATE ON shoot_addons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_shoot_bookings_updated_at') THEN
        CREATE TRIGGER trg_shoot_bookings_updated_at BEFORE UPDATE ON shoot_bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_projects_updated_at') THEN
        CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tasks_updated_at') THEN
        CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payments_updated_at') THEN
        CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
