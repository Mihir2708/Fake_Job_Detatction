# Fake Job Detection 🛡️

A full-stack application designed to detect fraudulent job postings, recruitment scams, and phishing attempts using **Next.js App Router**, **Express.js**, **MongoDB with Mongoose**, and **Google Gemini AI**.

---

## 📌 Phase 3 Overview: MongoDB Persistence & Analysis History

Phase 3 introduces database-backed persistence and full analysis history tracking:

- **Automated Record Persistence**: After Gemini evaluates a job listing, the validated analysis is automatically saved to MongoDB.
- **Record Identifier**: Every successful analysis returns its newly created database `id` alongside the prediction.
- **Paginated History Endpoint**: `GET /api/analysis/history` provides paginated access (`page`, `limit`) with total record counts and pages.
- **Specific Record Lookup**: `GET /api/analysis/:id` retrieves previously stored analyses directly without re-invoking Gemini.
- **Frontend History Dashboard**: View stored analyses, inspect details with one click, and track evaluations over time.
- **Graceful Failure Handling**: If MongoDB is temporarily unavailable, safe `HTTP 503` responses are returned without exposing internal database credentials or stack traces.

---

## 🗄️ MongoDB Setup Guide

You can connect to either a local MongoDB instance or a free MongoDB Atlas cloud cluster.

### Option A: Local MongoDB (Community Edition)
1. Install and start MongoDB locally:
   - **Windows**: Install [MongoDB Community Server](https://www.mongodb.com/try/download/community) and ensure the MongoDB service is running on port `27017`.
   - **macOS / Linux**: `brew services start mongodb-community` or `sudo systemctl start mongod`.
2. Configure `server/.env`:
   ```env
   MONGODB_URI=mongodb://localhost:27017/fake_job_detection
   ```

### Option B: MongoDB Atlas (Cloud Cluster)
1. Sign in or create a free account at [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Create a free **M0 Sandbox** cluster.
3. Under **Security > Database Access**, create a database user with read/write privileges.
4. Under **Security > Network Access**, add your current IP address (or `0.0.0.0/0` for universal dev access).
5. Click **Connect > Drivers**, copy the connection string, replace `<password>` with your database user password, and URL-encode any special characters (e.g. `@` as `%40`).
6. Configure `server/.env`:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/fake_job_detection?retryWrites=true&w=majority
   ```

> ⚠️ **Security Warning:** Never commit `.env` files or hardcode database passwords in git repositories or frontend client files. All database operations and credentials must stay exclusively on the backend.

---

## 🔑 Environment Variables Reference

### Backend (`server/.env`)
Create `server/.env` based on `server/.env.example`:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Frontend Client URL (for CORS)
CLIENT_URL=http://localhost:3000

# MongoDB Connection URI
MONGODB_URI=mongodb://localhost:27017/fake_job_detection

# Google Gemini API Key (Get yours at https://aistudio.google.com/)
GEMINI_API_KEY=your_gemini_api_key_here

# Configurable Gemini Model (gemini-1.5-flash, gemini-1.5-pro, gemini-2.0-flash)
GEMINI_MODEL=gemini-1.5-flash
```

### Frontend (`client/.env.local`)
Create `client/.env.local` based on `client/.env.example`:

```env
# Backend API base URL
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

---

## 📡 API Endpoints Reference

### 1. Evaluate & Persist Job Posting
- **Endpoint**: `POST /api/analysis/analyze`
- **Description**: Validates input, executes Gemini AI risk analysis, persists the analysis to MongoDB, and returns the result with the new record `id`.
- **Headers**: `Content-Type: application/json`

#### Request Body
```json
{
  "jobTitle": "Data Entry Specialist - Immediate Hire",
  "companyName": "Apex Digital Innovations",
  "location": "Remote / Worldwide",
  "requirements": "Telegram required, no prior experience needed",
  "jobDescription": "We are seeking immediate data entry assistants. Earn $85/hour with flexible schedules. We will send you a certified equipment check of $2,500 to purchase home office hardware from our authorized supplier. Interviews are conducted strictly via Telegram text message."
}
```

#### Response (`HTTP 200 OK`)
```json
{
  "success": true,
  "message": "Job analysis completed successfully",
  "data": {
    "id": "671ac8e1234567890abcdef1",
    "_id": "671ac8e1234567890abcdef1",
    "jobTitle": "Data Entry Specialist - Immediate Hire",
    "companyName": "Apex Digital Innovations",
    "location": "Remote / Worldwide",
    "prediction": "SUSPICIOUS",
    "riskLevel": "HIGH",
    "reasons": [
      "The offer of an equipment purchase check ($2,500) matches the advance-fee check scam archetype.",
      "The compensation ($85/hr) is disproportionately high for an entry-level position with no requirements.",
      "Interviewing exclusively over Telegram text messaging indicates an unverified recruiter."
    ],
    "recommendation": "Do not deposit any checks or transfer money. Cross-reference the company on official state corporate registries.",
    "limitations": "This automated analysis is based solely on the provided text and cannot guarantee the authenticity or illegitimacy of an employer.",
    "confidence": null,
    "createdAt": "2026-10-25T00:30:00.000Z"
  },
  "timestamp": "2026-10-25T00:30:00.000Z"
}
```

---

### 2. Get Analysis History (Paginated)
- **Endpoint**: `GET /api/analysis/history?page=1&limit=10`
- **Description**: Returns the most recent analyses first with pagination metadata.

#### Query Parameters
- `page` *(optional, default: 1)*: Page number.
- `limit` *(optional, default: 10, max: 50)*: Number of records per page.

#### Response (`HTTP 200 OK`)
```json
{
  "success": true,
  "message": "Analysis history retrieved successfully",
  "data": [
    {
      "_id": "671ac8e1234567890abcdef1",
      "jobTitle": "Data Entry Specialist - Immediate Hire",
      "companyName": "Apex Digital Innovations",
      "location": "Remote / Worldwide",
      "prediction": "SUSPICIOUS",
      "riskLevel": "HIGH",
      "createdAt": "2026-10-25T00:30:00.000Z"
    }
  ],
  "pagination": {
    "totalRecords": 1,
    "currentPage": 1,
    "pageSize": 10,
    "totalPages": 1
  },
  "timestamp": "2026-10-25T00:31:00.000Z"
}
```

---

### 3. Get Single Analysis by ID
- **Endpoint**: `GET /api/analysis/:id`
- **Description**: Retrieves full stored details of a past evaluation by its MongoDB `_id` without invoking the Gemini API.

#### Response (`HTTP 200 OK`)
```json
{
  "success": true,
  "message": "Analysis record retrieved successfully",
  "data": {
    "_id": "671ac8e1234567890abcdef1",
    "jobTitle": "Data Entry Specialist - Immediate Hire",
    "companyName": "Apex Digital Innovations",
    "location": "Remote / Worldwide",
    "requirements": "Telegram required, no prior experience needed",
    "jobDescription": "We are seeking immediate data entry assistants...",
    "prediction": "SUSPICIOUS",
    "riskLevel": "HIGH",
    "reasons": [
      "The offer of an equipment purchase check ($2,500) matches the advance-fee check scam archetype..."
    ],
    "recommendation": "Do not deposit any checks or transfer money...",
    "limitations": "This automated analysis is based solely on the provided text...",
    "confidence": null,
    "aiModel": "gemini-1.5-flash",
    "createdAt": "2026-10-25T00:30:00.000Z",
    "updatedAt": "2026-10-25T00:30:00.000Z"
  },
  "timestamp": "2026-10-25T00:32:00.000Z"
}
```

#### Error States
- `400 Bad Request`: If `:id` is not a valid 24-character hex MongoDB ObjectId.
- `404 Not Found`: If no record matches the valid ID.
- `503 Service Unavailable`: If MongoDB is disconnected.

---

### 4. Health Check
- **Endpoint**: `GET /api/health`
- **Description**: Returns live server status, uptime, environment, and MongoDB connection state (`connected`, `disconnected`, `connecting`).

---

## 🚀 Running the Project

### Start the Backend Server
```bash
cd server
npm install
npm run dev
```
Backend will listen at `http://localhost:5000`.

### Start the Frontend Client
```bash
cd client
npm install
npm run dev
```
Frontend will be accessible at `http://localhost:3000`.

---

## 🧪 Running Automated Unit Tests

The backend includes 30 automated unit tests using Node.js's native test runner (`node:test`):

```bash
# Run tests from the server folder:
cd server
npm test

# Or run tests from the workspace root:
npm run test:server
```

### Test Suite Summary (30 Tests Passing)
- **Persistence & History Tests** (`server/tests/analysisPersistenceAndHistory.test.js`):
  - Successful MongoDB persistence on valid analysis
  - Zero persistence on validation failures or Gemini API errors
  - History pagination calculation and parameter sanitization (e.g. negative pages, oversized limits)
  - Empty history response structure
  - Valid ObjectId retrieval
  - Rejection of invalid MongoDB ObjectId formats (400 Bad Request)
  - Handling of non-existent record IDs (404 Not Found)
  - Database disconnection safety (503 Service Unavailable)
  - Database internal error protection (masks connection strings and secrets)
- **Input Validation Tests** (`server/tests/validation.test.js`):
  - Required and optional fields, bounds checking, whitespace trimming, and type safety
- **AI Response Parser Tests** (`server/tests/responseParser.test.js`):
  - Schema adherence, enum enforcement, and uncalibrated `confidence: null` guarantee
