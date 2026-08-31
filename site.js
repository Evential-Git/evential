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

/* legal-document scrollspy: keep the desktop contents rail tied to the
   section currently being read. The policy remains fully usable without JS. */
var legalToc=document.querySelector('.legal-toc');
if(legalToc){
  var legalLinks=Array.from(legalToc.querySelectorAll('a[href^="#"]'));
  var legalSections=legalLinks.map(function(link){
    return document.getElementById(link.getAttribute('href').slice(1));
  }).filter(Boolean);
  var legalFrame=0;
  function updateLegalToc(){
    legalFrame=0;
    var marker=window.scrollY+Math.min(180,window.innerHeight*.28);
    var current=legalSections[0];
    legalSections.forEach(function(section){
      if(section.offsetTop<=marker)current=section;
    });
    if(window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-8){
      current=legalSections[legalSections.length-1];
    }
    legalLinks.forEach(function(link){
      var active=current&&link.getAttribute('href')==='#'+current.id;
      if(active)link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    });
  }
  function queueLegalToc(){
    if(!legalFrame)legalFrame=requestAnimationFrame(updateLegalToc);
  }
  window.addEventListener('scroll',queueLegalToc,{passive:true});
  window.addEventListener('resize',queueLegalToc);
  legalLinks.forEach(function(link){link.addEventListener('click',function(){requestAnimationFrame(updateLegalToc)})});
  updateLegalToc();
}

})();
