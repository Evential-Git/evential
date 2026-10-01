"""Deterministic static blog builder, shared by the site and local newsletter publisher."""
from datetime import date, datetime, timezone
from email.utils import format_datetime
import html
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

BASE = 'https://evential.co'
def esc(value): return html.escape(str(value), quote=True)

def validate_post(post):
    if not isinstance(post,dict): raise ValueError('Invalid blog post.')
    for key in ('id','slug','title','excerpt','date','body_html'):
        if not isinstance(post.get(key),str) or not post[key].strip(): raise ValueError('Blog post needs '+key)
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',post['slug']) or len(post['slug'])>140: raise ValueError('Invalid blog slug.')
    date.fromisoformat(post['date'])
    if post.get('date_precision','day') not in ('day','month'): raise ValueError('Invalid date precision.')
    if len(post['title'])>200 or len(post['excerpt'])>400 or len(post['body_html'])>180000: raise ValueError('Blog post is too long.')
    body=post['body_html']
    if re.search(r'<\s*(script|iframe|object|embed|form|input|style|meta|link)\b|\bon\w+\s*=|javascript\s*:',body,re.I):
        raise ValueError('Unsafe markup in public blog content.')
    public=json.dumps(post)
    if re.search(r'unsubscribe(?:%23|#)token|unsubscribe_token|urldefense\.proofpoint|<< Test First Name|{{|sb_secret_|sb_publishable_',public,re.I):
        raise ValueError('Private or unconverted email content must not be published.')
    for key in ('image_url',):
        image=post.get(key,'')
        if image and not (image.startswith('/images/') or image.startswith('https://')):
            raise ValueError('Blog images need an HTTPS or local image URL.')
    return post

def display_date(post):
    d=date.fromisoformat(post['date'])
    return d.strftime('%B %Y') if post.get('date_precision')=='month' else d.strftime('%B %-d, %Y')

def frame(title,description,path,body,image='/images/og-image.jpg',schema=None):
    image=BASE+image if image.startswith('/') else image
    structured='<script type="application/ld+json">'+json.dumps(schema,ensure_ascii=False).replace('<','\\u003c')+'</script>' if schema else ''
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)} | Evential</title><meta name="description" content="{esc(description)}"><meta name="theme-color" content="#0B1B4D">
<link rel="canonical" href="{BASE}{esc(path)}"><meta property="og:type" content="{'article' if schema else 'website'}"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(description)}"><meta property="og:url" content="{BASE}{esc(path)}"><meta property="og:image" content="{esc(image)}">
<link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/evential.css"><link rel="stylesheet" href="/blog/blog.css"><link rel="alternate" type="application/rss+xml" title="Evential Journal" href="/blog/feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;family=Montserrat+Alternates:wght@800&amp;display=swap" rel="stylesheet">{structured}</head>
<body class="blog-page"><a href="#main-content" class="skip-link">Skip to content</a>
<nav id="main-nav">
  <div class="nav-inner">
    <div class="nav-left">
      <a href="/" class="nav-logo">EVENTIAL</a>
      <ul class="nav-links" id="nav-links">
        <li><a href="/#system">How it works</a></li>
        <li><a href="/events-measured" data-nav="events">Results</a></li>
        <li><a href="/discovery" data-nav="discovery">Sponsor Discovery</a></li>
        <li><a href="/pricing" data-nav="pricing">Pricing</a></li>
        <li><a href="/blog/" data-nav="blog" class="active" aria-current="page">Blog</a></li>
        <li><a href="/vision" data-nav="vision">Vision</a></li>
      </ul>
    </div>
    <div class="nav-actions">
      <a href="https://calendly.com/contact-evential/30min" target="_blank" rel="noopener" class="btn btn-primary" style="padding:.55rem 1.15rem">Plan event coverage</a>
      <button class="mobile-btn" id="mobile-btn" aria-label="Open menu"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
    </div>
  </div>
</nav>
<main id="main-content">{body}</main>
<footer class="journal-footer"><div class="container"><a class="nav-logo" href="/">EVENTIAL</a><p>The measurement layer for real-world marketing.</p><div><a href="/blog/">Journal</a><a href="/#mailing-list">Newsletter</a><a href="/privacy">Privacy</a><a href="mailto:contact@evential.co">Contact</a></div></div></footer><script src="/site.js" defer></script></body></html>'''

def render_post(post):
    validate_post(post)
    label=display_date(post)
    category=post.get('category','Company update')
    image=post.get('image_url','')
    hero=f'<figure class="article-hero"><img src="{esc(image)}" alt="{esc(post.get("image_alt",""))}" fetchpriority="high">{("<figcaption>"+esc(post.get("image_caption"))+"</figcaption>") if post.get("image_caption") else ""}</figure>' if image else ''
    source=f'<p class="archive-note">{esc(post["source_note"])}</p>' if post.get('source_note') else ''
    schema={'@context':'https://schema.org','@type':'BlogPosting','headline':post['title'],'description':post['excerpt'],'url':BASE+'/blog/'+post['slug']+'/',
            'author':{'@type':'Organization','name':'Evential'},'publisher':{'@type':'Organization','name':'Evential'}}
    if post.get('date_precision')!='month':schema['datePublished']=post['date']
    if post.get('archived_at'):schema['dateModified']=post['archived_at']
    if image:schema['image']=BASE+image if image.startswith('/') else image
    body=f'''<header class="article-heading container"><a class="journal-back" href="/blog/">← All stories</a><div class="journal-meta"><span>{esc(category)}</span><time datetime="{post['date'][:7] if post.get('date_precision')=='month' else post['date']}">{label}</time></div><h1>{esc(post['title'])}</h1><p class="article-deck">{esc(post['excerpt'])}</p>{source}</header>{hero}<article class="article-body">{post['body_html']}</article><aside class="journal-signup container"><span class="eyebrow">Keep in touch</span><h2>The next chapter, in your inbox.</h2><p>Company news, product updates and stories from the event floor.</p><a class="btn btn-primary" href="/#mailing-list">Join the newsletter</a></aside>'''
    return frame(post['title'],post['excerpt'],'/blog/'+post['slug']+'/',body,image or '/images/og-image.jpg',schema)

def render_index(posts):
    items=[]
    for i,p in enumerate(posts):
        image=f'<img src="{esc(p["image_url"])}" alt="{esc(p.get("image_alt",""))}" loading="{"eager" if i==0 else "lazy"}">' if p.get('image_url') else '<div class="journal-card-art"><span>EVENTIAL</span><strong>From the<br>event floor.</strong></div>'
        items.append(f'''<a class="journal-card {'journal-featured' if i==0 else ''}" href="/blog/{esc(p['slug'])}/"><div class="journal-card-image">{image}</div><div class="journal-card-copy"><div class="journal-meta"><span>{esc(p.get('category','Company update'))}</span><span>{display_date(p)}</span></div><h2>{esc(p['title'])}</h2><p>{esc(p['excerpt'])}</p><span class="journal-read">Read the story <span aria-hidden="true">↗</span></span></div></a>''')
    body='<header class="journal-heading container"><span class="eyebrow">The Evential journal</span><h1>Notes from<br>the event floor.</h1><p>What we’re building, what we’re learning, and the people and events moving us forward.</p></header><div class="container journal-grid">'+''.join(items)+'</div>'
    return frame('Journal','Evential company news, product updates and stories from the event floor.','/blog/',body)

def build_files(posts,sitemap):
    posts=sorted([validate_post(p) for p in posts],key=lambda p:(p['date'],p['id']),reverse=True)
    if len({p['id'] for p in posts})!=len(posts) or len({p['slug'] for p in posts})!=len(posts):raise ValueError('Duplicate blog ID or slug.')
    files={'blog/posts.json':json.dumps(posts,indent=2,ensure_ascii=False)+'\n','blog/index.html':render_index(posts)}
    for post in posts:files['blog/'+post['slug']+'/index.html']=render_post(post)
    rss=ET.Element('rss',version='2.0');channel=ET.SubElement(rss,'channel')
    for key,value in [('title','Evential Journal'),('link',BASE+'/blog/'),('description','Company news and stories from the event floor.')]:ET.SubElement(channel,key).text=value
    for p in posts:
        item=ET.SubElement(channel,'item')
        for key,value in [('title',p['title']),('link',BASE+'/blog/'+p['slug']+'/'),('guid',BASE+'/blog/'+p['slug']+'/'),('description',p['excerpt'])]:ET.SubElement(item,key).text=value
        day=p.get('archived_at') or p['date']
        ET.SubElement(item,'pubDate').text=format_datetime(datetime.fromisoformat(day).replace(tzinfo=timezone.utc))
    files['blog/feed.xml']=ET.tostring(rss,encoding='unicode',xml_declaration=True)
    ns='http://www.sitemaps.org/schemas/sitemap/0.9';ET.register_namespace('',ns);root=ET.fromstring(sitemap)
    for entry in list(root):
        loc=entry.find('{'+ns+'}loc')
        if loc is not None and (loc.text or '').startswith(BASE+'/blog'):root.remove(entry)
    for path,lastmod in [('/blog/',max((p.get('archived_at') or p['date'] for p in posts),default=date.today().isoformat()))]+[('/blog/'+p['slug']+'/',p.get('archived_at') or p['date']) for p in posts]:
        entry=ET.SubElement(root,'{'+ns+'}url');ET.SubElement(entry,'{'+ns+'}loc').text=BASE+path;ET.SubElement(entry,'{'+ns+'}lastmod').text=lastmod
    files['sitemap.xml']=ET.tostring(root,encoding='unicode',xml_declaration=True)
    return files

if __name__=='__main__':
    root=Path(__file__).resolve().parents[1]
    posts=json.loads((root/'blog/posts.json').read_text())
    for name,content in build_files(posts,(root/'sitemap.xml').read_text()).items():
        path=root/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(content)
    print(f'Built {len(posts)} posts, blog index, RSS feed and sitemap.')
