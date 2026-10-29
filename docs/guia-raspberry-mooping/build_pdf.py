"""Genera docs/Guia-Raspberry-MooPing.pdf desde guia.html.

    pip install playwright && playwright install chromium   # una sola vez
    python3 docs/guia-raspberry-mooping/build_pdf.py
"""
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / 'Guia-Raspberry-MooPing.pdf'

HEADER = '<div style="font-size:7.5pt;color:#8a858e;width:100%;padding:0 18mm;font-family:Helvetica,Arial;">MooPing · Probar la Raspberry Pi</div>'
FOOTER = ('<div style="font-size:7.5pt;color:#8a858e;width:100%;padding:0 18mm;font-family:Helvetica,Arial;text-align:right;">'
          '<span class="pageNumber"></span> / <span class="totalPages"></span></div>')

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto((HERE / 'guia.html').as_uri())
    page.wait_for_load_state('networkidle')
    page.pdf(path=str(OUT), format='A4', print_background=True, prefer_css_page_size=True,
             display_header_footer=True, header_template=HEADER, footer_template=FOOTER)
    browser.close()
print(f'PDF generado: {OUT}')
