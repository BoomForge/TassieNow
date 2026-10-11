// Maintain independent markets/food/other quotas so the larger general
// catalogue never crowds market photographs out of scheduled discovery.
export function isMarketPlace(place){
 return Array.isArray(place?.categories) && place.categories.includes('Markets');
}
function rotate(items, offset){
 if(!items.length)return [];
 const start=offset%items.length;
 return [...items.slice(start),...items.slice(0,start)];
}
export function selectPhotoEnrichmentTargets(incomplete,max,day){
 const markets=incomplete.filter(isMarketPlace);
 const food=incomplete.filter(p=>!isMarketPlace(p)&&(p.categories||[]).includes('Food & Drink'));
 const other=incomplete.filter(p=>!isMarketPlace(p)&&!(p.categories||[]).includes('Food & Drink'));
 const marketQuota=Math.min(markets.length,Math.ceil(max*.25));
 const foodQuota=Math.min(food.length,Math.ceil(max*.35));
 const used=new Set();
 const targets=[];
 const append=(items,quota,seed)=>{
  for(const item of rotate(items,day*Math.max(1,seed))){
   if(quota<=0||targets.length>=max)break;
   if(used.has(item.slug))continue;
   targets.push(item);used.add(item.slug);quota--;
  }
 };
 append(markets,marketQuota,marketQuota);
 append(food,foodQuota,foodQuota);
 append(other,max-targets.length,Math.max(1,max-marketQuota-foodQuota));
 // Overflow seats may be used by another pool, never waste a scheduled pass.
 if(targets.length<max){
  for(const list of [markets,food,other])
   append(list,max-targets.length,max+list.length);
 }
 return {targets,marketQuota,foodQuota,marketTargetCount:targets.filter(isMarketPlace).length};
}
