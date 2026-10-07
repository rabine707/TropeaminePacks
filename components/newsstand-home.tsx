'use client';

import Link from 'next/link';
import {ArrowRight, Heart} from 'lucide-react';
import type {ReactNode} from 'react';
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
  const cards = props.cards.filter(card => !card.adult && !card.tags.includes('Mature Content'));
  const illustrated = cards.filter(card => card.image);
  const rack = (illustrated.length ? illustrated : cards).slice(0, 6);
  const sports = packDefinitions.find(pack => pack.id === 'sports-romance-1')!;
  const sportsCards = illustrated.filter(card => card.packs?.includes(sports.id));
  const covers = (sportsCards.length ? sportsCards : illustrated.length ? illustrated : cards).slice(0, 3);
  const recent = [...(illustrated.length ? illustrated : cards)].reverse().slice(0, 4);
  const picks = [...(illustrated.length ? illustrated : cards)].sort((a, b) => Number(props.favorites.includes(b.id)) - Number(props.favorites.includes(a.id)) || Number(b.rarity === 'Legendary') - Number(a.rarity === 'Legendary')).slice(0, 3);
  const poolCount = cards.filter(card => card.available && card.packs?.includes(sports.id)).length;
  const cover = (card: Card) => <Cover key={card.id} card={card} {...props}/>;

  return <div className="ns-home">
    <div className="ns-preview-note"><span>DESIGN PREVIEW</span><Link href="/">Return to current homepage <ArrowRight size={14}/></Link></div>
    <header className="ns-masthead"><p>CHARACTERS · CULTURE · COLLECTING</p><div className="ns-wordmark">Tropeamine<span>✳</span></div><div className="ns-masthead-bottom"><span>A shelf beyond the story.</span><span>THE INDEPENDENT COLLECTION · 18+</span></div></header>
    <nav className="ns-topics" aria-label="Newsstand sections"><a href="#on-the-rack">On the Rack</a><a href="#fresh">Fresh This Week</a><a href="#editors-picks">Editor's Picks</a><a href="#after-dark">After Dark</a></nav>

    <section className="ns-cover-story" aria-labelledby="ns-cover-title">
      <div className="ns-story-copy"><p className="ns-kicker">COVER STORY / NOW FEATURING</p><h1 id="ns-cover-title">A new kind<br/>of <em>cover crush.</em></h1><p>Your favorite fictional people, in collectible form. Find a story. Pick a pack. Make room on your shelf.</p><div className="ns-actions"><Link href="/packs?pack=sports-romance-1" className="ns-button">Explore Sports Romance <ArrowRight size={17}/></Link><Link href="/discover" className="ns-link">Browse the collection ↗</Link></div><div className="ns-story-credit"><span>IN THIS ISSUE</span><strong>{sports.displaySeries.join(' / ')}</strong></div></div>
      <div className="ns-feature-art"><div className="ns-feature-covers">{covers.map(cover)}</div><div className="ns-rack-edge"><span>{sportsCards.length ? 'THE SPORTS ROMANCE SELECTION' : 'FROM THE CURRENT COLLECTION'}</span><span>TAKE A CLOSER LOOK ↗</span></div></div>
    </section>

    <section id="on-the-rack" className="ns-section"><div className="ns-section-heading"><div><p className="ns-kicker">01 / THE COLLECTION</p><h2>On the Rack</h2></div><Link href="/discover" className="ns-link">Browse all cards ↗</Link></div><p className="ns-section-deck">Good stories deserve a spot up front. Tap any cover to meet the character.</p><div className="ns-rack">{rack.map(cover)}</div></section>

    <section className="ns-pack-feature" aria-labelledby="ns-pack-title"><div className="ns-pack-art"><img src={sports.image} alt={sports.imageAlt} width={290} height={363} loading="lazy"/></div><div className="ns-pack-copy"><p className="ns-kicker">THE FEATURED RELEASE / PACK 01</p><h2 id="ns-pack-title">Sports Romance<span>For the love<br/>of the game.</span></h2><p>{sports.description}</p><p className="ns-pack-series">{sports.displaySeries.join(' · ')}</p><div className="ns-pack-facts"><span><b>4</b> cards</span><span><b>1</b> guaranteed foil</span><span><b>100</b> Ink</span></div><Link href="/packs?pack=sports-romance-1" className="ns-button">View the pack <ArrowRight size={17}/></Link><small>{poolCount ? `${poolCount} available cards in this pack's pool.` : 'Explore the release. Opening unlocks when enough cards are available.'}</small></div></section>

    <section id="fresh" className="ns-section"><div className="ns-section-heading"><div><p className="ns-kicker">02 / THE WEEKLY EDIT</p><h2>Fresh This Week</h2></div><Link href="/discover" className="ns-link">Keep browsing ↗</Link></div><p className="ns-section-deck">On our radar: the latest illustrated additions to the catalog.</p><div className="ns-fresh-grid">{recent.map(cover)}</div></section>

    <div className="ns-bottom-edit"><section id="editors-picks"><p className="ns-kicker">03 / A LITTLE CURATION</p><h2>Editor's Picks</h2><p>Start with a standout. Your favorites get the front-row treatment.</p><div className="ns-picks">{picks.map(card => <button key={card.id} onClick={() => props.onSelect(card)}><span className="ns-pick-art">{props.renderArt(card)}</span><span><small>{card.series}</small><strong>{card.name}</strong><em>{card.rarity} · View card ↗</em></span><ArrowRight size={18}/></button>)}</div></section><section id="after-dark" className="ns-after-dark"><p className="ns-kicker">04 / BEHIND THE COUNTER</p><h2>After Dark</h2><p>For stories that linger<br/>long after the last page.</p><span className="ns-after-rule"/><small>Mature content stays behind your existing account preferences. SFW browsing is the default.</small><button className="ns-button" onClick={props.onPreferences}>View content preferences <ArrowRight size={17}/></button></section></div>

    <section className="ns-colophon"><div><p className="ns-kicker">YOUR OWN LITTLE CORNER</p><h2>Keep what you love.</h2><p>A binder full of characters. A shelf full of stories.</p></div><Link href="/binder" className="ns-button">Visit your binder <ArrowRight size={17}/></Link></section>
  </div>;
}
