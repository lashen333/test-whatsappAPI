🔹 1. Remove Test Mode for Production

When ready for live ads:

Remove:

META_TEST_EVENT_CODE

Redeploy.

Now events will go directly to production stream.

🔹 2. Improve Matching Quality (Optional but Recommended)

Right now you're sending:

Hashed phone

You can improve by also sending:

client_ip_address

client_user_agent

That increases ad attribution quality.

🔹 3. Connect This to Real Ad Campaign

Inside Meta Ads Manager:

When creating campaign:

Objective:

Sales → Website or Messaging (depending on setup)

Then choose:

Optimization Event:

Lead

Now Meta will optimize ads for:
People most likely to generate WhatsApp leads.