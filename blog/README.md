# Evential blog

Public source: `posts.json`. Run `python3 tools/blog_builder.py` from the repository
root to rebuild articles, the index, RSS, and sitemap. `blog.css` supplies the
editorial layout and Evential section colors.

The initial February, April and September 2026 stories are adapted from supplied
newsletters. Their displayed dates retain the original newsletter month; archive
notes disclose October 1, 2026 as the date added. The duplicate February-named
export with an April introduction was not published as a fourth story. Email
tracking links, recipients, greetings and unsubscribe footers are excluded.

The local, git-ignored `newsletter-studio` app can publish opted-in newsletters
through GitHub’s Git API. It generates only public content with this builder.
The local app, credentials and audience data must remain outside this directory.
