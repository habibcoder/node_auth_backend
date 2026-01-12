# Node.js Authentication Backend with PostgreSQL

A basic authentication backend project built with Node.js, Express, and PostgreSQL. This project is designed for developers learning Node.js to understand authentication fundamentals while following industry best practices.

## Features

- **User Registration**: Create new accounts with email and password
- **User Login**: Authenticate and receive a JWT (JSON Web Token)
- **Protected Routes**: Access user-specific endpoints with authentication
- **Password Hashing**: Secure password storage using bcrypt
- **Input Validation**: Request validation using express-validator
- **Rate Limiting**: Protection against brute force and abuse
- **Clean Architecture**: Separation of concerns with controllers, middleware, and routes

## Project Structure

```
node-auth-backend/
├── src/
│   ├── config/
│   │   ├── db.js              # Database connection configuration
│   │   └── initDatabase.js    # Database initialization script
│   ├── controllers/
│   │   └── authController.js  # Authentication business logic
│   ├── middlewares/
│   │   ├── auth.js            # JWT authentication middleware
│   │   ├── rateLimiter.js     # Rate limiting middleware
│   │   └── validation.js      # Request validation middleware
│   ├── routes/
│   │   └── authRoutes.js      # API route definitions
│   ├── utils/
│   │   └── errorResponse.js   # Error handling utilities
│   ├── app.js                 # Express application setup
│   └── server.js              # Server entry point
├── database.sql               # Database schema
├── .env.example               # Environment variables template
├── .gitignore
├── package.json
└── README.md
```

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v20 or higher) - [Download here](https://nodejs.org/)
- **PostgreSQL** (v16 or higher) - [Download here](https://www.postgresql.org/)
- **npm** (comes with Node.js)

## Quick Start

### 1. Clone and Install Dependencies

```bash
cd node-auth-backend
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and update it with your settings:

```bash
cp .env.example .env
```

Edit `.env` with your PostgreSQL credentials:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nodeauth
DB_USER=postgres
DB_PASSWORD=your_password_here

# JWT Configuration
JWT_SECRET=your_super_secret_key_change_this
JWT_EXPIRE=24h

# Server Configuration
PORT=3000
NODE_ENV=development
```

### 3. Create the Database

Create a new PostgreSQL database:

```sql
CREATE DATABASE nodeauth;
```

Or using command line:

```bash
createdb nodeauth
```

### 4. Initialize the Database

Run the initialization script to create the users table:

```bash
npm run init-db
```

Or manually execute the SQL script:

```bash
psql -U postgres -d nodeauth -f database.sql
```

### 5. Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The server will start at `http://localhost:3000`

## API Endpoints

### Authentication Routes

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/auth/register` | Register a new user | Public |
| POST | `/api/auth/login` | Login and get token | Public |
| GET | `/api/auth/me` | Get current user profile | Private |
| POST | `/api/auth/logout` | Logout user | Private |

### System Routes

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/` | API information | Public |
| GET | `/health` | Health check | Public |

## API Usage Examples

### Register a New User

**Request:**

```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "John Doe",
      "email": "john@example.com",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### Login

**Request:**

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
}
```

### Get Current User Profile

**Request:**

```http
GET /api/auth/me
Authorization: Bearer <your_token_here>
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "John Doe",
    "email": "john@example.com",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Error Response

**Example Error (400 Bad Request):**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Please provide a valid email"
    }
  ]
}
```

## Rate Limiting

This API implements rate limiting to protect against abuse, brute force attacks, and denial-of-service attacks. Rate limiting restricts how many requests a client can make within a certain time window.

### Rate Limit Configuration

The API uses two different rate limiters with distinct configurations:

**General Rate Limiter**: Applies to all routes (except `/health`). Each IP address can make up to 100 requests within a 15-minute window. This protects the API from general abuse while allowing legitimate traffic to flow normally. This limit is appropriate for standard API usage patterns where clients need to make multiple requests for normal operation.

**Authentication Rate Limiter**: Applies specifically to authentication endpoints (`/api/auth/login` and `/api/auth/register`). Each IP address is limited to only 5 requests within a 15-minute window. This stricter limit is crucial because authentication endpoints are prime targets for brute force password guessing attacks. By restricting attempts, we make automated attacks significantly slower and less effective.

### Rate Limit Response Headers

When you make a request, the API includes rate limit information in the response headers:

- **RateLimit-Limit**: The maximum number of requests allowed in the time window
- **RateLimit-Remaining**: The number of requests remaining in the current window
- **RateLimit-Reset**: The time (in seconds) until the rate limit resets

### Rate Limited Response

When you exceed the rate limit, you will receive a `429 Too Many Requests` response:

```json
{
  "success": false,
  "message": "Too many authentication attempts, please try again after 15 minutes",
  "retryAfter": 900
}
```

The `retryAfter` field indicates how many seconds you should wait before making another request. This allows clients to implement automatic retry logic with appropriate backoff.

### Customizing Rate Limits

You can customize rate limits by modifying the middleware configuration in `src/middlewares/rateLimiter.js`:

```javascript
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes (in milliseconds)
  max: 5, // Maximum requests per window
  message: 'Custom error message here'
});
```

For production environments, you may want to adjust these values based on your expected traffic patterns and security requirements. Higher limits may be appropriate for public APIs with legitimate high-volume clients, while lower limits provide stronger protection for sensitive authentication endpoints.

### Why Rate Limiting Matters

Rate limiting is essential for several reasons. First, it prevents brute force attacks where attackers systematically try many password combinations to guess user credentials. Without rate limiting, an attacker could try thousands of passwords per second, making weak passwords highly vulnerable. Second, it protects against denial-of-service attacks where malicious actors attempt to overwhelm your API with excessive requests, consuming server resources and making the service unavailable to legitimate users. Third, rate limiting ensures fair resource usage among all clients, preventing any single client from monopolizing server resources. Finally, many compliance frameworks and security standards require some form of rate limiting as a basic security control.

## Security Best Practices Implemented

1. **Password Hashing**: Uses bcrypt with salt rounds to securely hash passwords
2. **Parameterized Queries**: Prevents SQL injection attacks
3. **JWT Authentication**: Stateless authentication using signed tokens
4. **Input Validation**: Validates and sanitizes all user input
5. **Error Handling**: Generic error messages in production (no stack traces)
6. **Environment Variables**: Sensitive data stored in environment variables

## Learning Resources

This project demonstrates several key Node.js concepts:

- **Express.js**: Building REST APIs with Express framework
- **PostgreSQL**: Database operations using node-postgres (pg)
- **Authentication**: JWT-based stateless authentication
- **Middleware**: Request processing pipeline
- **Error Handling**: Centralized error handling
- **Configuration**: Environment-based configuration
- **Async/Await**: Modern JavaScript asynchronous patterns

## Testing the API

You can test the API using:

- **Postman**: Create requests and manage authentication tokens
- **curl**: Command-line HTTP requests

### Example curl commands:

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","password":"password123"}'
```
```json
{"success":true,"message":"User registered successfully","data":{"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJiYWMyMDFhYi03Y2Q2LTQ1NTYtYTBjZS1kZWE4OGM3MjY3ZDMiLCJlbWFpbCI6ImpvaG5AZXhhbXBsZS5jb20iLCJpYXQiOjE3NjgxMjk5MzQsImV4cCI6MTc2ODIxNjMzNH0.qN0WsF5u0yA9fYdowMenrCn2IMfCFcE0mZRpqbsObdU","user":{"id":"bac201ab-7cd6-4556-a0ce-dea88c7267d3","name":"John Doe","email":"john@example.com","createdAt":"2026-01-11T11:12:14.848Z"}}}
```

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123"}'
```

```json
{"success":true,"message":"Login successful","data":{"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJiYWMyMDFhYi03Y2Q2LTQ1NTYtYTBjZS1kZWE4OGM3MjY3ZDMiLCJlbWFpbCI6ImpvaG5AZXhhbXBsZS5jb20iLCJpYXQiOjE3NjgxMzAxNzIsImV4cCI6MTc2ODIxNjU3Mn0.46MvsXUQJ4EbBJ5l20cTe4RBmFV0XWPHh-UxGupvTOI","user":{"id":"bac201ab-7cd6-4556-a0ce-dea88c7267d3","name":"John Doe","email":"john@example.com"}}}
```

```bash
# Get Profile 
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJiYWMyMDFhYi03Y2Q2LTQ1NTYtYTBjZS1kZWE4OGM3MjY3ZDMiLCJlbWFpbCI6ImpvaG5AZXhhbXBsZS5jb20iLCJpYXQiOjE3NjgxMzAxNzIsImV4cCI6MTc2ODIxNjU3Mn0.46MvsXUQJ4EbBJ5l20cTe4RBmFV0XWPHh-UxGupvTOI"
```

```json
{"success":true,"data":{"id":"bac201ab-7cd6-4556-a0ce-dea88c7267d3","name":"John Doe","email":"john@example.com","createdAt":"2026-01-11T11:12:14.848Z","updatedAt":"2026-01-11T11:12:14.848Z"}}
```

```bash
# log out (replace TOKEN with actual token)
curl -X POST http://localhost:3000/api/auth/logout 
  \-H "Authorization: Bearer TOKEN"
```

```json
{"success":true,"message":"Logged out successfully."}
```

## Common Issues and Solutions

### Database Connection Failed

1. Make sure PostgreSQL is running
2. Check your `.env` credentials
3. Verify the database exists

```bash
# Check if PostgreSQL is running (linux)
systemctl status postgresql
```

```bash
# if not
systemctl start postgresql
```

```bash
# Create the database
sudo -u postgres psql -c "CREATE DATABASE database_name;"
```

### Port Already in Use

If port 3000 is already in use, change the PORT in `.env`:

```env
PORT=3001
```

### JWT Token Issues

1. Make sure `JWT_SECRET` is set in `.env`
2. Tokens expire after 24 hours (configurable)
3. Include the full token in the Authorization header

## Next Steps

Once you understand this basic auth system, consider adding:

1. **Password Reset**: Email-based password recovery
2. **Token Refresh**: Endpoint to get a new token before expiration
3. **User Management**: CRUD operations for user profiles
4. **Role-Based Access**: Different permission levels (admin, user)
5. **API Documentation**: Swagger/OpenAPI documentation
6. **Redis Store**: Use Redis for rate limiting in distributed environments

## License

MIT License - Feel free to use this project for learning and development.

## Contributing

This is an educational project. If you find issues or have suggestions, feel free to improve the code and documentation.
