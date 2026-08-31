(function(){
'use strict';

/* sticky nav background swap */
var nav=document.getElementById('main-nav');
if(nav){window.addEventListener('scroll',function(){nav.classList.toggle('scrolled',window.scrollY>40)},{passive:true})}

/* mobile nav: proper aria-expanded, Escape-to-close, focus return */
var mb=document.getElementById('mobile-btn'),nl=document.getElementById('nav-links');
if(mb&&nl){
  mb.setAttribute('aria-expanded','false');
  mb.setAttribute('aria-controls','nav-links');
  mb.addEventListener('click',function(){
    var open=nl.classList.toggle('show');
    mb.setAttribute('aria-expanded',String(open));
    if(nav)nav.classList.toggle('menu-open',open);
  });
  nl.querySelectorAll('a').forEach(function(a){
    a.addEventListener('click',function(){
      nl.classList.remove('show');mb.setAttribute('aria-expanded','false');
      if(nav)nav.classList.remove('menu-open');
    });
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&nl.classList.contains('show')){
      nl.classList.remove('show');mb.setAttribute('aria-expanded','false');
      if(nav)nav.classList.remove('menu-open');mb.focus();
    }
  });
}

/* scroll reveal */
var revealObs=new IntersectionObserver(function(entries){
  entries.forEach(function(en){if(en.isIntersecting){en.target.classList.add('visible');revealObs.unobserve(en.target)}});
},{threshold:0.1,rootMargin:'0px 0px -30px 0px'});
document.querySelectorAll('.reveal,.ed-scale-in').forEach(function(el){revealObs.observe(el)});

/* count-up: value already printed in markup as the true number; animates only
   with no motion preference, and always leaves the real number if JS fails or
   the element never intersects. */
var reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(!reduceMotion){
  var countObs=new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(!en.isIntersecting)return;
      var el=en.target,target=parseFloat(el.dataset.target||el.textContent.replace(/[^0-9.]/g,''));
      if(!isFinite(target)){countObs.unobserve(el);return}
      var dur=1100,start=performance.now();
      function up(now){
        var p=Math.min(Math.max(0,(now-start)/dur),1),eased=1-Math.pow(1-p,3);
        el.textContent=Math.round(eased*target).toLocaleString('en-US');
        if(p<1)requestAnimationFrame(up);
      }
      requestAnimationFrame(up);
      countObs.unobserve(el);
    });
  },{threshold:0.5});
  document.querySelectorAll('.count-up').forEach(function(el){
    if(!el.dataset.target)el.dataset.target=el.textContent.replace(/[^0-9.]/g,'');
    countObs.observe(el);
  });
}

/* faq accordion */
window.toggleFaq=function(btn){
  var item=btn.closest('.faq-item'),open=item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(function(el){
    el.classList.remove('open');el.querySelector('.faq-q').setAttribute('aria-expanded','false');
  });
  if(!open){item.classList.add('open');btn.setAttribute('aria-expanded','true')}
};

/* analytics, deferred off the critical path but not hidden behind a magic 2s wait */
window.addEventListener('load',function(){
  setTimeout(function(){
    var s=document.createElement('script');
    s.src='https://www.googletagmanager.com/gtag/js?id=G-G7FL21YMQC';s.async=true;
    document.head.appendChild(s);
  },400);
});
window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments)}
gtag('js',new Date());gtag('config','G-G7FL21YMQC');

/* ---- conversion instrumentation ----
   Without these, "did the rebuild work" has no answer. Every CTA carries a
   data-cta naming its position, so position and conversion can be compared. */

document.addEventListener('click',function(e){
  var el=e.target.closest('[data-cta]');
  if(!el)return;
  var loc=el.dataset.cta,label=(el.textContent||'').trim().slice(0,60);
  gtag('event','cta_click',{location:loc,label:label,page:location.pathname});

  var href=el.getAttribute('href')||'';
  if(href.indexOf('calendly.com')>-1){
    gtag('event','calendly_open',{source_page:location.pathname,position:loc});
  }else if(/\.pdf($|\?)/i.test(href)){
    gtag('event','pdf_download',{asset:href.split('/').pop(),position:loc});
  }else if(href.indexOf('discovery.evential.co')>-1){
    gtag('event','discovery_open',{source_page:location.pathname});
  }
});

/* email capture: fires on submit, before the form navigates away */
document.querySelectorAll('form[action*="formspree"]').forEach(function(f){
  f.addEventListener('submit',function(){
    gtag('event','email_capture',{source_page:location.pathname,offer:'ncaec_report'});
  });
});

/* Calendly posts a message when a booking actually completes. Without this,
   a click and a booking are indistinguishable. */
window.addEventListener('message',function(e){
  if(!e.data||typeof e.data!=='object')return;
  if(e.data.event==='calendly.event_scheduled'){
    gtag('event','calendly_booked',{source_page:location.pathname});
  }
});

/* did the visitor actually reach the proof? */
var proofEl=document.querySelector('#proof,.ev-results');
if(proofEl){
  var po=new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(en.isIntersecting){
        gtag('event','proof_view',{page:location.pathname});
        po.disconnect();
      }
    });
  },{threshold:0.4});
  po.observe(proofEl);
}

/* tag Calendly links so bookings attribute back to a page and a position */
document.querySelectorAll('a[href*="calendly.com"]').forEach(function(a){
  var u;
  try{ u=new URL(a.href); }catch(err){ return; }
  if(u.searchParams.get('utm_source'))return;
  u.searchParams.set('utm_source','evential.co');
  u.searchParams.set('utm_medium','cta');
  u.searchParams.set('utm_content',(location.pathname.replace(/^\/|\.html$/g,'')||'home')+'-'+(a.dataset.cta||'unknown'));
  a.href=u.toString();
});

})();
