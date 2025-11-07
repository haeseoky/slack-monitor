# GEMINI.md

## Project Overview

This project is a Node.js-based API monitoring tool. It periodically checks the health of multiple APIs, measures their response times, and sends consolidated reports to a specified Slack channel. The application is designed for continuous background operation using PM2, making it suitable for production environments.

**Key Technologies:**

*   **Runtime:** Node.js
*   **HTTP Client:** Axios
*   **Slack Integration:** @slack/webhook
*   **Process Management:** PM2
*   **Configuration:** `apis.config.js` for API endpoints and `.env` for environment variables.

**Architecture:**

The application follows a modular architecture:

*   `index.js`: The main entry point that initializes the configuration and starts the monitoring service.
*   `apis.config.js`: A user-defined list of API objects to be monitored. Each object specifies the URL, HTTP method, headers, body, and other parameters.
*   `src/config/index.js`: Manages application settings and environment variables (e.g., Slack webhook URL, check intervals).
*   `src/services/monitoringService.js`: The core service that orchestrates the monitoring loop, schedules API checks, and triggers notifications.
*   `src/services/apiChecker.js`: Contains the logic for making HTTP requests to the specified APIs and measuring response times. It runs checks in parallel for efficiency.
*   `src/services/slackNotifier.js`: Formats and sends notifications to Slack. It supports both detailed summary reports and individual alerts.
*   `src/utils/logger.js`: A simple utility for logging application events.
*   `ecosystem.config.js`: PM2 configuration for running the application in a production environment, with settings for automatic restarts and log management.

## Building and Running

### 1. Installation

Install the required dependencies:

```bash
npm install
```

### 2. Configuration

*   **Environment Variables:** Create a `.env` file by copying the example file:
    ```bash
    cp .env.example .env
    ```
    Then, edit the `.env` file to set your `SLACK_WEBHOOK_URL` and other environment variables.

*   **API Endpoints:** Edit the `apis.config.js` file to define the list of APIs you want to monitor.

### 3. Running the Application

*   **Development:** To run the application directly for development or testing:
    ```bash
    npm start
    ```
    or
    ```bash
    node index.js
    ```

*   **Production:** For continuous monitoring in a production environment, use PM2:
    ```bash
    pm2 start ecosystem.config.js
    ```

### 4. Testing

The project does not currently have a dedicated test suite.

## Development Conventions

*   **Modularity:** The code is organized into distinct modules with clear responsibilities (e.g., API checking, notifications, configuration).
*   **Asynchronous Operations:** The application makes extensive use of `async/await` and `Promise.all` to handle API checks concurrently, ensuring non-blocking I/O.
*   **Configuration over Code:** Key settings, such as API endpoints and notification preferences, are managed in external configuration files (`apis.config.js`, `.env`) rather than being hardcoded.
*   **Error Handling:** The application includes error handling to gracefully manage failed API checks and notification attempts.
*   **Code Style:** The code follows a consistent and readable style, with JSDoc comments explaining the purpose of functions and modules.
