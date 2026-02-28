const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── FONT PAIRS BY NICHE ─────────────────────────────────────────────────────
const FONT_PAIRS = {
  barbershop:   { heading: 'Bebas Neue',         body: 'Inter',           url: 'Bebas+Neue|Inter:wght@400;500;600' },
  restaurant:   { heading: 'Cormorant Garamond',  body: 'Nunito',          url: 'Cormorant+Garamond:wght@600;700|Nunito:wght@400;600' },
  law:          { heading: 'Playfair Display',    body: 'Lato',            url: 'Playfair+Display:wght@600;700;800|Lato:wght@400;700' },
  tech:         { heading: 'Space Grotesk',       body: 'DM Sans',         url: 'Space+Grotesk:wght@600;700|DM+Sans:wght@400;500' },
  beauty:       { heading: 'Bodoni Moda',         body: 'Jost',            url: 'Bodoni+Moda:wght@600;700|Jost:wght@400;500' },
  fitness:      { heading: 'Barlow Condensed',    body: 'Barlow',          url: 'Barlow+Condensed:wght@700;800|Barlow:wght@400;500' },
  medical:      { heading: 'Merriweather',        body: 'Source Sans 3',   url: 'Merriweather:wght@700|Source+Sans+3:wght@400;600' },
  realestate:   { heading: 'Cormorant',           body: 'Raleway',         url: 'Cormorant:wght@600;700|Raleway:wght@400;500;600' },
  education:    { heading: 'Nunito',              body: 'Open Sans',       url: 'Nunito:wght@700;800|Open+Sans:wght@400;600' },
  creative:     { heading: 'Syne',                body: 'Manrope',         url: 'Syne:wght@700;800|Manrope:wght@400;500' },
  hotel:        { heading: 'Libre Baskerville',   body: 'Mulish',          url: 'Libre+Baskerville:wght@700|Mulish:wght@400;500' },
  automotive:   { heading: 'Rajdhani',            body: 'Roboto',          url: 'Rajdhani:wght@600;700|Roboto:wght@400;500' },
  food:         { heading: 'Satisfy',             body: 'Lato',            url: 'Satisfy|Lato:wght@400;700' },
  construction: { heading: 'Oswald',              body: 'Roboto',          url: 'Oswald:wght@600;700|Roboto:wght@400;500' },
  finance:      { heading: 'Libre Baskerville',   body: 'Source Sans 3',   url: 'Libre+Baskerville:wght@700|Source+Sans+3:wght@400;600' },
  default:      { heading: 'Plus Jakarta Sans',   body: 'Inter',           url: 'Plus+Jakarta+Sans:wght@600;700;800|Inter:wght@400;500;600' },
};

// ─── UNSPLASH IMAGES BY NICHE ─────────────────────────────────────────────────
const UNSPLASH_IMAGES = {
  // SAUDE & ESTETICA
  estetica:        ['https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=80','https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=800&q=80','https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800&q=80'],
  odontologia:     ['https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=1200&q=80','https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=800&q=80','https://images.unsplash.com/photo-1609840114035-3c981b782dfe?w=800&q=80'],
  dermatologia:    ['https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=1200&q=80','https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&q=80','https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80'],
  cirurgiaplastica:['https://images.unsplash.com/photo-1551076805-e1869033e561?w=1200&q=80','https://images.unsplash.com/photo-1579684453423-f84349ef60b0?w=800&q=80','https://images.unsplash.com/photo-1530026405186-ed1f139313f3?w=800&q=80'],
  nutricao:        ['https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1200&q=80','https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80','https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800&q=80'],
  psicologia:      ['https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=1200&q=80','https://images.unsplash.com/photo-1516302752625-fcc3c50ae61f?w=800&q=80','https://images.unsplash.com/photo-1544027993-37dbfe43562a?w=800&q=80'],
  fisioterapia:    ['https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1200&q=80','https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80','https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80'],
  quiropraxia:     ['https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=1200&q=80','https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800&q=80','https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80'],
  harmonizacao:    ['https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1200&q=80','https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80','https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80'],
  depilacao:       ['https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=80','https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=800&q=80','https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800&q=80'],
  emagrecimento:   ['https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1200&q=80','https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80','https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&q=80'],
  academia:        ['https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80','https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80','https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&q=80'],
  personaltrainer: ['https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&q=80','https://images.unsplash.com/photo-1534258936925-c58bed479fcb?w=800&q=80','https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80'],
  pilates:         ['https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1200&q=80','https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80','https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80'],
  yoga:            ['https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&q=80','https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80','https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?w=800&q=80'],
  capilar:         ['https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1200&q=80','https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80','https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800&q=80'],
  implantecarpilar:['https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1200&q=80','https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80','https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=800&q=80'],
  fertilidade:     ['https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=1200&q=80','https://images.unsplash.com/photo-1584515933487-779824d29309?w=800&q=80','https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&q=80'],
  veterinaria:     ['https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1200&q=80','https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&q=80','https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=800&q=80'],
  diagnostico:     ['https://images.unsplash.com/photo-1579684453423-f84349ef60b0?w=1200&q=80','https://images.unsplash.com/photo-1551076805-e1869033e561?w=800&q=80','https://images.unsplash.com/photo-1530026405186-ed1f139313f3?w=800&q=80'],

  // CONSTRUCAO & SERVICOS
  construtora:     ['https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&q=80','https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800&q=80','https://images.unsplash.com/photo-1590479773265-7464e5d48118?w=800&q=80'],
  arquitetura:     ['https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=1200&q=80','https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&q=80','https://images.unsplash.com/photo-1524230572899-a752b3835840?w=800&q=80'],
  engenharia:      ['https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=1200&q=80','https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80','https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800&q=80'],
  interiores:      ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1200&q=80','https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80','https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80'],
  marcenaria:      ['https://images.unsplash.com/photo-1588854337236-6889d631faa8?w=1200&q=80','https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80','https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&q=80'],
  vidracaria:      ['https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&q=80','https://images.unsplash.com/photo-1524230572899-a752b3835840?w=800&q=80','https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&q=80'],
  marmoraria:      ['https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80','https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80','https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80'],
  pintura:         ['https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=1200&q=80','https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&q=80','https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80'],
  energiasolar:    ['https://images.unsplash.com/photo-1509391366360-2e959784a276?w=1200&q=80','https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800&q=80','https://images.unsplash.com/photo-1548337138-e87d889cc369?w=800&q=80'],
  automacao:       ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80','https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80','https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800&q=80'],
  limpeza:         ['https://images.unsplash.com/photo-1628177142898-93e36e4e3a50?w=1200&q=80','https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&q=80','https://images.unsplash.com/photo-1563453392212-326f5e854473?w=800&q=80'],
  dedetizadora:    ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80','https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80','https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80'],
  jardinagem:      ['https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&q=80','https://images.unsplash.com/photo-1463936575829-25148e1db1b8?w=800&q=80','https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&q=80'],
  piscinas:        ['https://images.unsplash.com/photo-1575429198097-0414ec08e8cd?w=1200&q=80','https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80','https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&q=80'],
  seguranca:       ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80','https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80','https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80'],
  portoes:         ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80','https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800&q=80','https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80'],
  arcondicionado:  ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80','https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80','https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80'],
  assistenciacel:  ['https://images.unsplash.com/photo-1512054502232-10a0a035d672?w=1200&q=80','https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=800&q=80','https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80'],
  assistenciaelet: ['https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=1200&q=80','https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80','https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80'],
  mudancas:        ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80','https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80','https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80'],

  // AUTOMOTIVO & MOTOS
  oficina:         ['https://images.unsplash.com/photo-1632823471565-1ecdf5c6da2e?w=1200&q=80','https://images.unsplash.com/photo-1615906655593-ad0386982a0f?w=800&q=80','https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=800&q=80'],
  cambio:          ['https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?w=1200&q=80','https://images.unsplash.com/photo-1632823471565-1ecdf5c6da2e?w=800&q=80','https://images.unsplash.com/photo-1615906655593-ad0386982a0f?w=800&q=80'],
  autoeletrica:    ['https://images.unsplash.com/photo-1615906655593-ad0386982a0f?w=1200&q=80','https://images.unsplash.com/photo-1632823471565-1ecdf5c6da2e?w=800&q=80','https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=800&q=80'],
  autocenter:      ['https://images.unsplash.com/photo-1486006920555-c77dcf18193c?w=1200&q=80','https://images.unsplash.com/photo-1632823471565-1ecdf5c6da2e?w=800&q=80','https://images.unsplash.com/photo-1615906655593-ad0386982a0f?w=800&q=80'],
  funilaria:       ['https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?w=1200&q=80','https://images.unsplash.com/photo-1632823471565-1ecdf5c6da2e?w=800&q=80','https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=800&q=80'],
  lavarapido:      ['https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=1200&q=80','https://images.unsplash.com/photo-1607860108855-64acf2078ed9?w=800&q=80','https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80'],
  esteticaauto:    ['https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=1200&q=80','https://images.unsplash.com/photo-1607860108855-64acf2078ed9?w=800&q=80','https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80'],
  insulfilm:       ['https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&q=80','https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=800&q=80','https://images.unsplash.com/photo-1486006920555-c77dcf18193c?w=800&q=80'],
  martelinho:      ['https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?w=1200&q=80','https://images.unsplash.com/photo-1632823471565-1ecdf5c6da2e?w=800&q=80','https://images.unsplash.com/photo-1615906655593-ad0386982a0f?w=800&q=80'],
  rodas:           ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80','https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80','https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=800&q=80'],
  somauto:         ['https://images.unsplash.com/photo-1545127398-14699f92334b?w=1200&q=80','https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80','https://images.unsplash.com/photo-1486006920555-c77dcf18193c?w=800&q=80'],
  motos:           ['https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=1200&q=80','https://images.unsplash.com/photo-1449426468159-d96dbf08f19f?w=800&q=80','https://images.unsplash.com/photo-1609630875171-b1321377ee65?w=800&q=80'],
  oficinamoto:     ['https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=1200&q=80','https://images.unsplash.com/photo-1632823471565-1ecdf5c6da2e?w=800&q=80','https://images.unsplash.com/photo-1449426468159-d96dbf08f19f?w=800&q=80'],
  pecasauto:       ['https://images.unsplash.com/photo-1632823471565-1ecdf5c6da2e?w=1200&q=80','https://images.unsplash.com/photo-1615906655593-ad0386982a0f?w=800&q=80','https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?w=800&q=80'],
  guincho:         ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80','https://images.unsplash.com/photo-1632823471565-1ecdf5c6da2e?w=800&q=80','https://images.unsplash.com/photo-1615906655593-ad0386982a0f?w=800&q=80'],
  despachante:     ['https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&q=80','https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&q=80','https://images.unsplash.com/photo-1436450412740-6b988f486c6b?w=800&q=80'],
  vistoria:        ['https://images.unsplash.com/photo-1486006920555-c77dcf18193c?w=1200&q=80','https://images.unsplash.com/photo-1632823471565-1ecdf5c6da2e?w=800&q=80','https://images.unsplash.com/photo-1615906655593-ad0386982a0f?w=800&q=80'],
  blindagem:       ['https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&q=80','https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80','https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=800&q=80'],
  rastreamento:    ['https://images.unsplash.com/photo-1486006920555-c77dcf18193c?w=1200&q=80','https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80','https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80'],
  locadora:        ['https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1200&q=80','https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80','https://images.unsplash.com/photo-1486006920555-c77dcf18193c?w=800&q=80'],

  // GASTRONOMIA & EVENTOS
  restaurante:     ['https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80','https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80','https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80'],
  japones:         ['https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=1200&q=80','https://images.unsplash.com/photo-1562802378-063ec186a863?w=800&q=80','https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=800&q=80'],
  hamburgueria:    ['https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1200&q=80','https://images.unsplash.com/photo-1586816001966-79b736744398?w=800&q=80','https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=800&q=80'],
  pizzaria:        ['https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1200&q=80','https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80','https://images.unsplash.com/photo-1548369937-47519962c11a?w=800&q=80'],
  cafeteria:       ['https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1200&q=80','https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80','https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800&q=80'],
  doceria:         ['https://images.unsplash.com/photo-1488477181946-6428a0291777?w=1200&q=80','https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80','https://images.unsplash.com/photo-1558326567-98ae2405596b?w=800&q=80'],
  confeitaria:     ['https://images.unsplash.com/photo-1558326567-98ae2405596b?w=1200&q=80','https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80','https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80'],
  buffet:          ['https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=1200&q=80','https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&q=80','https://images.unsplash.com/photo-1555244162-803834f70033?w=800&q=80'],
  chacara:         ['https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=1200&q=80','https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=800&q=80','https://images.unsplash.com/photo-1555244162-803834f70033?w=800&q=80'],
  casamento:       ['https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=1200&q=80','https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&q=80','https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&q=80'],
  bartender:       ['https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=1200&q=80','https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&q=80','https://images.unsplash.com/photo-1474552226712-ac0f0961a954?w=800&q=80'],
  foodtruck:       ['https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?w=1200&q=80','https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80','https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80'],
  adega:           ['https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&q=80','https://images.unsplash.com/photo-1474552226712-ac0f0961a954?w=800&q=80','https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=800&q=80'],
  bebidas:         ['https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?w=1200&q=80','https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&q=80','https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&q=80'],
  chef:            ['https://images.unsplash.com/photo-1566554273541-37a9ca77b91f?w=1200&q=80','https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80','https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80'],

  // DIGITAL & TECNOLOGIA
  marketing:       ['https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80','https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80','https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80'],
  trafego:         ['https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80','https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80','https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80'],
  socialmedia:     ['https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1200&q=80','https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80','https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80'],
  produtora:       ['https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1200&q=80','https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800&q=80','https://images.unsplash.com/photo-1535016120720-40c646be5580?w=800&q=80'],
  devsite:         ['https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&q=80','https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80','https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80'],
  saas:            ['https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80','https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&q=80','https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80'],
  ia:              ['https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=1200&q=80','https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80','https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&q=80'],
  branding:        ['https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=1200&q=80','https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&q=80','https://images.unsplash.com/photo-1636633762833-5d1658f1e29b?w=800&q=80'],
  infoprodutos:    ['https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80','https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80','https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80'],
  copywriter:      ['https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1200&q=80','https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&q=80','https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80'],

  // ALTO TICKET & NEGOCIOS
  advocaciaempresa:['https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1200&q=80','https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80','https://images.unsplash.com/photo-1436450412740-6b988f486c6b?w=800&q=80'],
  contabilidade:   ['https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&q=80','https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80','https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80'],
  financas:        ['https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&q=80','https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80','https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80'],
  imobiliaria:     ['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80','https://images.unsplash.com/photo-1560184897-ae75f418493e?w=800&q=80','https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=80'],
  imoveluxo:       ['https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1200&q=80','https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80','https://images.unsplash.com/photo-1560184897-ae75f418493e?w=800&q=80'],
  investimentos:   ['https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&q=80','https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80','https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80'],
  seguros:         ['https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&q=80','https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80','https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80'],
  coaching:        ['https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80','https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80','https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=800&q=80'],
  mentoria:        ['https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80','https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=800&q=80','https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80'],
  escola:          ['https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=1200&q=80','https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80','https://images.unsplash.com/photo-1571260899304-425eee4c7efc?w=800&q=80'],
  cursinho:        ['https://images.unsplash.com/photo-1571260899304-425eee4c7efc?w=1200&q=80','https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&q=80','https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80'],
  idosos:          ['https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=1200&q=80','https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800&q=80','https://images.unsplash.com/photo-1551076805-e1869033e561?w=800&q=80'],
  turismo:         ['https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200&q=80','https://images.unsplash.com/photo-1488085061387-422e29b40080?w=800&q=80','https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80'],
  importadora:     ['https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80','https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?w=800&q=80','https://images.unsplash.com/photo-1553413077-190dd305871c?w=800&q=80'],
  ecommerce:       ['https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&q=80','https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80','https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80'],

  // EXISTING (kept for backward compat)
  barbershop:      ['https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1200&q=80','https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&q=80','https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&q=80'],
  law:             ['https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1200&q=80','https://images.unsplash.com/photo-1436450412740-6b988f486c6b?w=800&q=80','https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80'],
  tech:            ['https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80','https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&q=80','https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80'],
  fitness:         ['https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80','https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80','https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&q=80'],
  medical:         ['https://images.unsplash.com/photo-1551076805-e1869033e561?w=1200&q=80','https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80'],
  realestate:      ['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80','https://images.unsplash.com/photo-1560184897-ae75f418493e?w=800&q=80','https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=80'],
  hotel:           ['https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80','https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80'],
  default:         ['https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80','https://images.unsplash.com/photo-1497366754035-f200968a7db3?w=800&q=80'],
};

// ─── SANITIZE CODE ────────────────────────────────────────────────────────────
function sanitizeCode(code) {
  code = code.trim();
  code = code.replace(/^```[a-zA-Z]*\n/, '');
  code = code.replace(/\n```$/, '');
  code = code.trim();
  code = code.replace(/\u201C/g, '"').replace(/\u201D/g, '"');
  code = code.replace(/\u2018/g, "'").replace(/\u2019/g, "'");
  code = code.replace(/\u2013/g, '-').replace(/\u2014/g, '-');
  code = code.replace(/\u00A0/g, ' ');
  return code;
}

// ─── BASE FILES ───────────────────────────────────────────────────────────────
function getBaseFiles(appCode) {
  return {
    'package.json': JSON.stringify({
      name: 'codeai-project', private: true, version: '0.0.0', type: 'module',
      scripts: { dev: 'vite', build: 'tsc && vite build', preview: 'vite preview' },
      dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0', 'lucide-react': '^0.263.1' },
      devDependencies: {
        '@types/react': '^18.2.0', '@types/react-dom': '^18.2.0',
        '@vitejs/plugin-react': '^4.0.0', autoprefixer: '^10.4.14',
        postcss: '^8.4.27', tailwindcss: '^3.3.3', typescript: '^5.0.2', vite: '^4.4.5'
      }
    }, null, 2),
    'vite.config.ts': "import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nexport default defineConfig({ plugins: [react()] })",
    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        target: 'ES2020', useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'], module: 'ESNext',
        skipLibCheck: true, moduleResolution: 'bundler',
        allowImportingTsExtensions: true, resolveJsonModule: true,
        isolatedModules: true, noEmit: true, jsx: 'react-jsx', strict: false
      },
      include: ['src']
    }, null, 2),
    'tsconfig.node.json': JSON.stringify({
      compilerOptions: { composite: true, skipLibCheck: true, module: 'ESNext', moduleResolution: 'bundler', allowSyntheticDefaultImports: true },
      include: ['vite.config.ts']
    }, null, 2),
    'postcss.config.js': "export default { plugins: { tailwindcss: {}, autoprefixer: {} } }",
    'tailwind.config.js': "export default { content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'], theme: { extend: {} }, plugins: [] }",
    'index.html': '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>CodeAI App</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>',
    'src/main.tsx': "import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App'\nimport './index.css'\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n)",
    'src/index.css': '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n* { box-sizing: border-box; }\nbody { margin: 0; }',
    'src/App.tsx': appCode
  };
}

// ─── BUILD PROMPT ─────────────────────────────────────────────────────────────
function buildPrompt(userRequest, currentAppCode, chatHistory) {
  const isModify = !!currentAppCode;

  const rules = [
    'Return ONLY raw TSX code with NO markdown fences, no backticks, no explanations',
    'Start directly with: import React from "react"',
    'Export: export default function App()',
    'Use Tailwind CSS only for all styles',
    'Use lucide-react for icons (already installed)',
    'No external imports besides react and lucide-react',
    'Use only ASCII characters in strings and JSX text',
    'ALL strings must be properly closed',
    'ALL JSX tags must be properly closed'
  ].join('\n- ');

  if (isModify) {
    return [
      'You are a senior React + TypeScript + Tailwind CSS expert.',
      '',
      '!!! IMPORTANT: You are EDITING an existing project. DO NOT create a new project from scratch.',
      'Make ONLY the requested change. Keep all structure, content and style intact.',
      '',
      'RULES:\n- ' + rules,
      '',
      '=== CURRENT App.tsx ===',
      currentAppCode,
      '=== END ===',
      '',
      'USER REQUEST: ' + userRequest,
      '',
      'Return the complete modified App.tsx:'
    ].join('\n');
  }

  // Detect niche and get font/image context
  const niche = detectNiche(userRequest);
  const fonts = FONT_PAIRS[niche] || FONT_PAIRS.default;
  const images = UNSPLASH_IMAGES[niche] || UNSPLASH_IMAGES.default;

  const fontInstruction = [
    'FONTS: Load these Google Fonts in a useEffect by injecting a <link> tag:',
    '  URL: https://fonts.googleapis.com/css2?family=' + fonts.url + '&display=swap',
    '  Heading font: "' + fonts.heading + '" - use with style={{fontFamily: \'"' + fonts.heading + '", serif\'}} on all headings',
    '  Body font: "' + fonts.body + '" - inject on document.body style',
  ].join('\n');

  const imageInstruction = [
    'IMAGES: Use these real Unsplash photos (already hosted, just use the URLs directly in <img> tags):',
    images.map((url, i) => '  Image ' + (i+1) + ': ' + url).join('\n'),
    '  - Use Image 1 as hero background (full width, object-cover)',
    '  - Use other images in gallery, team, or feature sections',
    '  - Always add loading="lazy" and proper alt text',
  ].join('\n');

  return [
    'You are a world-class UI/UX designer and React developer creating agency-quality websites.',
    '',
    fontInstruction,
    '',
    imageInstruction,
    '',
    'DESIGN REQUIREMENTS:',
    '- Hero: full-screen with real background image (overlay gradient for text readability), massive typography',
    '- Sections: alternate bg colors, generous spacing (py-24), smooth hover transitions',
    '- Cards: hover:scale-105 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300',
    '- Stats: text-5xl font-black, make them visually impactful',
    '- Avatars: colored gradient circles with initials, never empty boxes',
    '- Buttons: solid primary + outlined secondary with hover states',
    '- Add subtle section dividers and decorative elements',
    '',
    'CRITICAL BUGS TO AVOID:',
    '- Images: ALWAYS use the exact Unsplash URLs provided above - NEVER use placeholder or random images',
    '- Z-index: hero section must have z-index: 0, all other sections z-index: 0, never let content float over hero',
    '- Parallax: if using parallax effect, use background-attachment: scroll NOT fixed, and wrap in overflow: hidden',
    '- Custom cursor: if adding cursor effect, use mousemove event with NO transition/animation delay on the cursor element itself - cursor must follow mouse instantly with transform: translate(x, y)',
    '- Section containers: always add overflow: hidden to section wrappers that contain animated elements',
    '- Image hover effects: never use position: fixed on images, use transform: scale() instead',
    '',
    'RULES:\n- ' + rules,
    '',
    'Create a stunning, agency-quality React app for: ' + userRequest,
    'Return only App.tsx:'
  ].join('\n');
}

// ─── OPENROUTER CALL ──────────────────────────────────────────────────────────
async function callOpenRouter(prompt) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + OPENROUTER_API_KEY
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-5',
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error && err.error.message ? err.error.message : 'OpenRouter error ' + response.status);
  }

  const data = await response.json();
  return sanitizeCode(data.choices[0].message.content);
}

// ─── ANTHROPIC VISION ─────────────────────────────────────────────────────────
async function callAnthropicVision(image, mediaType, prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: prompt }
        ]
      }]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error && err.error.message ? err.error.message : 'Anthropic error ' + response.status);
  }

  const data = await response.json();
  return sanitizeCode(data.content[0].text);
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.post('/api/generate', async (req, res) => {
  const { prompt, currentAppCode, chatHistory } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt required' });

  try {
    const appCode = await callOpenRouter(buildPrompt(prompt, currentAppCode, chatHistory));
    const files = getBaseFiles(appCode);
    res.json({ files, appCode });
  } catch (err) {
    console.error('/api/generate error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/image', async (req, res) => {
  const { image, mediaType, prompt } = req.body;
  if (!image) return res.status(400).json({ error: 'Image required' });

  const visionPrompt = [
    'You are a senior React + TypeScript + Tailwind CSS expert.',
    'Analyze this design and recreate it as a React component.',
    prompt ? 'Additional instructions: ' + prompt : '',
    '',
    'RULES:',
    '- Return ONLY raw TSX code, no markdown fences',
    '- Start with: import React from "react"',
    '- Export: export default function App()',
    '- Use Tailwind CSS only',
    '- Use lucide-react for icons if needed',
    '- ASCII characters only in strings',
    '- Be faithful to the colors, layout and style of the image'
  ].join('\n');

  try {
    const appCode = await callAnthropicVision(image, mediaType || 'image/png', visionPrompt);
    const files = getBaseFiles(appCode);
    res.json({ files, appCode });
  } catch (err) {
    console.error('/api/image error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  const { prompt, code } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt required' });

  const fullPrompt = 'You are an HTML/CSS/JS expert. Return ONLY complete HTML, no markdown.\n\n' +
    (code ? 'Current code:\n' + code + '\n\nRequest: ' + prompt : prompt);

  try {
    const result = await callOpenRouter(fullPrompt);
    res.json({ result: result.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim() });
  } catch (err) {
    console.error('/api/chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, function() {
  console.log('CodeAI running on port ' + PORT);
});
