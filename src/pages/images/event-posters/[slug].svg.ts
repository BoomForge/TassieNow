import events from '../../../data/events.json';
import {renderEventPoster} from '../../../lib/event-posters.mjs';
export function getStaticPaths(){
 return events.filter(event=>event.slug&&event.image?.isFallback).map(event=>({
  params:{slug:event.slug},props:{event}
 }));
}
export function GET({props}){
 return new Response(renderEventPoster(props.event),{
  status:200,
  headers:{'Content-Type':'image/svg+xml; charset=utf-8',
    'Cache-Control':'public, max-age=86400'}
 });
}
