import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
export async function GET(context){
  const notes=(await getCollection('notes',({data})=>!data.draft)).sort((a,b)=>b.data.pubDate.valueOf()-a.data.pubDate.valueOf());
  return rss({title:'NOMAD FIELD',description:'Masahiro Iwamatsu の公式フィールドノート',site:context.site,items:notes.map(note=>({title:note.data.title,description:note.data.description,pubDate:note.data.pubDate,link:`/notes/${note.id}/`}))});
}
