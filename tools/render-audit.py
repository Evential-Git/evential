from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUT = Path("/private/tmp/evential-audit")
PAGES = [
    "index.html",
    "dashboard.html",
    "discovery.html",
    "pricing.html",
    "events-measured.html",
    "event-ncaec-2026.html",
    "event-summit-2026.html",
    "method.html",
    "vision.html",
    "privacy.html",
    "terms.html",
]


def prepare(page):
    page.evaluate(
        """
        document.querySelectorAll('img[loading="lazy"]').forEach((img) => img.loading = 'eager');
        document.querySelectorAll('.reveal,.ed-scale-in').forEach((el) => {
          el.classList.add('visible');
          el.style.transition = 'none';
        });
        document.querySelectorAll('video').forEach((video) => video.pause());
        document.documentElement.style.scrollBehavior = 'auto';
        """
    )


OUT.mkdir(parents=True, exist_ok=True)
with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    for filename in PAGES:
        stem = Path(filename).stem
        for label, viewport in (
            ("desktop", {"width": 1440, "height": 1000}),
            ("mobile", {"width": 390, "height": 844}),
        ):
            page = browser.new_page(viewport=viewport, device_scale_factor=1)
            page.goto((ROOT / filename).as_uri(), wait_until="load")
            page.wait_for_timeout(500)
            prepare(page)
            height = page.evaluate("document.documentElement.scrollHeight")
            for y in range(0, height, viewport["height"]):
                page.evaluate("(y) => window.scrollTo(0, y)", y)
                page.wait_for_timeout(70)
            page.evaluate("window.scrollTo(0, 0)")
            page.wait_for_timeout(300)
            page.screenshot(path=OUT / f"{stem}-{label}.png", full_page=True)
            page.close()
    browser.close()
