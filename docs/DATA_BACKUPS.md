# Clinic data backups

The app's **Settings → Clinic Data Backup** download creates a dated JSON copy of the clinic's profiles, roles, inventory batches and movement history, patients, transactions, payments, audit logs, and ecommerce records. It reads records as the signed-in clinic owner and fetches them in pages, so large clinics are not silently cut off at the API's first page.

The file contains clinic and patient information. Store it encrypted, restrict access, and keep a copy somewhere separate from the computer used to download it. This app export is a manual archive; it is not uploaded automatically and there is no in-app restore button yet. It intentionally excludes Supabase Auth credentials, M-Pesa secrets, security PIN hashes, invitation codes, and Storage file contents. Restoring it requires a controlled import that matches the destination schema and user IDs.

## Prevent connecting the app to the wrong database

The browser app is pinned to the live project `feiewilnuxeyuqvyuzxq`. If environment variables are absent, it uses the live project's URL and publishable key defaults; it rejects any configured URL for a different project at startup/build time. Settings also displays the connected project reference. You can set matching values in local `.env.local` or Vercel's Production and Preview variables when desired. Never put the backup project's URL or key in the app's `VITE_SUPABASE_*` variables. Database replication credentials belong only in database-side replication setup; never commit them to GitHub or send them in chat.

## Protect the live Supabase project

Use Supabase's own database backup feature as the recovery layer for the live database, including account records. Supabase currently takes daily backups on Pro, Team, and Enterprise plans; Point-in-Time Recovery is an optional add-on for shorter recovery windows. Free plan projects should make regular exports and keep off-site copies. Check the current project plan and backup status in **Supabase Dashboard → Database → Backups**.

Restoring a database backup replaces the target database state and causes downtime. For recovery, restore to a separate project first, verify the clinic data, Auth users, and app behavior, then plan any cutover. Database backups do not contain Storage file contents, so uploaded files need a separate backup and recovery plan.

- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase CLI backup and restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)

## Recovery checks

1. Check the dashboard's latest database recovery point.
2. For an independent clinic archive, download the JSON from Settings and move it off the device.
3. Keep uploaded Storage files separately; the JSON and database backup contain their records/metadata but not the file bytes.
4. Periodically restore a database backup to a separate project and confirm the expected Auth users and clinic records are present.

Do not commit backup files, database connection strings, or service-role keys to this repository.
