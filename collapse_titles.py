import os
import re

files = [
    'mission.html', 'raffle.html', 'account.html', 'admin.html', 
    'privacy.html', '404.html', 'thank-you.html'
]

for f in files:
    if os.path.exists(f):
        with open(f, 'r', encoding='utf-8') as file:
            content = file.read()
            
        # Use regex to find <h1 class="hero-title">...</h1> and collapse it if it has multiple lines
        pattern = re.compile(r'<h1 class="hero-title">(.*?)</h1>', re.DOTALL)
        
        def repl(match):
            inner = match.group(1)
            # extract all text from <span class="hero-word">...</span>
            words = re.findall(r'<span class="hero-word.*?>(.*?)</span>', inner)
            if not words:
                return match.group(0)
            
            combined_text = " ".join([w.strip() for w in words if w.strip()])
            
            new_inner = f'\n        <div class="line" style="overflow:visible;"><span class="hero-word" style="font-size: clamp(3rem, 8vw, 8rem); white-space: nowrap;">{combined_text}</span></div>\n      '
            return f'<h1 class="hero-title">{new_inner}</h1>'

        new_content = pattern.sub(repl, content)
        
        with open(f, 'w', encoding='utf-8') as file:
            file.write(new_content)
