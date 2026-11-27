import sys
from playwright.sync_api import sync_playwright
from PIL import Image
src="file://"+__import__("os").path.abspath("mock.html")
jobs=[('m1',360,800,2,'groovebox-mobile-1-harmony-pad'),('m2',360,800,2,'groovebox-mobile-2-kick-thump'),('m3',360,800,2,'groovebox-mobile-3-top-styles'),('t1',1280,800,1.5,'groovebox-tablet-1-harmony-pad'),('t2',1280,800,1.5,'groovebox-tablet-2-kick-styles'),('t3',1280,800,2,'groovebox-y700-perform'),('t3a',1280,800,2,'groovebox-y700-perform-thumb-zones')]
with sync_playwright() as p:
    try: b=p.chromium.launch()
    except Exception: b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    for h,w,ht,s,name in jobs:
        pg=b.new_page(viewport={'width':w,'height':ht},device_scale_factor=s)
        pg.goto(src+'#'+h); pg.wait_for_timeout(300)
        pg.screenshot(path=name+'.png')
        Image.open(name+'.png').convert('RGB').save(name+'.jpg',quality=90)
        pg.close()
    b.close()
