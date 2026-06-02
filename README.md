
## Installation

BudgetBee is installed via Docker Compose. Copy the snippet below, fill in the environment variables, and run `docker-compose up -d`.

```yaml
version: '3.8'
services:
  nginx:
    image: ghcr.io/budgetbee/budgetbee/proxy:latest
    command: nginx -g "daemon off;"
    ports:
      - "${APP_PORT}:80" # Port exposed on the host, e.g. 80 -> http://localhost
    depends_on:
      - webserver
      - web
    restart: unless-stopped
    networks:
      - skynet
  webserver:
    image: ghcr.io/budgetbee/budgetbee/api:latest
    working_dir: /var/www/html
    command: sh entrypoint.sh
    environment:
      DB_HOST: db
      DB_DATABASE: ${DB_DATABASE}   # Name of the MySQL database (e.g. budgetbee)
      DB_USERNAME: ${DB_USERNAME}   # MySQL user the app connects with (e.g. budgetbee)
      DB_PASSWORD: ${DB_PASSWORD}   # Password for the MySQL app user - use a strong value
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - skynet
  web:
    image: ghcr.io/budgetbee/budgetbee/web:latest
    restart: unless-stopped
    networks:
      - skynet
  db:
    image: mysql:8.2.0
    command: --default-authentication-plugin=mysql_native_password
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD} # MySQL root password - keep this secret
      MYSQL_DATABASE: ${DB_DATABASE}           # Must match DB_DATABASE above
      MYSQL_USER: ${DB_USERNAME}               # Must match DB_USERNAME above
      MYSQL_PASSWORD: ${DB_PASSWORD}           # Must match DB_PASSWORD above
    healthcheck:
      test: ["CMD", "/usr/bin/mysql", "--user=${DB_USERNAME}", "--password=${DB_PASSWORD}", "--execute", "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = '${DB_DATABASE}';"]
      timeout: 20s
      retries: 100
    restart: unless-stopped
    volumes:
      - db_data:/var/lib/mysql
    networks:
      - skynet
networks:
  skynet:
volumes:
  db_data:
```

## Getting Started

Once all containers are up and running, open the application in your browser. If no users exist yet, you will be automatically redirected to the registration page where you can create your first admin account by entering your name, email, and password.

After registering, you will be redirected to the login page to sign in with your new credentials.

## Roadmap

| Feature | Status |
| ----------------------------------------------- | ------ |
| Import records from Excel / JSON                | ✅ Done |
| Multi-user support                              | ✅ Done |
| Built-in currency support                       | ✅ Done |
| Custom currencies                               | 🔜 Planned |
| Create / edit categories                        | ✅ Done |
| Budgets per category                            | ✅ Done |
| Reports page                                    | ✅ Done |
| Upcoming expenses page                          | ✅ Done |
| Automation rules                                | 🔜 Planned |
| Bank integrations                               | 🔜 Planned |
| Export / backup                                 | 🔜 Planned |
| Customizable dashboard                          | 🔜 Planned |

## Updates

To upgrade BudgetBee to the latest version, rebuild your Docker Compose images and recreate the containers:

```bash
docker-compose up -d --build
```

## Documentation

This section is currently under development.

## Contributing

Contributions are welcome! Feel free to open a pull request or start a discussion in the issues section.

## Bugs

For bugs please [open an issue](https://github.com/budgetbee/budgetbee/issues)
# BudgetBee
