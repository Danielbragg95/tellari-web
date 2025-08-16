# Seed Data

This folder contains **sample data** for development and testing.  
These scripts are **not required in production**.

## Rules
- Number independently from schema, e.g. `001_*`, `002_*`.
- Safe to delete/reset between test runs.
- Only insert rows, never alter schema.

## Example
- `001_seed_messages.sql`

## How to apply
Run inside Supabase SQL Editor or via CLI:

```bash
supabase db remote commit
```
