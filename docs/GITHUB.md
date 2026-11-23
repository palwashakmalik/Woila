# Publish Woila to palwashakmalik

The public source repository is `palwashakmalik/Woila`. For command-line publishing, GitHub authentication needs Contents write access to this repository and Workflows write access to push the included GitHub Actions workflow. Never force-push over other contributors’ work.

Never paste a personal access token into a conversation, source file, command-line argument, Git remote URL, documentation, or commit. Use GitHub CLI's browser sign-in on your own computer, or GitHub Desktop.

## GitHub CLI

Install Git and GitHub CLI from their official sources. Open a terminal in the extracted `woila` folder:

```sh
gh auth login --hostname github.com --git-protocol https --web
gh auth status
gh api user --jq .login
```

Continue only if the reported login is the intended account, `palwashakmalik`.

```sh
git init -b main
git add .
git commit -m "Implement Woila language, CLI, browser editor and Chrome extension"
gh repo create palwashakmalik/Woila --public --source=. --remote=origin --push
git tag v0.1.0
git push origin v0.1.0
gh repo view palwashakmalik/Woila --web
```

The example creates the **public, open-source Woila repository** requested by the owner. If that repository name already exists, inspect its contents and intentionally add it as a remote; do not force-push over existing work. If Git asks for your identity, configure your own name and GitHub email before committing. The version tag is used by generated starter projects.

The source includes a GitHub Actions workflow that rebuilds and runs the tests using Node 24 on pushes and pull requests. `dist` and other build output are regenerated. Build before trying to load the extension from a fresh checkout.

## GitHub Desktop

Sign into GitHub Desktop as `palwashakmalik`. Add the extracted source folder as a repository; initialize it if prompted. Commit the files, choose **Publish repository**, use `Woila` as the name, and select public visibility for the open-source release. Review the published repository to confirm the files arrived. No token needs to be shared with the assistant.

## Publishing release downloads later

Run `npm run package`, then attach the generated full project ZIP and extension ZIP to a GitHub release if you want users to download them. The package is not published on npm or the Chrome Web Store. Those are separate distribution steps and need the relevant account setup.
