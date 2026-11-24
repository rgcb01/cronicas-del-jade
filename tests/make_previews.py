"""Generate optional visual previews with Playwright (not required to run the game)."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "artifacts"
OUTPUT.mkdir(exist_ok=True)
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
with sync_playwright() as p:
    opts = {"headless": True, "args": ["--no-sandbox", "--disable-dev-shm-usage"]}
    if os.environ.get("CHROMIUM_EXECUTABLE"):
        opts["executable_path"] = os.environ["CHROMIUM_EXECUTABLE"]
    browser = p.chromium.launch(**opts)
    for width,height,name in [(1440,900,"desktop.png"),(430,932,"iphone.png")]:
        mobile = width < 500
        page = browser.new_page(viewport={"width":width,"height":height},is_mobile=mobile,has_touch=mobile)
        page.set_content(HTML)
        for _ in range(5):
            page.locator("[data-act=buy]:not([disabled])").first.click()
        page.locator("[data-act=auto]").click()
        page.screenshot(path=str(OUTPUT/name),full_page=not mobile)
        if mobile:
            page.locator("[data-act=fight]").click()
            page.wait_for_timeout(1200)
            page.screenshot(path=str(OUTPUT/"iphone_combat.png"))
        page.close()
    browser.close()
    print("Preview images saved in artifacts/")
