# Preserved Technician assets

Captured from the published article on September 24, 2026. `manifest.json`
records the original URL and SHA-256 of every localized asset. Stylesheet
`url()` references point to this directory. Font Awesome files come from the
matching official npm releases; their licenses are included.

The build and archive-finalization workflows run `scripts/localize_technician.py`
to verify the captured files and replace the archive's stylesheet and masthead
URLs. Unrecognized external stylesheets fail the build instead of silently
reintroducing a remote layout dependency.

The theme also names three legacy navigation images (bulletarrow.png,
down-arrow.png, bg_direction_nav.png) unused by this article, and two legacy
Dashicons EOT/TTF fallbacks. Those five files were unavailable; Dashicons has an
embedded WOFF source. The captured article's layout and text/icon fonts are
local. Interactive Datawrapper maps and uncaptured related-story thumbnails
remain external. This is an article preservation bundle, not an offline copy
of the entire publication.
