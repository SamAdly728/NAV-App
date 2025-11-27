# NAV Productions Generic Data Webhook Guide

## 1. Authentication & Setup

### Security
- Every request **must** include the NAV webhook secret.
- Keep the value of `GHL_WEBHOOK_SECRET` private.
- Configure it in `.env` (and Render environment):

```bash
GHL_WEBHOOK_SECRET=your_secure_random_string
```

### Providing the Secret
1. **Preferred**: Header
   ```http
   x-webhook-secret: your_secure_random_string
   ```
2. Query parameter (fallback)
   ```
   https://your-app-url.com/webhooks/data/users?secret=your_secure_random_string
   ```

## 2. Endpoint Overview
- **Base URL**: `https://your-app-url.com`
- **Endpoint**: `/webhooks/data/:table`
- **Method**: `POST`
- **Content-Type**: `application/json`

You substitute `:table` with the target table name (examples below).

## 3. Data Integrity & Relationships
- Many tables use foreign keys.
- Create parent rows first and pass their IDs when inserting child rows.
- Example sequence:
  1. Create user → receive `id = 10`
  2. Create client `{ user_id: 10 }` → receive `id = 5`
  3. Create property `{ client_id: 5 }`

## 4. Table Reference & Payloads

### Group 1 – Core System

**roles** – `/webhooks/data/roles`
```json
{
  "name": "custom_manager",
  "permissions": {
    "projects": true,
    "finance": false
  }
}
```

**users** – `/webhooks/data/users`
```json
{
  "email": "john.doe@example.com",
  "password_hash": "$2b$10$...",
  "role_id": 3,
  "avatar_url": "https://example.com/avatar.jpg"
}
```

**clients** – `/webhooks/data/clients`
```json
{
  "user_id": 10,
  "company_name": "Acme Corp",
  "phone": "555-0123",
  "website_url": "https://acme.com",
  "notes": "VIP Client"
}
```

**notifications** – `/webhooks/data/notifications`
```json
{
  "user_id": 10,
  "type": "info",
  "title": "Welcome",
  "message": "Thanks for joining!",
  "is_read": false
}
```

**activity_logs** – `/webhooks/data/activity_logs`
```json
{
  "user_id": 10,
  "action_type": "login",
  "description": "User logged in from new IP"
}
```

### Group 2 – Properties & Catalog

**properties** – `/webhooks/data/properties`
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

**shoot_types** – `/webhooks/data/shoot_types`
```json
{
  "name": "HDR Photography",
  "description": "High dynamic range photos",
  "base_price": 150.00,
  "is_active": true
}
```

**shoot_addons** – `/webhooks/data/shoot_addons`
```json
{
  "name": "Twilight Edit",
  "description": "Day to dusk editing",
  "price": 50.00
}
```

### Group 3 – Bookings

**shoot_bookings** – `/webhooks/data/shoot_bookings`
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

**shoot_booking_addons** – `/webhooks/data/shoot_booking_addons`
```json
{
  "shoot_booking_id": 100,
  "addon_id": 2,
  "price": 50.00
}
```

### Group 4 – Projects & Deliverables

**projects** – `/webhooks/data/projects`
```json
{
  "shoot_booking_id": 100,
  "name": "123 Main St - HDR",
  "status": "in_progress",
  "assigned_lead_id": 2
}
```

**project_members** – `/webhooks/data/project_members`
```json
{
  "project_id": 50,
  "user_id": 2,
  "role_in_project": "editor"
}
```

**project_assets** – `/webhooks/data/project_assets`
```json
{
  "project_id": 50,
  "storage_provider": "s3",
  "storage_path": "/bucket/projects/50/final.jpg",
  "asset_type": "image",
  "is_final": true
}
```

**revisions** – `/webhooks/data/revisions`
```json
{
  "project_id": 50,
  "client_id": 5,
  "description": "Please brighten the kitchen photo",
  "status": "requested"
}
```

### Group 5 – Tasks

**tasks** – `/webhooks/data/tasks`
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

**tags** – `/webhooks/data/tags`
```json
{
  "name": "Urgent",
  "color": "#FF0000"
}
```

**task_tags** – `/webhooks/data/task_tags`
```json
{
  "task_id": 200,
  "tag_id": 1
}
```

### Group 6 – Tickets & Support

**ticket_statuses** – `/webhooks/data/ticket_statuses`
```json
{
  "name": "open",
  "label": "Open",
  "badge_class": "bg-success"
}
```

**ticket_priorities** – `/webhooks/data/ticket_priorities`
```json
{
  "name": "critical",
  "weight": 10,
  "badge_class": "bg-danger"
}
```

**ticket_categories** – `/webhooks/data/ticket_categories`
```json
{
  "name": "Billing",
  "description": "Payment and invoice issues"
}
```

**tickets** – `/webhooks/data/tickets`
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

**ticket_comments** – `/webhooks/data/ticket_comments`
```json
{
  "ticket_id": 500,
  "author_user_id": 2,
  "body": "We are looking into this now."
}
```

### Group 7 – Payments

**payments** – `/webhooks/data/payments`
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

---

## 5. Additional Tips
- Always send valid ISO8601 timestamps for `*_at` fields.
- Decimal fields expect numeric values; wrap them in quotes only if your client library requires strings.
- If the endpoint responds with a 4xx error, check foreign key values and required fields.
- Use the `/health` endpoint to confirm the service is online before bulk insertions.

For questions or new table support, contact the NAV Productions team.
