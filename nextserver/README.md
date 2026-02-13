# KoDo Mobile Backend

API + WebSocket server for the KoDo React Native mobile app.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server (custom server with Socket.io)
npm run dev

# Server runs on http://localhost:3002
```

## Architecture

- **Port**: 3002
- **Framework**: Next.js 16 (API Routes) + custom server
- **Database**: Supabase (PostgreSQL)
- **Real-time**: Socket.io + PostgreSQL NOTIFY/LISTEN
- **Push**: Expo SDK
- **CORS**: Configured for Expo / React Native

## API Endpoints

### Health
- `GET /api/health`

### Auth
- `GET /api/auth/me` - Get authenticated user + profile + addresses
- `POST /api/auth/logout`

### Profiles
- `GET /api/profiles` - Current user profile
- `GET/PATCH /api/profiles/:id`
- `GET/DELETE /api/profiles/:id/avatar`
- `POST /api/profiles/:id/avatar/upload`

### Addresses
- `GET/POST /api/addresses`
- `GET/PATCH/DELETE /api/addresses/:id`

### Communities
- `GET/POST /api/communities`
- `GET/PATCH/DELETE /api/communities/:id`
- `POST /api/communities/:id/leave`
- `GET/POST /api/communities/:id/members`
- `PATCH/DELETE /api/communities/:id/members/:memberId`
- `GET/POST /api/communities/:id/invitations`
- `PATCH /api/communities/:id/invitations/:invitationId`

### Notifications
- `GET/DELETE /api/notifications`
- `PATCH/DELETE /api/notifications/:id`
- `PATCH /api/notifications/dismiss-all`
- `GET /api/notifications/unread-count`

### Other
- `POST /api/contact-inquiries` (public, rate-limited)
- `GET/POST/DELETE /api/push-tokens`

## Docker

```bash
docker compose up --build
```

## Environment

Key variables in `.env`:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_OR_PUBLISHABLE_KEY` - Supabase publishable key
- `DATABASE_URL` - PostgreSQL connection (for PgNotify real-time)
- `MOBILE_ALLOWED_ORIGINS` - CORS origins
