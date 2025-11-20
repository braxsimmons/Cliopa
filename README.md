# TLC

## Prerequisites

- Docker
- NPM (highly recommend to use a Node versioning tool such as [`fnm`](https://github.com/Schniz/fnm)
  or [`nvm`](https://github.com/nvm-sh/nvm))

## Getting Started

1. Install project dependencies (`npm ci`)
1. Initialize the local Supabase database (`npx supabase start`)
1. Copy the `.env.example` file to `.env.local`.
1. Copy the value from the "anon key" output of `npx supabase start` to `.env.local` as
   VITE_SUPABASE_ANON_KEY.
1. Run `npm run dev` to launch the app.

## Supabase

Read the README located in the Supabase directory for a better understanding of the file layout. See
[Supabase CLI Reference](https://supabase.com/docs/reference/cli/start) for how to use the CLI. Key
commands include: `start` (to begin the cluster), `stop` (to terminate the cluster), `db diff` (with
a stopped cluster this will generate a good approximation of the changes in the declarative schema
files to the current DB schema), and `db reset` (which drops the database, runs all migrations,
seeds the database, and restarts the cluster).
