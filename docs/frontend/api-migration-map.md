# API Migration Mapping

## Authentication

**Login**
↓
`supabase.auth.signInWithPassword()`
↓
`POST /auth/login`
↓
Available (Implemented in NestJS)

**Registration**
↓
`supabase.auth.signUp()`
↓
`POST /auth/register`
↓
Available (Implemented in NestJS)

**Session Status**
↓
`supabase.auth.getSession()` / `onAuthStateChange`
↓
`GET /auth/me`
↓
Available (Implemented in NestJS)

**Logout**
↓
`supabase.auth.signOut()`
↓
`POST /auth/logout`
↓
Available (Implemented in NestJS)

---

## Children Domain

**List Children**
↓
`supabase.from('child_profiles').select()`
↓
`GET /users/me/children`
↓
Available (Implemented in NestJS)

**Create Child**
↓
`supabase.from('child_profiles').insert()`
↓
`POST /users/me/children`
↓
Available (Implemented in NestJS)

---

## Story Domain

**List Stories**
↓
`supabase.from('stories').select()`
↓
`GET /stories`
↓
Available (Implemented in NestJS)

**Generate Story**
↓
`supabase.functions.invoke('generate-story')`
↓
`POST /stories/generate`
↓
Available (Implemented in NestJS via Orchestrator)

**Get Story Details**
↓
`supabase.from('stories').select().eq('id', ...)`
↓
`GET /stories/:id`
↓
Available (Implemented in NestJS)
