# supabase/sql

This directory contains the **core schema and security policies** for Tellari.

- **001_user_profiles.sql** → Extends `auth.users` with roles, client_id, contact_id.
- **002_messages.sql** → Core `messages`, `message_tags`, `message_contacts`, `message_clients`.
- **003_seed_messages.sql** → Example seed data (safe to leave in, skip in prod).
- **004_message_policies.sql** → Read + insert policies for messages/tags/recipients.
- **005_message_contacts_insert.sql** → Allow contacts to insert their own recipient row.
- **006_realtime_publication.sql** → Enable Supabase Realtime on feed tables.
- **007_debug_select_user.sql** → Quick helper to fetch a profile by email.
- **008_message_policies_insert.sql** → Refined insert policies for admins & clients.
- **009_message_policies_update_delete.sql** → Update/delete policies for messages & tags.
- **010_permissions_and_has_perm.sql** → Permission catalog + grants + `has_perm()`.
- **011_has_perm_rpc.sql** → RPC wrapper for permissions.
- **012_message_policies_with_permissions.sql** → Replace admin-only policies with permission checks.
- **013_grant_edit_delete.sql** → Example: grant edit/delete perms for a user.
- **014_add_manager_role.sql** → Add `manager` as a valid role.
- **015_fix_role_constraint.sql** → Constraint update for roles.
- **016_permissions_primitives_full.sql** → Consolidated perms + RLS rewrite.
- **017_promote_manager.sql** → Example: promote a user to `manager`.
- **018_grant_perms_manager.sql** → Grant perms scoped to client for manager.
- **019_grant_perms_global.sql** → Grant perms globally (all clients).
- **020_my_perms_view.sql** → Debugging view of perms by user/email.
- **021_feed_contacts_projects_view.sql** → Feed view with authors, avatars, projects.

> ⚠️ These scripts are meant to be applied in order.  
> If re-running on an existing DB, check for `drop` or `if not exists` clauses first.

---

### 📄 `supabase/seed/README.md`
```markdown
# supabase/seed

Contains **example/demo data** to help with local testing.

- Example messages and tags.
- Example recipients/read statuses.

Do **not** apply in production unless you want demo/test data.
