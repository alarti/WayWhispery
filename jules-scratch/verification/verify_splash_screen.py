import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Capture console logs
        logs = []
        page.on('console', lambda msg: logs.append(msg.text))

        try:
            # Go to the local server
            await page.goto('http://localhost:8080/index.html')

            # 1. Take a screenshot of the initial splash screen
            await page.screenshot(path='jules-scratch/verification/01_splash_screen.png')

            # 2. Click on the English flag
            english_flag = page.locator('img[data-lang="en"]')
            await english_flag.click()

            # Wait for the guide to be loaded and rendered
            guide_title_selector = "h5.card-title:has-text('Essential Alhambra Guide')"
            await page.wait_for_selector(guide_title_selector, timeout=15000)

            # 3. Take a screenshot of the main application
            await page.screenshot(path='jules-scratch/verification/02_main_app_english_filtered.png')

        except Exception as e:
            print(f"An error occurred during verification: {e}")
            # Take a screenshot on failure to see the state
            await page.screenshot(path='jules-scratch/verification/error_screenshot.png')

        finally:
            print("\n--- Browser Console Logs ---")
            for log in logs:
                print(log)
            print("--------------------------\n")
            await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
