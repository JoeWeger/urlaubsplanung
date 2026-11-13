/**
 * Lesezeichen-Code: Läuft auf der Booking-/Airbnb-Seite im Browser des Nutzers
 * (dort gibt es keine Bot-Sperre), sammelt Meta-Tags, JSON-LD und ein paar
 * sichtbare Texte und öffnet damit die Import-Seite der App.
 */
export function bookmarkletCode(origin: string): string {
  const js = `
(()=>{try{
  const A=${JSON.stringify(origin)};
  let h='';
  document.querySelectorAll('meta[property],meta[name],meta[itemprop],script[type="application/ld+json"]').forEach(e=>{h+=e.outerHTML});
  const t=s=>{const e=document.querySelector(s);return e?e.innerText.replace(/\\s+/g,' ').trim().slice(0,400):''};
  const x=(n,v)=>{if(v)h+='<meta name="'+n+'" content="'+String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')+'">'};
  x('x-review',t('[data-testid="review-score-component"]')||t('[data-testid="review-score-right-component"]')||t('[data-testid="pdp-reviews-highlight-banner-host-rating"]')||t('[data-section-id="GUEST_FAVORITE_BANNER"]')||t('[data-section-id="OVERVIEW_DEFAULT_V2"]')||t('a[href*="/reviews"]'));
  x('x-h1',t('h1'));
  x('x-address',t('[data-testid="PropertyHeaderAddressDesktop-wrapper"]')||t('[data-node_tt_id="location_score_tooltip"]'));
  x('x-price',t('[data-section-id="BOOK_IT_SIDEBAR"]')||t('[data-testid="book-it-default"]'));
  const g=document.querySelector('[data-testid="property-gallery"] img,[data-testid="photo-viewer-section"] img,picture img');
  x('x-img',g&&(g.currentSrc||g.src));
  if(!document.querySelector('meta[property="og:image"]')){const im=[...document.images].find(i=>i.naturalWidth>=500);x('x-img2',im&&(im.currentSrc||im.src))}
  x('x-text',(document.body.innerText||'').replace(/[ \t]+/g,' ').slice(0,15000));
  const u=A+'/import#u='+encodeURIComponent(location.href)+'&h='+encodeURIComponent(h);
  const w=window.open(u,'_blank');
  if(!w)location.href=u;
}catch(e){alert('Urlaubsplanung: '+e.message)}})()`;
  return "javascript:" + js.replace(/\n\s*/g, "");
}
