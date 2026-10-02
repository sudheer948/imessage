import express from "express";
import User from "../models/user.model.js";
import { verifyWebhook } from "@clerk/backend/webhooks"; // checks whether the incoming event has a valid Clerk signature.

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET; // The signing secret is a secret value used to verify that the webhook really came from Clerk.
    if (!signingSecret) {
      res.status(503).json({ message: "Webhook secret is not provided" });
      return;
    }

    // express.raw({ type: "application/json" })
    // That gives the webhook handler a raw request body, usually a Buffer.

    // Think of a Buffer as a container holding raw bytes.
    // This code checks:
    // Buffer.isBuffer(req.body) — is the body a Buffer?
    // .toString("utf8") — if yes, convert those bytes into text.
    // String(req.body) — otherwise, convert the value into a string.
    // Now payload contains the request body as text.
    const payload = Buffer.isBuffer(req.body)
      ? req.body.toString("utf8")
      : String(req.body);

    // Your code uses Express, but Clerk's verifyWebhook() expects a standard Web Request object.
    // So this code converts the incoming Express request into the format Clerk expects.
    // - method: "POST" — the HTTP method.
    // - headers — information attached to the request, including webhook signature headers.
    // - body: payload — the original request body as text.
    // The URL here is an internal placeholder for constructing the request; it isn't a real request being sent to another server.
    const request = new Request("http://internal/webhooks/clerk", {
      method: "POST",
      headers: new Headers(req.headers),
      body: payload,
    });

    // verify the webhook
    // This checks the request's signature using the signing secret.
    // Think of it like checking an ID card before allowing someone into a building.
    // - If verification succeeds, evt contains the trusted event data.
    // - If verification fails, the function throws an error, and execution jumps to catch.
    // Why is this necessary? You don't want someone pretending to be Clerk and sending fake instructions to create or delete users in your database.
    const evt = await verifyWebhook(request, { signingSecret });

    if (evt.type === "user.created" || evt.type === "user.updated") {
      const u = evt.data;

      // Find the user's email
      // This looks complicated, but the idea is simple:
      // 1. Find the user's primary email address.
      // 2. If it can't be found, use the first available email address.
      // A few symbols to know:
      // - ?. — safely access something that might be missing.
      // - .find() — finds the first array item that matches a condition.
      // - ?? — use the value on the right if the value on the left is null or undefined.
      const email =
        u.email_addresses?.find((e) => e.id === u.primary_email_address_id)
          ?.email_address ?? u.email_addresses?.[0]?.email_address;

      // Create the user's full name
      //  This tries different ways to get a name:
      // 1. Combine first name and last name.
      // 2. If unavailable, use the username.
      // 3. If that's unavailable, use the part of the email before @.
      // For example, alex@gmail.com could produce alex as the fallback name.
      const fullName =
        [u.first_name, u.last_name].filter(Boolean).join(" ") ||
        u.username ||
        email?.split("@")[0];

      // Save the user in MongoDB
      // Let's split it into three parts.

      // First: find the user
      // { clerkId: u.id }
      // Look for a MongoDB user whose clerkId matches the user's ID from Clerk.

      // Second: the data to save
      // {
      //   clerkId: u.id,
      //   email,
      //   fullName,
      //   profilePic: u.image_url
      // }
      // This is the user's information to insert or update.

      // Third: the options
      // {
      //   new: true,
      //   upsert: true,
      //   setDefaultsOnInsert: true
      // }
      // - upsert: true — update the existing user, or create one if no matching user exists.
      // - new: true — return the updated document rather than the old one. This code doesn't use the returned document.
      // - setDefaultsOnInsert: true — apply Mongoose schema defaults when inserting a new document.
      // So the whole operation means:
      // Find this Clerk user in MongoDB. If the user exists, update their information. Otherwise, create their record.
      // This is useful because the same code handles both signup and profile updates.
      await User.findOneAndUpdate(
        { clerkId: u.id },
        { clerkId: u.id, email, fullName, profilePic: u.image_url },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
    }

    // If the user is deleted
    // When Clerk reports that a user was deleted:
    // 1. Check that the event contains the user's ID.
    // 2. Find the corresponding MongoDB record using clerkId.
    // 3. Delete that record.
    // This keeps your application's user records synchronized with Clerk's user accounts.
    if (evt.type === "user.deleted") {
      if (evt.data.id) await User.findOneAndDelete({ clerkId: evt.data.id });
    }

    // If processing succeeds, the server responds with HTTP 200 and:
    // { "received": true }
    // The response tells Clerk that your endpoint successfully handled the webhook.
    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Error in Clerk webhook:", error);

    // 400 tells the caller the request failed.
    res.status(400).json({ message: "Webhook verification failed" });
  }
});

export default router;
