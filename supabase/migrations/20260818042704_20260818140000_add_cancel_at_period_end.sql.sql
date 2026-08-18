/*
# Add cancel_at_period_end to subscriptions table

## Summary
Adds a `cancel_at_period_end` boolean column to the `subscriptions` table
so the client can display whether a scheduled cancellation is pending
and offer a "Resume" action. Defaults to false.
*/

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;
