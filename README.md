# Spaid on Security

Cybersecurity blog by [John Spaid](https://www.spaid.dev), Principal Technical Specialist at Microsoft focused on Security, Compliance, and Identity — and Customer Experience Leader for Oil, Gas, and Energy.

Live site: **https://www.spaid.dev**

---

## About the Blog

*Spaid on Security* covers practical cybersecurity topics with a Microsoft-stack focus: Microsoft Sentinel, Defender XDR, Entra ID (Azure AD), KQL, ASIM, Azure security, responsible disclosure, and related industry topics. Occasional posts touch on home network security, authentication, and personal opinions on the industry.

---

## Tech Stack

| Component | Detail |
|---|---|
| Generator | [Jekyll](https://jekyllrb.com/) 4.3.x |
| Theme | [minima](https://github.com/jekyll/minima) 2.5 |
| Hosting | GitHub Pages |
| Domain | spaid.dev (via CNAME) |
| Feed | jekyll-feed plugin (`/feed.xml`) |

---

## Local Development

### Prerequisites

- Ruby ≥ 3.1
- Bundler (`gem install bundler`)

### Setup

```bash
bundle install
```

### Serve locally

```bash
bundle exec jekyll serve
```

Browse to `http://localhost:4000`. The site rebuilds automatically when you save files (except `_config.yml` — restart the server after changing it).

### Build (static output)

```bash
bundle exec jekyll build
# output goes to _site/
```

---

## Repository Structure

```
.
├── _config.yml          # Site settings (title, URL, plugins)
├── _posts/              # Blog posts (Markdown)
├── about.markdown        # /about page
├── index.markdown        # Home page (uses "home" layout)
├── 404.html             # Custom 404 page
├── privacy-policy.html  # Privacy policy (for apps)
├── sightwordsapp.html   # Sight Words iOS app landing page
├── support.html         # App support page
├── CNAME                # Custom domain config for GitHub Pages
└── Gemfile              # Ruby gem dependencies
```

---

## Writing a New Post

1. Create a file in `_posts/` with the naming convention:

   ```
   YYYY-MM-DD-title-with-hyphens.md
   ```

2. Add front matter at the top of the file:

   ```yaml
   ---
   layout: post
   title: "Your Post Title"
   description: "One-sentence description for SEO and feed readers"
   date: YYYY-MM-DD HH:MM:SS -0600
   tags: tag1 tag2 tag3
   ---
   ```

   > **Note:** `tags` is space-separated in this site's convention (see existing posts). Use `categories` or `tags` — both work with minima.

3. Write the post body in Markdown below the front matter.

4. Code blocks: use fenced code blocks with a language hint (e.g., ` ```kusto `, ` ```bash `, ` ```powershell `).

5. Images: place image files in `assets/img/` and reference them in front matter as `img: filename.png`, or inline with standard Markdown `![alt](../assets/img/filename.png)`.

### Post Style Guide

- **Audience:** Security practitioners and IT professionals; assume comfort with Azure and Microsoft 365 tooling.
- **Tone:** Direct, practical, and technically precise. Personal opinions are welcome but clearly labeled.
- **KQL/code blocks:** Always include complete, runnable query examples. Add inline comments for non-obvious logic.
- **Links:** Link to official Microsoft docs (`learn.microsoft.com`, `aka.ms` short links preferred) and reputable sources.
- **Responsible disclosure:** When writing about vulnerabilities or exposures, document your disclosure timeline and any vendor responses.

---

## Deployment

Pushes to `main` trigger an automatic GitHub Pages build and deploy. No CI/CD action is required — GitHub handles it natively for Jekyll sites.

---

## Configuration Reference

Key settings in `_config.yml`:

| Setting | Value |
|---|---|
| `title` | Spaid on Security |
| `email` | john@spaid.dev |
| `url` | https://www.spaid.dev |
| `twitter_username` | x3nc0n |
| `github_username` | x3nc0n |
| `theme` | minima |

---

## License

Content on this site is the personal opinion of John Spaid and does not represent his employer.
