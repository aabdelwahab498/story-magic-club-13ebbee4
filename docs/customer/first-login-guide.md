# Customer Guide: Account Setup & First Login — Najmah AI Platform

This guide walks new users and administrators through registering an account, performing authentication, establishing child profiles, and navigating the Najmah application dashboard.

---

## 1. User Registration

1. Navigate to the application URL (`https://najmah.example.com` or `http://localhost:5173`).
2. Click **Sign Up** on the top right navigation bar.
3. Enter your details:
   - Full Name
   - Email Address
   - Password (must contain at least 8 characters, numbers, and symbols)
4. Click **Create Account**.

---

## 2. Authentication & Session Security

Upon registering or logging in:
* The NestJS API Gateway authenticates your credentials and sets a secure `najmah_token` cookie.
* The session cookie is flagged as `HttpOnly`, `SameSite=Lax`, and `Secure`.
* You will be redirected automatically to the **Parent Dashboard** (`/parent/dashboard`).

---

## 3. Creating a Child Profile

Before generating your first AI story, you must establish a Child Profile:

1. On the Parent Dashboard, click **Add Child Profile** or **Child Management**.
2. Fill out the child profile form:
   - **Child Name:** (e.g. `Youssef`)
   - **Age:** (e.g. `7`)
   - **Preferred Language:** Select from English, Arabic, German, French, Italian, or Spanish.
   - **Avatar Icon:** Choose an avatar illustration.
   - **Interests & SEL Focus:** (e.g. `Space exploration`, `Building confidence`, `Sharing with friends`).
3. Click **Save Profile**.

Now you are ready to create personalized stories tailored specifically to your child's age group!
