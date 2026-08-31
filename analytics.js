(function(){
'use strict';

var GA_ID='G-G7FL21YMQC';

window.dataLayer=window.dataLayer||[];
window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};

/* Evential uses GA4 for first-party site measurement, not ad targeting. */
window.gtag('consent','default',{
  ad_storage:'denied',
  ad_user_data:'denied',
  ad_personalization:'denied',
  analytics_storage:'granted',
  functionality_storage:'granted',
  security_storage:'granted'
});
window.gtag('js',new Date());
window.gtag('config',GA_ID,{
  allow_google_signals:false,
  allow_ad_personalization_signals:false,
  send_page_view:true
});

function textOf(el){
  return (el.textContent||'').replace(/\s+/g,' ').trim().slice(0,100);
}

function placementOf(el){
  if(el.dataset&&el.dataset.cta)return el.dataset.cta;
  if(el.closest('#m-cta-bar'))return 'sticky';
  if(el.closest('nav'))return 'nav';
  if(el.closest('footer'))return 'footer';
  var region=el.closest('section[id],header[id]');
  if(region&&region.id)return region.id;
  if(el.closest('.ed-hero,.page-hero'))return 'hero';
  if(el.closest('.ed-cta,.home-closing'))return 'closing';
  return 'content';
}

function pagePath(){
  return location.pathname||'/';
}

function send(name,params){
  window.gtag('event',name,params||{});
}

/* Track the business actions that matter without sending names, emails or
   other user-entered values to Analytics. */
document.addEventListener('click',function(event){
  var link=event.target.closest('a[href]');
  if(!link)return;

  var href=link.getAttribute('href')||'';
  var placement=placementOf(link);
  var common={
    link_text:textOf(link),
    link_url:link.href,
    placement:placement,
    page_path:pagePath()
  };

  if(link.dataset.cta||/calendly\.com/i.test(href)){
    send('cta_click',common);
  }
  if(/calendly\.com/i.test(href)){
    send('calendly_open',common);
  }else if(/\.pdf(?:$|[?#])/i.test(href)){
    send('case_study_download',common);
  }else if(/discovery\.evential\.co/i.test(href)){
    send('discovery_open',common);
  }else if(/^mailto:/i.test(href)){
    send('contact_click',common);
  }
});

function ready(){
  /* Give Calendly enough source context to attribute a meeting request. */
  document.querySelectorAll('a[href*="calendly.com"]').forEach(function(link){
    var url;
    try{url=new URL(link.href)}catch(error){return}
    if(!url.searchParams.has('utm_source'))url.searchParams.set('utm_source','evential.co');
    if(!url.searchParams.has('utm_medium'))url.searchParams.set('utm_medium','website');
    if(!url.searchParams.has('utm_campaign'))url.searchParams.set('utm_campaign','event_coverage');
    if(!url.searchParams.has('utm_content'))url.searchParams.set('utm_content',pagePath().replace(/^\/|\.html$/g,'')+'-'+placementOf(link));
    link.href=url.toString();
  });

  document.querySelectorAll('form[action*="formspree"]').forEach(function(form){
    form.addEventListener('submit',function(){
      send('generate_lead',{
        lead_source:'ncaec_case_study',
        placement:placementOf(form),
        page_path:pagePath()
      });
    });
  });

  var proof=document.querySelector('#proof,.ev-results,.case-proof');
  if(proof&&'IntersectionObserver' in window){
    var observer=new IntersectionObserver(function(entries){
      if(entries.some(function(entry){return entry.isIntersecting})){
        send('proof_view',{page_path:pagePath()});
        observer.disconnect();
      }
    },{threshold:.4});
    observer.observe(proof);
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);
else ready();

/* This fires only for an embedded Calendly flow that can post back to the
   current page. A simple outbound click remains calendly_open, not a lead. */
window.addEventListener('message',function(event){
  if(event.origin!=='https://calendly.com')return;
  if(event.data&&event.data.event==='calendly.event_scheduled'){
    send('generate_lead',{lead_source:'calendly',page_path:pagePath()});
    send('calendly_booked',{page_path:pagePath()});
  }
});

})();
