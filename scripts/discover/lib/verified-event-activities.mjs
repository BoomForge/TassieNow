// Individually source-verified Wikimedia Commons photos of the *activity*.
// No organiser copyright is assumed, and each is explicitly labelled as an
// illustration photographed elsewhere, never as a photo of the listed event.
import {eventImagePriority,imageIsPublishable} from './event-media.mjs';

export const verifiedActivitySources=[
{topic:"pickleball",pattern:new RegExp("\\bpickleball\\b",'i'),url:"https://upload.wikimedia.org/wikipedia/commons/1/1f/Pickleball_Players.jpg",sourceUrl:"https://commons.wikimedia.org/wiki/File:Pickleball_Players.jpg",credit:"TheVillagesFL",license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',scene:"people playing pickleball in Florida"},
{topic:"roller skating",pattern:new RegExp("\\broller[ -]?skat(?:ing|ers?)\\b",'i'),url:"https://upload.wikimedia.org/wikipedia/commons/c/cd/Roller_Skaters.jpg",sourceUrl:"https://commons.wikimedia.org/wiki/File:Roller_Skaters.jpg",credit:"dutchtownstl",license:'CC BY-SA 2.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/2.0/',scene:"roller skaters in St. Louis, USA"},
{topic:"composting",pattern:new RegExp("\\bcompost(?:ing)?\\b",'i'),url:"https://upload.wikimedia.org/wikipedia/commons/b/be/Compost_bins_in_a_community_garden.jpg",sourceUrl:"https://commons.wikimedia.org/wiki/File:Compost_bins_in_a_community_garden.jpg",credit:"Troy Sankey",license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',scene:"compost bins in an American community garden"},
{topic:"orchids",pattern:new RegExp("\\borchid(?:s)?\\b",'i'),url:"https://upload.wikimedia.org/wikipedia/commons/7/71/Orchid_collection.jpg",sourceUrl:"https://commons.wikimedia.org/wiki/File:Orchid_collection.jpg",credit:"Dalton Holland Baptista",license:'CC BY-SA 3.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/',scene:"orchids in a Brazilian nursery"},
{topic:"birdwatching",pattern:new RegExp("\\b(?:bird[ -]?count|birdwatch(?:ing)?|bird[ -]?week)\\b",'i'),url:"https://upload.wikimedia.org/wikipedia/commons/9/9c/Birdwatching.jpg",sourceUrl:"https://commons.wikimedia.org/wiki/File:Birdwatching.jpg",credit:"Daniel Schwen",license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',scene:"birdwatchers in New York's Central Park"},
{topic:"walking",pattern:new RegExp("\\b(?:walking group|walk with us|community walk|walking club)\\b",'i'),url:"https://upload.wikimedia.org/wikipedia/commons/2/2f/Walking_outdoors.jpg",sourceUrl:"https://commons.wikimedia.org/wiki/File:Walking_outdoors.jpg",credit:"RamblerMatthew",license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',scene:"people walking outdoors"},
{topic:"Diwali",pattern:new RegExp("\\bdiwali\\b",'i'),url:"https://upload.wikimedia.org/wikipedia/commons/5/5c/Diwali%2C_the_festival_of_lights.jpg",sourceUrl:"https://commons.wikimedia.org/wiki/File:Diwali,_the_festival_of_lights.jpg",credit:"Dew kodu pagli",license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',scene:"Diwali light decorations in India"},
{topic:"string quartet",pattern:new RegExp("\\bquartet\\b",'i'),url:"https://upload.wikimedia.org/wikipedia/commons/4/4e/Casals_Forum%2C_Dvo%C5%99%C3%A1k_string_quartet.jpg",sourceUrl:"https://commons.wikimedia.org/wiki/File:Casals_Forum,_Dvořák_string_quartet.jpg",credit:"Gerda Arendt",license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',scene:"a Dvořák quartet performance in Germany"},
{topic:"motorcycle",pattern:new RegExp("\\b(?:motorcycle|motorbike|biker)\\b",'i'),url:"https://upload.wikimedia.org/wikipedia/commons/6/65/02025_0712_motorcycle_rally.jpg",sourceUrl:"https://commons.wikimedia.org/wiki/File:02025_0712_motorcycle_rally.jpg",credit:"Marsilar",license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',scene:"a motorcycle rally in Poland"},
{topic:"farmers market",pattern:new RegExp("\\bfarmers?[ -]?market\\b",'i'),url:"https://upload.wikimedia.org/wikipedia/commons/6/67/Fruit_and_vegetable_stall_at_Southside_Farmers_Market_November_2025.jpg",sourceUrl:"https://commons.wikimedia.org/wiki/File:Fruit_and_vegetable_stall_at_Southside_Farmers_Market_November_2025.jpg",credit:"Nick-D",license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',scene:"a fruit and vegetable stall in Canberra"},
{topic:"archery",pattern:new RegExp("\\barchery\\b",'i'),url:"https://upload.wikimedia.org/wikipedia/commons/c/c2/WA_targets_used_at_a_Robin-Hood_archery_shooting.jpg",sourceUrl:"https://commons.wikimedia.org/wiki/File:WA_targets_used_at_a_Robin-Hood_archery_shooting.jpg",credit:"Gunnar Richter",license:'CC BY-SA 3.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/',scene:"an archery target"},
{topic:"art exhibition",pattern:new RegExp("\\b(?:art exhibition|art campaign|art show)\\b",'i'),url:"https://upload.wikimedia.org/wikipedia/commons/d/d0/Art_exhibition.jpg",sourceUrl:"https://commons.wikimedia.org/wiki/File:Art_exhibition.jpg",credit:"YessMendez",license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',scene:"an art gallery exhibition in Mexico"},
{topic:"flower show",pattern:new RegExp("\\b(?:floral show|flower show)\\b",'i'),url:"https://upload.wikimedia.org/wikipedia/commons/e/e9/Flower_show_at_Lalbagh_botanical_garden_2026_(63981).jpg",sourceUrl:"https://commons.wikimedia.org/wiki/File:Flower_show_at_Lalbagh_botanical_garden_2026_(63981).jpg",credit:"Kaartic",license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',scene:"a bonsai display at an Indian botanical garden flower show"},
{topic:"food festival",pattern:new RegExp("\\b(?:food festival|food and wine festival|taste of summer)\\b",'i'),url:"https://upload.wikimedia.org/wikipedia/commons/6/60/Food_Festival_at_Hadigaun_(1).jpg",sourceUrl:"https://commons.wikimedia.org/wiki/File:Food_Festival_at_Hadigaun_(1).jpg",credit:"Nabin K. Sapkota",license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',scene:"a food festival in Nepal"},
{topic:"construction bricks",pattern:new RegExp("\\bbrixhibition\\b",'i'),url:"https://upload.wikimedia.org/wikipedia/commons/1/19/Lego_bricks.jpg",sourceUrl:"https://commons.wikimedia.org/wiki/File:Lego_bricks.jpg",credit:"bdesham (edited by Biopics)",license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',scene:"a collection of LEGO bricks in Florida"},
{topic:"Halloween",pattern:new RegExp("\\bhalloween\\b|\\bhaunted house\\b",'i'),url:"https://upload.wikimedia.org/wikipedia/commons/c/c3/Halloween_pumpkins.jpg",sourceUrl:"https://commons.wikimedia.org/wiki/File:Halloween_pumpkins.jpg",credit:"Jiayu Zuo",license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',scene:"decorative Halloween pumpkins"},
{topic:"Christmas carols",pattern:new RegExp("\\bcarols?\\b",'i'),url:"https://upload.wikimedia.org/wikipedia/commons/2/26/View_from_the_rear_of_the_2024_Manningham_Carols_by_Candlelight_in_Ruffey_Lake_Park_in_Doncaster%2C_Melbourne.jpg",sourceUrl:"https://commons.wikimedia.org/wiki/File:View_from_the_rear_of_the_2024_Manningham_Carols_by_Candlelight_in_Ruffey_Lake_Park_in_Doncaster,_Melbourne.jpg",credit:"Philip Mallis",license:'CC BY-SA 2.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/2.0/',scene:"a 2024 Carols by Candlelight event in Melbourne"}
];

export function applyVerifiedActivityPhotos(events){
 let added=0;
 for(const event of events){
  if(event.status!=='active'||eventImagePriority(event.image)>=2)continue;
  const source=verifiedActivitySources.find(entry=>entry.pattern.test(String(event.name||'')));
  if(!source)continue;
  const image={
   url:source.url,sourceUrl:source.sourceUrl,attribution:source.credit,
   license:source.license,licenseUrl:source.licenseUrl,isFallback:false,
   sourceMethod:'verified-event-activity',mediaType:'activity-illustrative',
   alt:`Illustrative photograph of ${source.scene}; not the advertised ${event.name} event`,
   caption:`Illustrative photo: ${source.scene}. This does not depict the advertised event in Tasmania.`,
   matchEvidence:{verified:true,verifiedType:'activity-illustrative',topic:source.topic,
     eventName:event.name,sourceFilePage:source.sourceUrl,checkedAt:'2026-10-11'}
  };
  if(!imageIsPublishable(image))continue;
  event.image=image;
  added++;
 }
 return added;
}
