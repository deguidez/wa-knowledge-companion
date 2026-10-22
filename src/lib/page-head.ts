export function pageHead(title: string, description: string) {
  return { meta: [
    { title: `${title} — Evenon GPT` }, { name: 'description', content: description },
    { property: 'og:title', content: `${title} — Evenon GPT` }, { property: 'og:description', content: description },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] };
}