"""Fusion, deploy, battle, replay without double rewards, and next round."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
with sync_playwright() as p:
    opts = {"headless": True, "args": ["--no-sandbox", "--disable-dev-shm-usage"]}
    if os.environ.get("CHROMIUM_EXECUTABLE"):
        opts["executable_path"] = os.environ["CHROMIUM_EXECUTABLE"]
    browser = p.chromium.launch(**opts)
    page = browser.new_page(viewport={"width": 430, "height": 932}, is_mobile=True, has_touch=True)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.set_content(HTML)
    page.evaluate("window.__jadeDebug.state().shop=['toru','toru','toru','lin','hae']")
    page.locator('[data-act=order][data-val=focus]').click()
    for i in range(3):
        page.locator(f'[data-act=buy][data-idx="{i}"]').click()
    state = page.evaluate("window.__jadeDebug.state()")
    assert len(state["bench"]) == 1 and state["bench"][0]["star"] == 2
    assert state["gold"] == 11
    page.locator("[data-act=auto]").click()
    assert page.evaluate("window.__jadeDebug.state().board[0].star") == 2
    page.locator("[data-act=fight]").click()
    assert page.evaluate("window.__jadeDebug.state().phase") == "battle"
    page.locator("[data-act=skip]").click()
    initial_result = page.evaluate("window.__jadeDebug.state()")
    assert initial_result["phase"] == "result"
    page.locator("[data-act=replay]").click()
    assert page.evaluate("window.__jadeDebug.state().phase") == "replay"
    page.locator("[data-act=skip]").click()
    replay_result = page.evaluate("window.__jadeDebug.state()")
    assert replay_result["phase"] == "result"
    assert replay_result["gold"] == initial_result["gold"]
    assert replay_result["life"] == initial_result["life"]
    page.locator("[data-act=next]").click()
    assert page.evaluate("window.__jadeDebug.state().round") == 2
    assert not errors, errors
    print("PASS fusion → deploy → battle → replay → next round; no JS errors")
    browser.close()
