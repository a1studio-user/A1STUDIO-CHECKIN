# App Store Security and Compliance Gaps

## Must Fix Before Submission

1. Authentication

The legacy PWA uses custom username/password records. The industrial version must use Supabase Auth.

2. Authorization

Teacher and owner actions must be enforced server-side in Edge Functions and RLS.

3. User Generated Content

Chat requires report, block/hide, moderation, and support contact workflows.

4. Account/Data Deletion

Add either in-app deletion or a clear support-based data deletion request flow.

5. Privacy Policy

Publish a privacy policy explaining student data, chat data, homework/check-in data, retention, and deletion.

6. Audit Trail

Record teacher/owner operations: student creation, deletion, password reset, class changes, task edits, and chat moderation.

7. Secrets

Rotate exposed GitHub token. Keep service role keys only in Supabase Edge Function secrets.

8. Data Consistency

Use cloud as source of truth for account, class, permission, and deletion state. Local cache should only store UI preferences and short offline queues.

9. Review Readiness

Provide App Review with test accounts and explain that student registration is teacher-managed.

## Recommended Before Public Release

- Monitoring for Edge Function errors.
- Daily database backups.
- Test/staging Supabase project.
- Release rollback procedure.
- Automated smoke tests for login, create student, class assignment, homework, check-in, chat, and delete user.
