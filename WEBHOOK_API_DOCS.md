# NAV Productions Webhook API Documentation

This comprehensive guide details how to use the NAV Productions Generic Data Webhook to programmatically insert data into the application's database. It includes authentication instructions, endpoint usage, and specific JSON payload examples for every supported table.

---

## 1. Authentication & Setup

### Security
All requests must be authenticated. You must provide your **Webhook Secret** to authorize the request.

**Server Configuration:**
Ensure the `GHL_WEBHOOK_SECRET` is set in your `.env` file:
```bash
GHL_WEBHOOK_SECRET=your_secure_random_string
```

### How to Authenticate
You can pass the secret in one of two ways:

**Method 1: Header (Best Practice)**
```http
x-webhook-secret: your_secure_random_string
```

**Method 2: Query Parameter**
```http
?secret=your_secure_random_string
```

---

## 2. API Endpoint

**Base URL:** `https://your-app-url.com`
**Endpoint:** `/webhooks/data/:table`
**Method:** `POST`
**Content-Type:** `application/json`

Replace `:table` with the name of the table you wish to write to (see examples below).

---

## 3. Data Integrity & Relationships
> [!IMPORTANT]
> **Foreign Keys:** Many tables depend on others (e.g., you cannot create a `client` without a `user_id`). Ensure you create the parent records first and use their IDs in the child records.

**Order of Operations Example:**
1. Create a **User** -> Get `id` (e.g., 10)
2. Create a **Client** using `user_id: 10` -> Get `id` (e.g., 5)
3. Create a **Property** using `client_id: 5`

---

## 4. Table Reference & Examples

### Group 1: Core System

#### 1. `roles`
Defines user roles and permissions.
- **Endpoint:** `/webhooks/data/roles`
```json
{
  "name": "custom_manager",
  "permissions": {
    "projects": true,
    "finance": false
  }
}
```

#### 2. `users`
The main user accounts.
- **Endpoint:** `/webhooks/data/users`
```json
{
  "email": "john.doe@example.com",
  "password_hash": "$2b$10$...", 
  "role_id": 3, 
  "avatar_url": "https://example.com/avatar.jpg"
}
```
*(Note: `role_id` must reference an existing ID from the `roles` table)*

#### 3. `clients`
Profiles for clients, linked to a user account.
- **Endpoint:** `/webhooks/data/clients`
```json
{
  "user_id": 10,
  "company_name": "Acme Corp",
  "phone": "555-0123",
  "website_url": "https://acme.com",
  "notes": "VIP Client"
}
```

#### 4. `notifications`
System notifications for users.
- **Endpoint:** `/webhooks/data/notifications`
```json
{
  "user_id": 10,
  "type": "info",
  "title": "Welcome",
  "message": "Thanks for joining!",
  "is_read": false
}
```

#### 5. `activity_logs`
Logs of user actions.
- **Endpoint:** `/webhooks/data/activity_logs`
```json
{
  "user_id": 10,
  "action_type": "login",
  "description": "User logged in from new IP"
}
```

---

### Group 2: Properties & Catalog

#### 6. `properties`
Real estate properties belonging to a client.
- **Endpoint:** `/webhooks/data/properties`
```json
{
  "client_id": 5,
  "label": "Downtown Loft",
  "address_line1": "123 Main St",
  "city": "New York",
  "state": "NY",
  "postal_code": "10001",
  "sqft": 1200,
  "bedrooms": 2,
  "bathrooms": 2.0
}
```

#### 7. `shoot_types`
Catalog of services (e.g., HDR Photography, Drone).
- **Endpoint:** `/webhooks/data/shoot_types`
```json
{
  "name": "HDR Photography",
  "description": "High dynamic range photos",
  "base_price": 150.00,
  "is_active": true
}
```

#### 8. `shoot_addons`
Extra services (e.g., Twilight Edit).
- **Endpoint:** `/webhooks/data/shoot_addons`
```json
{
  "name": "Twilight Edit",
  "description": "Day to dusk editing",
  "price": 50.00
}
```

---

### Group 3: Bookings

#### 9. `shoot_bookings`
The main booking record.
- **Endpoint:** `/webhooks/data/shoot_bookings`
```json
{
  "client_id": 5,
  "property_id": 20,
  "shoot_type_id": 1,
  "scheduled_start": "2023-12-01T10:00:00Z",
  "scheduled_end": "2023-12-01T12:00:00Z",
  "status": "confirmed",
  "total_amount": 200.00
}
```

#### 10. `shoot_booking_addons`
Linking addons to a specific booking.
- **Endpoint:** `/webhooks/data/shoot_booking_addons`
```json
{
  "shoot_booking_id": 100,
  "addon_id": 2,
  "price": 50.00
}
```

---

### Group 4: Projects & Deliverables

#### 11. `projects`
Manages the post-production workflow for a booking.
- **Endpoint:** `/webhooks/data/projects`
```json
{
  "shoot_booking_id": 100,
  "name": "123 Main St - HDR",
  "status": "in_progress",
  "assigned_lead_id": 2
}
```

#### 12. `project_members`
Team members assigned to a project.
- **Endpoint:** `/webhooks/data/project_members`
```json
{
  "project_id": 50,
  "user_id": 2,
  "role_in_project": "editor"
}
```

#### 13. `project_assets`
Files and deliverables (photos, videos).
- **Endpoint:** `/webhooks/data/project_assets`
```json
{
  "project_id": 50,
  "storage_provider": "s3",
  "storage_path": "/bucket/projects/50/final.jpg",
  "asset_type": "image",
  "is_final": true
}
```

#### 14. `revisions`
Client revision requests.
- **Endpoint:** `/webhooks/data/revisions`
```json
{
  "project_id": 50,
  "client_id": 5,
  "description": "Please brighten the kitchen photo",
  "status": "requested"
}
```

---

### Group 5: Tasks

#### 15. `tasks`
Internal tasks for team members.
- **Endpoint:** `/webhooks/data/tasks`
```json
{
  "project_id": 50,
  "title": "Edit Kitchen Photos",
  "description": "Apply color correction",
  "status": "todo",
  "assigned_to": 2,
  "priority": "high"
}
```

#### 16. `tags`
Tags for categorizing tasks.
- **Endpoint:** `/webhooks/data/tags`
```json
{
  "name": "Urgent",
  "color": "#FF0000"
}
```

#### 17. `task_tags`
Linking tags to tasks.
- **Endpoint:** `/webhooks/data/task_tags`
```json
{
  "task_id": 200,
  "tag_id": 1
}
```

---

### Group 6: Tickets (Support)

#### 18. `ticket_statuses`
Custom statuses for tickets.
- **Endpoint:** `/webhooks/data/ticket_statuses`
```json
{
  "name": "open",
  "label": "Open",
  "badge_class": "bg-success"
}
```

#### 19. `ticket_priorities`
- **Endpoint:** `/webhooks/data/ticket_priorities`
```json
{
  "name": "critical",
  "weight": 10,
  "badge_class": "bg-danger"
}
```

#### 20. `ticket_categories`
- **Endpoint:** `/webhooks/data/ticket_categories`
```json
{
  "name": "Billing",
  "description": "Payment and invoice issues"
}
```

#### 21. `tickets`
Support tickets.
- **Endpoint:** `/webhooks/data/tickets`
```json
{
  "public_id": "TICKET-1001",
  "client_id": 5,
  "title": "Cannot download photos",
  "description": "Link gives 404 error",
  "status_id": 1,
  "priority_id": 2,
  "category_id": 1,
  "created_by_user_id": 10
}
```

#### 22. `ticket_comments`
Comments on tickets.
- **Endpoint:** `/webhooks/data/ticket_comments`
```json
{
  "ticket_id": 500,
  "author_user_id": 2,
  "body": "We are looking into this now."
}
```

---

### Group 7: Payments

#### 23. `payments`
Payment records.
- **Endpoint:** `/webhooks/data/payments`
```json
{
  "shoot_booking_id": 100,
  "provider": "stripe",
  "provider_transaction_id": "ch_123456789",
  "amount": 200.00,
  "currency": "USD",
  "status": "succeeded"
}
```
