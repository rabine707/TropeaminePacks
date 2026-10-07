'use client';

import Link from 'next/link';
import {ArrowRight, Heart} from 'lucide-react';
import {useState, type ReactNode} from 'react';
import type {Card} from '@/lib/catalog';
import {packDefinitions} from '@/lib/packs';

type Props = {
  cards: Card[];
  favorites: string[];
  renderArt: (card: Card) => ReactNode;
  onSelect: (card: Card) => void;
  onFavorite: (id: string) => void;
  onPreferences: () => void;
};

function Cover({card, renderArt, onSelect, onFavorite, favorites}: Omit<Props, 'cards' | 'onPreferences'> & {card: Card}) {
  return <article className="ns-cover">
    <button className="ns-cover-art" onClick={() => onSelect(card)} aria-label={`View ${card.name}, ${card.variant}`}>
      {renderArt(card)}
      <span className="ns-view">View card ↗</span>
    </button>
    <div className="ns-cover-caption">
      <div><small>{card.series}</small><h3>{card.name}</h3><p>{card.number} · {card.rarity}</p></div>
      <button className="ns-favorite" onClick={() => onFavorite(card.id)} aria-label={`Favorite ${card.name}`} aria-pressed={favorites.includes(card.id)}><Heart size={18}/></button>
    </div>
  </article>;
}

export default function NewsstandHome(props: Props) {
  const [accent, setAccent] = useState<'cobalt' | 'tomato'>('cobalt');
  const cards = props.cards.filter(card => !card.adult && !card.tags.includes('Mature Content'));
  const illustrated = cards.filter(card => card.image);
  const rack = (illustrated.length ? illustrated : cards).slice(0, 6);
  const sports = packDefinitions.find(pack => pack.id === 'sports-romance-1')!;
  const sportsCards = illustrated.filter(card => card.packs?.includes(sports.id));
  const covers = (sportsCards.length ? sportsCards : illustrated.length ? illustrated : cards).slice(0, 3);
  const recent = [...(illustrated.length ? illustrated : cards)].reverse().slice(0, 4);
  const picks = [...(illustrated.length ? illustrated : cards)].sort((a, b) => Number(props.favorites.includes(b.id)) - Number(props.favorites.includes(a.id)) || Number(b.rarity === 'Legendary') - Number(a.rarity === 'Legendary')).slice(0, 3);
  const poolCount = cards.filter(card => card.available && card.packs?.includes(sports.id)).length;
  const seriesNames = [...new Set([...sportsCards, ...illustrated, ...cards].map(card => card.series))].slice(0, 3);
  const seriesCollections = seriesNames.map(name => ({name, cards: (illustrated.length ? illustrated : cards).filter(card => card.series === name)})).filter(collection => collection.cards.length);
  const cover = (card: Card) => <Cover key={card.id} card={card} {...props}/>;

  return <div className="ns-home" data-accent={accent}>
    <div className="ns-preview-note"><span>MODERN BOOKSHOP / PREVIEW</span><Link href="/">Current homepage <ArrowRight size={14}/></Link></div>
    <header className="ns-masthead"><div className="ns-wordmark">Tropeamine<span>✳</span></div><div className="ns-masthead-bottom"><span>For the characters you keep thinking about.</span><span>COLLECT A LITTLE MORE OF THE STORY · 18+</span></div></header>
    <div className="ns-browse-bar"><nav className="ns-topics" aria-label="Bookshop sections"><a href="#stories">The stories</a><a href="#on-the-rack">The characters</a><a href="#featured-pack">The packs</a></nav><div className="ns-palette" role="group" aria-label="Preview accent color"><span>Try a color</span><button aria-pressed={accent === 'cobalt'} onClick={() => setAccent('cobalt')}>Cobalt</button><button aria-pressed={accent === 'tomato'} onClick={() => setAccent('tomato')}>Tomato</button></div></div>

    <section className="ns-cover-story" aria-labelledby="ns-cover-title">
      <div className="ns-story-copy"><p className="ns-kicker">YOUR BOOKSHELF WAS ONLY THE BEGINNING</p><h1 id="ns-cover-title">You collected<br/>the books.<br/><em>Now collect<br/>the characters.</em></h1><p>The ones you fell for. The ones you couldn't forget. Keep a little more of their story, one collectible card at a time.</p><div className="ns-actions"><a href="#stories" className="ns-button">Find your next collection <ArrowRight size={17}/></a><Link href="/binder" className="ns-link">Visit your binder ↗</Link></div></div>
      <div className="ns-feature-art"><div className="ns-feature-label"><span>OFF THE PAGE. ONTO YOUR SHELF.</span><span>↙ TAP TO MEET THEM</span></div><div className="ns-feature-covers">{covers.map(cover)}</div><div className="ns-rack-edge"><span>{sportsCards.length ? 'NOW FEATURING / SPORTS ROMANCE' : 'FROM THE CURRENT COLLECTION'}</span><strong>{[...new Set(covers.map(card => card.series))].join(' · ')}</strong></div></div>
    </section>

    <section id="stories" className="ns-section ns-stories"><div className="ns-section-heading"><div><p className="ns-kicker">START WITH A STORY</p><h2>From the books<br/>to your binder.</h2></div><Link href="/series" className="ns-link">Explore the series ↗</Link></div><p className="ns-section-deck">Find the world. Meet its characters. Make a little room for them.</p><div className="ns-series-grid">{seriesCollections.map(collection => <article key={collection.name} className="ns-series"><div className="ns-series-title"><small>{collection.cards[0].author || 'FROM THE COLLECTION'}</small><h3>{collection.name}</h3><span>{collection.cards.length} character cards in the catalog</span></div><div className="ns-series-cards">{collection.cards.slice(0, 2).map(cover)}</div></article>)}</div></section>

    <section id="on-the-rack" className="ns-section"><div className="ns-section-heading"><div><p className="ns-kicker">A FEW FAMILIAR FACES</p><h2>Meet your next obsession.</h2></div><Link href="/discover" className="ns-link">All characters ↗</Link></div><p className="ns-section-deck">A name you know. A face to remember. Tap a card to read their story.</p><div className="ns-rack">{rack.map(cover)}</div></section>

    <section id="featured-pack" className="ns-pack-feature" aria-labelledby="ns-pack-title"><div className="ns-pack-art"><img src={sports.image} alt={sports.imageAlt} width={290} height={363} loading="lazy"/></div><div className="ns-pack-copy"><p className="ns-kicker">THE FEATURED COLLECTION / SPORTS ROMANCE</p><h2 id="ns-pack-title">Sports Romance<span>For the love<br/>of the game.</span></h2><p>{sports.description}</p><p className="ns-pack-series">{sports.displaySeries.join(' · ')}</p><div className="ns-pack-facts"><span><b>4</b> cards</span><span><b>1</b> guaranteed foil</span><span><b>100</b> Ink</span></div><Link href="/packs?pack=sports-romance-1" className="ns-button">Explore the pack <ArrowRight size={17}/></Link><small>{poolCount ? `${poolCount} available cards in this pack's pool.` : 'Explore the release. Opening unlocks when enough cards are available.'}</small></div></section>

    <section id="fresh" className="ns-section"><div className="ns-section-heading"><div><p className="ns-kicker">NEW TO THE SHELF</p><h2>Fresh faces.</h2></div><Link href="/discover" className="ns-link">Keep browsing ↗</Link></div><p className="ns-section-deck">The latest illustrated additions to the collection.</p><div className="ns-fresh-grid">{recent.map(cover)}</div></section>

    <div className="ns-bottom-edit"><section id="editors-picks"><p className="ns-kicker">03 / A LITTLE CURATION</p><h2>Editor's Picks</h2><p>Start with a standout. Your favorites get the front-row treatment.</p><div className="ns-picks">{picks.map(card => <button key={card.id} onClick={() => props.onSelect(card)}><span className="ns-pick-art">{props.renderArt(card)}</span><span><small>{card.series}</small><strong>{card.name}</strong><em>{card.rarity} · View card ↗</em></span><ArrowRight size={18}/></button>)}</div></section><section id="after-dark" className="ns-after-dark"><p className="ns-kicker">04 / BEHIND THE COUNTER</p><h2>After Dark</h2><p>For stories that linger<br/>long after the last page.</p><span className="ns-after-rule"/><small>Mature content stays behind your existing account preferences. SFW browsing is the default.</small><button className="ns-button" onClick={props.onPreferences}>View content preferences <ArrowRight size={17}/></button></section></div>

    <section className="ns-colophon"><div><p className="ns-kicker">THE STORY DOESN'T END AT THE LAST PAGE</p><h2>Keep them close.</h2><p>Your books have a shelf. Your characters have a binder.</p></div><Link href="/binder" className="ns-button">Visit your binder <ArrowRight size={17}/></Link></section>
  </div>;
}
