// Check actual HTTP image responses, not merely the <img src> URL in HTML.
export function classifyImageResponse(status, contentType){
 const media=String(contentType||'').toLowerCase();
 if(status===429 || status===503 || status===502 || status===504)
   return 'retryable';
 if(status===405 || status===501)return 'needs-get';
 if(status===404 || status===410)return 'broken';
 if(status===403 || status===401)return 'blocked';
 if(status<200 || status>=400)return 'broken';
 if(!media.startsWith('image/'))return 'broken';
 return 'verified';
}
