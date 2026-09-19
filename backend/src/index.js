import express from "express";
import "dotenv/config";
import cors from "cors";
import { connectDB } from "./lib/db.js";
import { clerkMiddleware } from "@clerk/express";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT;
const FRONTEND_URL = process.env.FRONTEND_URL;
const publicDir = path.join(process.cwd(), "public"); // join the current working directory and find the public folder

app.use(express.json());
app.use(cors({ origin: FRONTEND_URL, credentials: true })); // credentials: true means allow the client to send the cookies or the auth headers with the request.
app.use(clerkMiddleware());

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

// if the public directory exists, serve the static files
// this is for production build
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir)); // this is a middleware

  app.get("/{*any}", (req, res, next) => {
    res.sendFile(path.join(publicDir, "index.html"), (err) => next(err));
  });
}

/* 
How one server serves both frontend + backend

In production, the Express backend can serve the React frontend too.

1. `/api/...`
   → Express API routes handle the request.

2. `/assets/...`
   → `express.static(publicDir)` serves frontend static files.

3. `/`, `/chat`, `/login`, etc.
   → Catch-all route sends `index.html`.
   → React Router handles the URL in the browser.

`fs.existsSync(publicDir)`
→ Checks whether the production frontend build exists.

Development:
→ Frontend runs separately on Vite (port 5173).
→ Backend runs separately as an API server.

Production:
→ One Express server can serve both the API and the built frontend.
*/

app.listen(PORT, async () => {
  await connectDB();
  console.log("Server is up and running on port: " + PORT);
});
