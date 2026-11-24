"""Smoke test for desktop and mobile using Playwright Python + Chromium."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
def launch(p):
    binary = os.environ.get("CHROMIUM_EXECUTABLE")
    opts = {"headless": True, "args": ["--no-sandbox", "--disable-dev-shm-usage"]}
    if binary:
        opts["executable_path"] = binary
    return p.chromium.launch(**opts)

with sync_playwright() as p:
    browser = launch(p)
    for viewport in [{"width": 1440, "height": 900}, {"width": 430, "height": 932}]:
        mobile = viewport["width"] < 500
        page = browser.new_page(viewport=viewport, is_mobile=mobile, has_touch=mobile)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.set_content(HTML)
        assert page.locator(".square").count() == 56
        assert page.locator(".shop-card").count() == 5
        assert page.evaluate("document.documentElement.scrollWidth") <= viewport["width"], "Horizontal overflow"
        if mobile:
            page.locator("[data-act=buy]").first.click()
            assert page.locator(".bench-slot .miniature").count() >= 1
            page.locator("[data-act=select]").first.click()
            page.locator(".square-own").first.click()
            page.locator("[data-act=auto]").click()
            page.locator("[data-act=fight]").click()
            assert page.evaluate("window.__jadeDebug.state().phase") == "battle"
            page.locator("[data-act=skip]").click()
            assert page.evaluate("window.__jadeDebug.state().phase") == "result"
            page.locator("[data-act=next]").click()
            assert page.evaluate("window.__jadeDebug.state().round") == 2
        assert not errors, errors
        print(f"PASS viewport={viewport['width']} mobile={mobile}")
        page.close()
    browser.close()
