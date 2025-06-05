# fuse-backend-test

# Local NestJS Server Setup with Docker 🐳

This guide outlines the steps to set up and run your NestJS application locally using Docker, ensuring a consistent and isolated development environment across different machines.

---

## Prerequisites 🛠️

* **Docker Desktop:** Ensure you have Docker Desktop installed on your system. You can download it from the [official Docker website](https://www.docker.com/products/docker-desktop/).

---

## Setup and Execution Steps ▶️

Follow these steps to get your NestJS server running:

1.  **Create `.env` file:**
    Create a `.env` file in the root directory of your project. This file will contain environment variables necessary for this application and Docker Compose. It's crucial for configuring database connections, API keys, and other sensitive settings. A typical `.env` file might include: or `PORT=3000`. Ensure you fill in the correct values for this specific project. **IMPORTANT: For this test you must copy the variables and values from the file: `.env.example`**

2.  **Start Docker Services:**
    Execute the following command in the project's root directory to build and start the Docker services defined in your `docker-compose.yml` file in detached mode:

    ```bash
    docker-compose up --build -d
    ```

3.  **Verify Running Containers:**
    Check the status of the Docker containers to ensure they are running correctly:

    ```bash
    docker-compose ps
    ```

4.  **Run Database Migrations:**
    Once the `nestjs-app` service (as defined in the `docker-compose.yml`) is up, run the database migrations for the PostgreSQL database. This command executes the migrations within the `nestjs-app` container:

    ```bash
    docker-compose run --rm nestjs-app npm run migration:run
    ```

---

## Additional Commands ⚙️

Here are some additional useful commands for managing the Dockerized NestJS application:

* **View NestJS Logs:**
    To stream the logs from the NestJS application container in real-time:

    ```bash
    docker-compose logs -f nestjs-app
    ```

* **Stop Services:**
    To stop all services defined in the `docker-compose.yml` file:

    ```bash
    docker-compose down
    ```

* **Stop Services and Remove Volumes:**
    To stop services and remove any named volumes created by Docker Compose (useful for a clean slate):

    ```bash
    docker-compose down --volumes
    ```

* **Clean Rebuild of NestJS App:**
    To perform a clean rebuild of only the `nestjs-app` service, ignoring cached layers:

    ```bash
    docker-compose build --no-cache nestjs-app
    ```

## Run the Integration Tests 🚅

1. **Prepare and execute the Docker containers:**
    Open your terminal (or Git Bash/PowerShell on Windows) and navigate to the project's root directory, where the docker-compose.test.yml file is located.

    Then, execute the following command:

    ```bash
    docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from test_runner > test_output.log 2>&1
    ```
    
    **Important: you need to execute Docker Compose before running the command**

    While the command runs, you'll see Docker logs building the images and bringing up the containers. Afterwards, you'll see the test logs running. Once the tests finish, the docker-compose process will stop, and your terminal will return to the prompt.

    You can review the detailed test results in the `test_output.log` file that will be created in your project's root directory.


2. **Clean Up the Test Environment (Optional but Recommended)**
    After running the tests, the containers will have stopped, but images and data volumes might still take up space. To completely clean up the test environment, run the following command in the same root directory of your project:

    ```bash
    docker-compose -f docker-compose.test.yml down -v --rmi all
    ```