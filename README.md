# CareOS — Family Care Coordination

A web-first platform for families to coordinate care for aging parents, chronic conditions, or any shared health responsibility.

## Features

- **Family Groups** — Create or join a group with a 6-digit invite code
- **Medication Tracker** — Add medications, track daily doses, view streaks and history
- **Shared Calendar** — Schedule appointments, medication refills, and events
- **Document Vault** — Upload and share insurance cards, medical records, emergency info
- **SMS Reminders** — Twilio-powered text reminders (optional, configurable)

## Tech Stack

- Next.js 14 (App Router)
- React 18
- Tailwind CSS
- Firebase (Auth, Firestore, Storage)
- Twilio (SMS)
- Lucide React (icons)
- date-fns (date formatting)
- react-hot-toast (notifications)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Firebase

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project named "CareOS"
3. Enable **Authentication** → Sign-in method → **Google**
4. Create **Cloud Firestore** database → Start in **test mode**
5. Go to **Storage** → Get started → Default bucket
6. Go to Project Settings → Your apps → Web app → Register app
7. Copy the config keys into `.env.local`

### 3. Configure Twilio (Optional — for SMS reminders)

1. Sign up at [twilio.com](https://twilio.com)
2. Get a phone number ($1/month)
3. Copy Account SID, Auth Token, and phone number into `.env.local`

### 4. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your keys:

```bash
cp .env.local.example .env.local
```

### 5. Firebase Security Rules

Paste these rules in Firebase Console → Firestore Database → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /familyGroups/{groupId} {
      allow read, write: if request.auth != null && request.auth.uid in resource.data.members;
      allow create: if request.auth != null;
    }
    match /medications/{medId} {
      allow read, write: if request.auth != null && request.auth.uid in get(/databases/$(database)/documents/familyGroups/$(resource.data.familyGroupId)).data.members;
    }
    match /events/{eventId} {
      allow read, write: if request.auth != null && request.auth.uid in get(/databases/$(database)/documents/familyGroups/$(resource.data.familyGroupId)).data.members;
    }
    match /documents/{docId} {
      allow read, write: if request.auth != null && request.auth.uid in get(/databases/$(database)/documents/familyGroups/$(resource.data.familyGroupId)).data.members;
    }
    match /messages/{messageId} {
      allow read, write: if request.auth != null && request.auth.uid in get(/databases/$(database)/documents/familyGroups/$(resource.data.familyGroupId)).data.members;
    }
  }
}
```

### 6. Firebase Storage Rules

Paste these in Firebase Console → Storage → Rules:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /vaults/{groupId}/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 7. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
careos/
├── app/
│   ├── page.js              # Landing page
│   ├── layout.js            # Root layout with auth provider
│   ├── globals.css          # Tailwind + custom styles
│   ├── dashboard/           # Main dashboard
│   ├── family/              # Create/join family group
│   ├── medications/           # Medication tracker
│   ├── calendar/            # Shared calendar
│   ├── vault/               # Document storage
│   └── api/remind/          # Twilio SMS API route
├── components/
│   ├── AuthProvider.js      # Firebase auth context
│   └── Navbar.js            # Navigation bar
├── lib/
│   └── firebase.js          # Firebase configuration
├── public/                  # Static assets
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── jsconfig.json
├── next.config.js
└── .env.local.example
```

## Deployment

### Vercel (Recommended)

```bash
npm i -g vercel
vercel
```

Add your environment variables in the Vercel dashboard under Project Settings → Environment Variables.

## Roadmap

- [ ] Push notifications
- [ ] Recurring medication schedules
- [ ] Care notes / journal
- [ ] Emergency contact card (QR code)
- [ ] Subscription billing (Stripe)
- [ ] Mobile app (React Native / Expo)

## License

MIT
