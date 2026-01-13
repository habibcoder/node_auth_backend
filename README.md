# 🔐 Authentication & Password Reset API

This document describes the complete **authentication flow**, including **registration, email verification, login, logout, user profile**, and **password reset**.

**Base URL:**

```
http://localhost:3000/api/auth
```

---

## 📌 Features

* User registration with email verification
* Secure login with JWT
* Protected user profile (`/me`)
* Logout
* Forgot password & reset password
* Email-based token verification
* Password hashing & token expiration support

---

## 1️⃣ Register User

### Endpoint

```
POST /register
```

### Request

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Aaaa Aa",
    "email": "a@gmail.com",
    "password": "SecurePass123!"
  }'
```

### Response

```json
{
  "success": true,
  "message": "User registered successfully. Please check your email to verify your account.",
  "data": {
    "requiresVerification": true,
    "user": {
      "id": "UUID",
      "name": "Aaaa Aa",
      "email": "a@gmail.com"
    }
  }
}
```

📌 User **cannot log in** until email is verified.

---

## 2️⃣ Verify Email

### Endpoint

```
POST /verify-email
```

### Request

```bash
curl -X POST http://localhost:3000/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "token": "EMAIL_VERIFICATION_TOKEN"
  }'
```

### Response

```json
{
  "success": true,
  "message": "Email verified successfully! You can now log in."
}
```

---

## 3️⃣ Login User

### Endpoint

```
POST /login
```

### Request

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "a@gmail.com",
    "password": "SecurePass123!"
  }'
```

### Response (Success)

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "JWT_TOKEN",
    "user": {
      "id": "UUID",
      "name": "Aaaa Aa",
      "email": "a@gmail.com",
      "isVerified": true
    }
  }
}
```

🔑 Save the JWT for authenticated requests.

---

## 4️⃣ Get Current User (Protected)

### Endpoint

```
GET /me
```

### Request

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer JWT_TOKEN"
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "UUID",
    "name": "Aaaa Aa",
    "email": "a@gmail.com",
    "isVerified": true,
    "createdAt": "ISO_DATE",
    "updatedAt": "ISO_DATE"
  }
}
```

---

## 5️⃣ Logout User

### Endpoint

```
POST /logout
```

### Request

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer JWT_TOKEN"
```

### Response

```json
{
  "success": true,
  "message": "Logged out successfully. Please remove the token from client storage."
}
```

🧹 Client must remove the token (localStorage / cookies).

---

# 🔑 Password Reset Flow

---

## 6️⃣ Forgot Password

### Endpoint

```
POST /forgot-password
```

### Request

```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "a@gmail.com"
  }'
```

### Response

```json
{
  "success": true,
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

🔐 Response is generic for security reasons.

---

## 7️⃣ Reset Password

### Endpoint

```
POST /reset-password
```

### Request

```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "RESET_PASSWORD_TOKEN",
    "newPassword": "NewSecurePass456!"
  }'
```

### Response

```json
{
  "success": true,
  "message": "Password has been reset successfully. Please log in with your new password."
}
```

✅ Old password is invalid
✅ Reset token is consumed

---

## 8️⃣ Login With New Password

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "a@gmail.com",
    "password": "NewSecurePass456!"
  }'
```

```json
{
  "success": true,
  "message": "Login successful"
}
```

---

## ⚠️ Error Handling (Recommended)

Avoid returning `Internal Server Error` for auth failures.

**Use instead:**

* `Invalid email or password`
* `Email not verified`
* `Token is invalid or expired`

---

## ✅ Complete Flow Summary

1. Register
2. Verify email
3. Login → receive JWT
4. Access `/me`
5. Logout
6. Forgot password
7. Reset password
8. Login with new password

---

## 🔒 Security Best Practices

* Hash passwords & reset tokens
* Expire verification & reset tokens (15–30 min)
* Rate limit login & forgot-password endpoints
* Store JWT securely (HTTP-only cookies preferred)
