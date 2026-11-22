# Smash Verse Pro

React and Vite frontend for player profiles, season standings, and live match scores. Public pages read from Firestore.

## Run locally

```powershell
npm install
npm run dev
```

The Firebase web app configuration is in `src/firebase.js`.

## Firestore data

The app reads these collections from the existing Firebase project:

- `smashVersePlayers`
- `smashVerseSeasons`
- `smashVerseMatches`
- `smashVerseSettings`

The `/admin` page checks the entered PIN against the `adminPin` field in `smashVerseSettings`, and supports creating Singles seasons, players, and matches plus scoring current-season matches. The PIN check only controls the page display and is not authorization. The browser reads the PIN and writes directly to Firestore, so anyone can inspect the PIN and write data if the rules permit it. Do not put other secrets in that collection.

The dashboard leaderboard and player cards use completed matches from the current season. They award 2 league points per win and calculate Played, Won, Lost, Points For, Points Against, and point Difference from match scores.

The Admin page needs Firestore read access for its data collections and write access for `smashVerseSeasons`, `smashVersePlayers`, and `smashVerseMatches`. These writes are public if allowed by the rules. For example, merge these matches into the existing rules to permit the current UI operations:

```text
match /smashVerseSettings/{id} {
  allow read: if true;
  allow write: if false;
}
match /smashVerseSeasons/{id} {
  allow read: if true;
  allow create, update: if true;
  allow delete: if false;
}
match /smashVersePlayers/{id} {
  allow read: if true;
  allow create: if true;
  allow update, delete: if false;
}
match /smashVerseMatches/{id} {
  allow read: if true;
  allow create, update: if true;
  allow delete: if false;
}
match /smashVerseTournaments/{id} {
  allow read: if true;
  allow write: if false;
}
```

For protected in-app editing, use Firebase Authentication or a trusted server-side backend.

When changing Firestore rules in the shared project, merge collection-specific rules into the existing rules and review broad wildcard grants. Public pages need read access to public collections and the settings collection. If you choose to allow client writes, restrict them to the Smash Verse collections so they do not affect the chess app's data.

## Deploy on GitHub Pages

The `.github/workflows/deploy.yml` workflow builds and deploys the site whenever changes are pushed to `main`. In the GitHub repository, open **Settings → Pages** and set the build and deployment source to **GitHub Actions**. After the workflow succeeds, the site is available at `https://<owner>.github.io/<repository>/`.

The Vite config automatically sets the Pages base path from the repository name. The Admin link uses a query URL (`?admin=1`) so it works with GitHub Pages static hosting.
