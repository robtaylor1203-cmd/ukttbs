import os

files = ['mission.html', 'about.html', 'team.html', 'events.html', '100-club.html', 'raffle.html']

for f in files:
    if os.path.exists(f):
        with open(f, 'r', encoding='utf-8') as file:
            c = file.read()
            
        # Target specific patterns created in the cinematic layouts
        c = c.replace('class="club-hundred" style="height: 100vh;"', 'class="club-hundred" style="min-height: 60vh; padding: 10vh 0;"')
        c = c.replace('class="club-hundred" style="height: 100vh; background: #050505;"', 'class="club-hundred" style="min-height: 60vh; padding: 10vh 0; background: #050505;"')
        c = c.replace('class="club-hundred" style="height: auto; min-height: 100vh;', 'class="club-hundred" style="height: auto; min-height: 60vh;')
        c = c.replace('class="club-hundred" style="height: auto; min-height: 80vh;', 'class="club-hundred" style="height: auto; min-height: 60vh;')
        c = c.replace('class="club-hundred" style="height: 60vh;"', 'class="club-hundred" style="min-height: 40vh; padding: 10vh 0;"')
        
        # Interstitial and generic panel paddings
        c = c.replace('padding: 25vh 5vw;', 'padding: 10vh 5vw;')
        c = c.replace('padding: 20vh 5vw;', 'padding: 8vh 5vw;')
        
        # Grid layout margins (gap-closing)
        c = c.replace('margin-bottom: 8rem;', 'margin-bottom: 3rem;')
        c = c.replace('padding: 15vh;', 'padding: 10vh;')
        
        with open(f, 'w', encoding='utf-8') as file:
            file.write(c)
