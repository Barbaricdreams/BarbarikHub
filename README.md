# Budget App

This is a small static budget web app that reads a Google Sheet and displays budget data.

Deployment (GitHub Pages)

- Create a repository on GitHub (either via the website or `gh repo create`).
- Add the repository remote:

  ```powershell
  git remote add origin https://github.com/<USERNAME>/<REPO>.git
  ```

- Push `main` and `gh-pages` branches:

  ```powershell
  git push -u origin main
  git push -u origin gh-pages
  ```

- In the GitHub repository Settings → Pages, set the source branch to `gh-pages` and save. The site will be served at `https://<USERNAME>.github.io/<REPO>/`.

Notes

- The app currently hardcodes a Google Sheet URL and OAuth Client ID as defaults in `app.js`. You can remove them later and rely on the Settings UI.
- This app is static (HTML/CSS/JS) and works well served from GitHub Pages.
