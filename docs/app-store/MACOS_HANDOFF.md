# macOS Handoff Checklist

Complete these steps on macOS before App Store packaging.

## Required Accounts

- Apple Developer Program membership.
- Supabase project owner access.
- GitHub access with a rotated token.

## Required macOS Tools

- Xcode latest stable version from the Mac App Store.
- Xcode Command Line Tools.
- Node.js LTS.
- npm or pnpm.
- CocoaPods if Capacitor plugins require it.
- Supabase CLI.

## Commands On macOS

```bash
cd path/to/app
npm install
cp .env.example .env
# Fill .env with Supabase URL, anon key, API URL.
npm run build
cd frontend
npx cap add ios
npm run ios:sync
npx cap open ios
```

## Xcode Setup

- Set Bundle ID: `com.a1studio.checkin`.
- Set Display Name: `A1 STUDIO暑期打卡`.
- Assign Apple Team.
- Configure signing.
- Add App Icons and Launch Screen.
- Set minimum iOS version.
- Archive from Xcode.
- Upload through Organizer or Transporter.

## App Store Connect Assets

- App name.
- Subtitle.
- Category: Education.
- Privacy Policy URL.
- Support URL.
- Marketing URL if available.
- Screenshots for required iPhone sizes.
- Test account for App Review.

## Review Test Account

Prepare at least:

- Owner/toni test account.
- Teacher test account.
- Student test account with Italian only.
- Student test account with Portfolio only.
- Student test account with both programs.

## Before Submission

- Verify no service role key exists in frontend build.
- Verify account deletion/data deletion flow or support request flow.
- Verify chat report/moderation flow.
- Verify offline/network error messages.
- Verify all HTTPS endpoints load on cellular network.
