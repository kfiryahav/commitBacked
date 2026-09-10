# Backend - NodeJS + mongoDB

## Description

The backend of this project is built with Node.js and connects to a MongoDB Atlas database to store and retrieve user information. <br> It provides the following endpoints:

- `/addUser`: This endpoint accepts POST requests to add a new user to the database. It expects a JSON object in the request body with the properties:
  - `email`: Email address of the user.
  - `phone`: Phone number of the user.
  - `password`: Password of the user.

- `/getUser`: This route retrieves user information based on the provided email address. It expects the email address as a query parameter in the format `?email=email@example.com`.

## Setup

To set up the backend of the project, follow these steps:

1. Ensure you have Node.js version 20.11 installed.
2. Set up a MongoDB Atlas database:
   - Sign up for MongoDB Atlas at [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
   - Create a new cluster and follow the instructions to configure your cluster.
   - Once your cluster is set up, obtain the connection URI, which should include your username, password, host, and database name. The URI should look something like this:

     ```
     mongodb+srv://<username>:<password>@<cluster-name>.mongodb.net/<database-name>
     ```

   - Replace `<username>` and `<password>` with your MongoDB Atlas username and password, `<cluster-name>` with the name of your cluster, and `<database-name>` with the name of your database.
3. Set the following environment variables:
   - `MONGODB_URI`: The MongoDB Atlas connection URI, including the username, password, host, and database name obtained in step 2.
   - `PORT`: Port number for the server (e.g., `3000`).
4. Run the following command to install project dependencies:

   ```bash
   npm install

## Agent 1 - Product Reader & Marketing Angles

Given a product page URL, this reads the page (title, description, specs,
price), identifies the deepest customer pain points the product solves, and
returns 3 distinct Hebrew marketing angles - each with a hook and a short
script - built around the strongest pain points.

Setup:

1. `npm install` (this pulls in Playwright and its browser binaries via
   `npx playwright install chromium` the first time).
2. Set `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`, default
   `claude-sonnet-5`) in your `.env`.

Usage - CLI (no server/DB required):

```bash
node scripts/analyzeProduct.js "<product-url>" --save output.json
```

Usage - HTTP endpoint (needs the server running, i.e. `MONGODB_URI` set):

```bash
curl -X POST http://localhost:5000/creative/analyzeProduct \
  -H "Content-Type: application/json" \
  -d '{"url": "<product-url>"}'
```

Note: some marketplaces (e.g. AliExpress) run bot detection and may show a
CAPTCHA/verification wall instead of the real page. `services/productScraper.js`
detects this and throws a clear error; for production reliability, add a
stealth plugin and/or a residential proxy to the Playwright context.

## Run the server

- You can either run

   ```bash
   npm run start
   ```

- Or for dev mode:

   ```bash
   npm run dev
   ```

# Enjoy :)
