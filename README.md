# Conduit — landing page

Marketing site for **Conduit**, a native in-engine Model Context Protocol (MCP)
server for Unreal Engine that lets AI agents build games from prompts.

A single self-contained static page (`index.html`) — no build step, no dependencies.
Deployed via Cloudflare Pages.

## Local preview

Open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 8080   # then visit http://localhost:8080
```

## Notes

- Action CTAs read "Coming soon" until the product is live.
- Independent project, not affiliated with Epic Games or Unreal Engine.

## Pages

- `index.html` — the marketing landing page.
- `success.html` — post-purchase confirmation. Set this as the Polar checkout **success URL**
  (`https://conduit.unrealtools.com/success`). It explains the four onboarding steps: receipt
  email, GitHub repo invite, download the Release zip, drop into `Plugins/` and compile. Both
  files are uploaded together on every deploy.

## Deploy / update

Hosted on **Cloudflare Pages** (project `agentconduit-site`, domain `conduit.unrealtools.com`)
via wrangler **direct upload** — pushing this repo does NOT auto-deploy. To ship a change,
run wrangler from a non-repo dir so its `.wrangler` cache never lands in the repo:

```bash
D=$(mktemp -d) && cp index.html "$D"/
cd "$D" && npx wrangler pages deploy . --project-name agentconduit-site --branch main --commit-dirty=true
```

Requires a Cloudflare login once (`npx wrangler login`). `conduit.unrealtools.com` is a
subdomain of the `unrealtools.com` Cloudflare zone, so its DNS + cert were auto-provisioned
when the custom domain was registered on the Pages project.
