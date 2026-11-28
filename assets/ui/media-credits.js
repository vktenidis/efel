const credits = document.querySelector('#credits');
function link(url, host, label) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== host) throw new Error('Unexpected credits URL');
  const anchor = document.createElement('a');
  anchor.href = parsed.href;
  anchor.textContent = label;
  return anchor;
}
async function renderCredits() {
  const response = await fetch('assets/media.json?v=efel-prod29');
  if (!response.ok) throw new Error('Media list unavailable');
  const {players} = await response.json();
  const unique = new Map(Object.values(players).map(item => [item.path, item]));
  const portraits = [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, 'el'));
  const list = document.createDocumentFragment();
  for (const portrait of portraits) {
    const item = document.createElement('li');
    item.append(portrait.name + ' · ' + portrait.author + ' · ',
      link(portrait.source, 'commons.wikimedia.org', 'Πρωτότυπο'), ' · ',
      link(portrait.license, 'creativecommons.org', 'Άδεια χρήσης'));
    if (portrait.restrictions === 'personality') item.append(' · Δικαιώματα προσωπικότητας');
    list.append(item);
  }
  credits.replaceChildren(list);
}
renderCredits().catch(() => { credits.textContent = 'Οι πηγές δεν φόρτωσαν. Ανανέωσε τη σελίδα.'; });
