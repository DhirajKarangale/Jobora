# Jobora Frontend

## What is this?
The frontend directory contains the user interface for Jobora. It is a modern, responsive web application that allows users to view AI-matched eligible jobs, trigger automation bots, and analyze job application statistics through an interactive dashboard.

## Technologies Used
- **React 19:** The core UI library.
- **Vite:** The lightning-fast build tool and development server.
- **TypeScript:** For static typing and robust developer experience.
- **Tailwind CSS v4 & shadcn/ui:** For rapid, utility-first styling and beautiful pre-built components.
- **React Query:** For powerful asynchronous state management and data fetching.
- **Recharts:** For rendering dynamic analytics charts.

## How it works
1. **Data Fetching:** The frontend uses React Query to fetch lists of eligible jobs, analytics data, and automation statuses directly from the backend API.
2. **User Interaction:** Users can view job details in a modal, manually toggle jobs as applied or expired, and trigger the background scraping bot with a click of a button.
3. **Data Visualization:** The analytics page takes raw data from the backend and renders it into insightful charts and summary cards using Recharts.

## Architecture
The application is structured for maintainability and modularity:

- **API Layer:** All backend interactions and React Query hooks are centralized in the `src/api` folder, separating data fetching logic from UI components.
- **Feature Modules:** The application uses a page-based architecture (e.g., `src/pages/eligible-jobs`, `src/pages/analytics`), where each page encapsulates its own specific sub-components and logic.
- **Shared Components:** Common layout elements (Header, Sidebar, Footer) and primitive UI elements (buttons, dialogs from `shadcn/ui`) are stored in `src/components` for reusability.
- **Client-Side Routing:** Uses React Router to seamlessly navigate between the job grid and the analytics dashboard without reloading the page.

---

## How to Run

Follow these steps to run the frontend server locally.

**Note:** The command examples below use `E:\FullStack\Jobora\frontend>`, but you should navigate to the `frontend` directory wherever the project is located on your local machine.

### 1. Install Dependencies
Ensure you have Node.js installed, then install the required npm packages:

```bash
E:\FullStack\Jobora\frontend> npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the `frontend` directory and populate it with the necessary variables. Here is an explanation of what each variable does:

```env
# API Configuration
VITE_SERVER_URL=http://localhost:2402  # The URL of your local backend API server
```

### 3. Start the Project
Run the following command to start the Vite development server (which supports extremely fast hot-reloading):

```bash
E:\FullStack\Jobora\frontend> npm run dev
```

---

> *Note: This system is not perfect and is still evolving.*

<br/>

<div align="right">
  <strong>-DK-</strong>
</div>
