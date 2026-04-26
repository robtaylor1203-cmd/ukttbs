import os

files = ['about.html', 'mission.html', 'team.html', 'events.html', '100-club.html', 'raffle.html', 'privacy.html', '404.html', 'account.html', 'thank-you.html', 'admin.html']

for f in files:
    if os.path.exists(f):
        with open(f, 'r', encoding='utf-8') as file:
            content = file.read()
            
        content = content.replace('<button class="menu-toggle magnetic" aria-label="Toggle menu">', '<div class="menu-toggle magnetic" aria-label="Toggle menu">')
        content = content.replace('</button>\n  </nav>', '</div>\n  </nav>')
        
        with open(f, 'w', encoding='utf-8') as file:
            file.write(content)
