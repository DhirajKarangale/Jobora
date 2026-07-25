# Jobora Backend API & Automation Engine

## What is this?
The backend directory contains the core REST API and the automation engine for Jobora. It acts as the central hub that manages job data, serves detailed analytics to the frontend, and runs a local browser automation bot to scrape job postings and auto-apply to eligible roles across various job portals.

## Technologies Used
- **Node.js & Express:** The core web server framework for building the REST API.
- **TypeScript:** For static typing, enhanced tooling, and a robust developer experience.
- **PostgreSQL (`pg`):** The primary relational database for storing job entries and performing complex analytics queries.
- **Redis (`ioredis`):** Used as a message broker to queue jobs for the AI worker to process.
- **Puppeteer (`puppeteer-core`):** The browser automation library used to control a local instance of Microsoft Edge for scraping and applying.

## How it works
1. **API Serving:** The Express server exposes endpoints for the frontend to fetch paginated job lists, filter options, and aggregated analytics.
2. **Automation Trigger:** An API endpoint triggers the scraping bot, ensuring only one instance runs at a time.
3. **Scraping & Applying:** The bot connects to a dedicated local Microsoft Edge profile using Puppeteer. It concurrently navigates job portals (LinkedIn, Instahyre, Wellfound, Naukri, Cutshort) to find new jobs and apply to them if they meet specific criteria.
4. **Data Storage:** Newly found jobs are saved directly into the PostgreSQL database and pushed to a Redis stream so the AI processor can analyze their eligibility.

## Architecture
The backend is designed for efficient data serving and reliable local automation:

- **Raw SQL Layer:** Instead of an ORM, it uses direct PostgreSQL queries (`cloud/db/index.ts`) via a connection pool. This allows for highly optimized, complex aggregations required for the analytics dashboard.
- **Custom Browser Management:** The `browserManager.ts` utility doesn't download a new Chromium instance. Instead, it spawns your local Microsoft Edge (`msedge.exe`) with a dedicated remote debugging profile. This allows the bot to leverage existing authenticated sessions and bypass basic bot detection.
- **Concurrent Execution:** The automation route (`routes/automation.ts`) runs scraping tasks for multiple portals concurrently, bound by a maximum concurrency limit, to speed up the data gathering process.

---

## How to Run

Follow these steps to run the backend server locally.

**Note:** The command examples below use `E:\FullStack\Jobora\backend>`, but you should navigate to the `backend` directory wherever the project is located on your local machine.

### 1. Install Dependencies
Ensure you have Node.js installed, then install the required npm packages:

```bash
E:\FullStack\Jobora\backend> npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the `backend` directory and populate it with the necessary variables. Here is an explanation of what each variable does:

```env
# Server Configuration
PORT=2402                 # The port on which the Express API server will run

# Database Configuration (PostgreSQL)
DB_HOST=your_db_host      # The hostname of your PostgreSQL database (e.g., Neon DB url)
DB_NAME=your_db_name      # The name of your database
DB_USER=your_db_user      # Your database username
DB_PASSWORD=your_db_pass  # Your database password
DB_PORT=5432              # Your database port

# Redis Configuration
REDIS_URL=your_redis_url  # URL to connect to your Redis instance (e.g., Render Redis url)
REDIS_CONSUMER_PROCESS=jobora_process # The name of the Redis stream queue
```

### 3. Start the Project
Run the following command to start the development server using `tsx` (which supports hot-reloading for TypeScript):

```bash
E:\FullStack\Jobora\backend> npm run dev
```

---

> *Note: This system is not perfect and is still evolving.*

<br/>

<div align="right">
  <strong>-DK-</strong>
</div>