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

## Run the server

- You can either run

   ```bash
   npm run start
   ```

- Or for dev mode:

   ```bash
   npm run dev
   ```

## Utility: Organize a folder by file type

This repo also includes a standalone helper script, `scripts/organizeByType.js`, that sorts a messy folder into sub-folders by file type (Images, Documents, Videos, Audio, Archives, Code, Others).

Usage:

```bash
# Preview what would happen, without moving anything
node scripts/organizeByType.js /path/to/folder --dry-run

# Organize the folder (creates sub-folders and moves files into them)
node scripts/organizeByType.js /path/to/folder

# Also organize files inside nested sub-folders
node scripts/organizeByType.js /path/to/folder --recursive
```

Or via the npm script:

```bash
npm run organize -- /path/to/folder
```

The script is safe to re-run: it skips folders it already created (e.g. `Images`, `Documents`) and avoids overwriting files with the same name by appending a counter (e.g. `photo (1).jpg`).

# Enjoy :)
