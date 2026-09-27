# Supabase Auth email templates (4 languages)

Paste into Supabase → Authentication → Emails → Templates for the firstpayday project:
- Confirm signup: `confirm_signup.subject.txt` / `confirm_signup.html`
- Magic link: `magic_link.subject.txt` / `magic_link.html`
- Reset password: `reset_password.subject.txt` / `reset_password.html`

The language comes from the user's metadata `locale`, which signup stores (en/fr/es/pt); anything else falls back to English.
