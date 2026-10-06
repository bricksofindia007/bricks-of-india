// Diwali Sale page data (new page, 7 Oct 2026). Listed prices only, no coupons, no timestamps.
// Brick Rush: in-store at LEGO Certified Stores, 1-11 Oct 2026. Flipkart: prices as announced by Flipkart.
// Amazon: prices as reported, unconfirmed (confirm on sale day).
export interface DealCard { set: string; name: string; price: number; mrp: number; image: string }
export interface SaleSection {
  id: string; name: string; status: string; blurb: string;
  articleHref: string | null; articleLabel: string; videoHref: string | null; videoLabel: string; priceNote: string; cards: DealCard[];
}

const BRICK_RUSH_CARDS: DealCard[] = [
  {
    "set": "75397",
    "name": "Jabba's Sail Barge",
    "price": 26000,
    "mrp": 51999,
    "image": "https://cdn.rebrickable.com/media/sets/75397-1/145805.jpg"
  },
  {
    "set": "10356",
    "name": "Star Trek: U.S.S. Enterprise NCC-1701-D",
    "price": 19700,
    "mrp": 39399,
    "image": "https://cdn.rebrickable.com/media/sets/10356-1/163036.jpg"
  },
  {
    "set": "21363",
    "name": "The Goonies",
    "price": 15600,
    "mrp": 31199,
    "image": "https://cdn.rebrickable.com/media/sets/21363-1/162483.jpg"
  },
  {
    "set": "43300",
    "name": "Winnie the Pooh",
    "price": 8000,
    "mrp": 15999,
    "image": "https://cdn.rebrickable.com/media/sets/43300-1/167736.jpg"
  },
  {
    "set": "21362",
    "name": "Mineral Collection",
    "price": 3200,
    "mrp": 6399,
    "image": "https://cdn.rebrickable.com/media/sets/21362-1/160902.jpg"
  },
  {
    "set": "10333",
    "name": "The Lord of the Rings: Barad-dûr",
    "price": 26399,
    "mrp": 43999,
    "image": "https://cdn.rebrickable.com/media/sets/10333-1/140959.jpg"
  },
  {
    "set": "42172",
    "name": "McLaren P1",
    "price": 24719,
    "mrp": 41199,
    "image": "https://cdn.rebrickable.com/media/sets/42172-1/142568.jpg"
  },
  {
    "set": "76354",
    "name": "S.H.I.E.L.D. Helicarrier",
    "price": 23999,
    "mrp": 39999,
    "image": "https://cdn.rebrickable.com/media/sets/76354-1/170394.jpg"
  }
];
const FLIPKART_CARDS: DealCard[] = [
  {
    "set": "75409",
    "name": "Jango Fett's Firespray-Class Starship",
    "price": 16499,
    "mrp": 32999,
    "image": "https://cdn.rebrickable.com/media/sets/75409-1/154204.jpg"
  },
  {
    "set": "76419",
    "name": "Hogwarts Castle and Grounds",
    "price": 8249,
    "mrp": 16499,
    "image": "https://cdn.rebrickable.com/media/sets/76419-1/123597.jpg"
  },
  {
    "set": "71837",
    "name": "NINJAGO City Workshops",
    "price": 12749,
    "mrp": 25499,
    "image": "https://cdn.rebrickable.com/media/sets/71837-1/152123.jpg"
  },
  {
    "set": "10360",
    "name": "Shuttle Carrier Aircraft",
    "price": 11899,
    "mrp": 23799,
    "image": "https://cdn.rebrickable.com/media/sets/10360-1/155899.jpg"
  },
  {
    "set": "76269",
    "name": "Avengers Tower",
    "price": 24499,
    "mrp": 48999,
    "image": "https://cdn.rebrickable.com/media/sets/76269-1/129297.jpg"
  },
  {
    "set": "42172",
    "name": "McLaren P1",
    "price": 20599,
    "mrp": 41199,
    "image": "https://cdn.rebrickable.com/media/sets/42172-1/142568.jpg"
  },
  {
    "set": "10318",
    "name": "Concorde",
    "price": 10979,
    "mrp": 18299,
    "image": "https://cdn.rebrickable.com/media/sets/10318-1/132335.jpg"
  },
  {
    "set": "77251",
    "name": "McLaren F1 Team MCL38 Race Car",
    "price": 1375,
    "mrp": 2749,
    "image": "https://cdn.rebrickable.com/media/sets/77251-1/148284.jpg"
  }
];
const AMAZON_CARDS: DealCard[] = [
  {
    "set": "75419",
    "name": "Death Star",
    "price": 52499,
    "mrp": 104999,
    "image": "https://cdn.rebrickable.com/media/sets/75419-1/160973.jpg"
  },
  {
    "set": "75367",
    "name": "Venator-Class Republic Attack Cruiser",
    "price": 29499,
    "mrp": 58999,
    "image": "https://cdn.rebrickable.com/media/sets/75367-1/127838.jpg"
  },
  {
    "set": "71043",
    "name": "Hogwarts Castle",
    "price": 25199,
    "mrp": 50399,
    "image": "https://cdn.rebrickable.com/media/sets/71043-1/15516.jpg"
  },
  {
    "set": "76269",
    "name": "Avengers Tower",
    "price": 24499,
    "mrp": 48999,
    "image": "https://cdn.rebrickable.com/media/sets/76269-1/129297.jpg"
  },
  {
    "set": "10305",
    "name": "Lion Knights' Castle",
    "price": 21499,
    "mrp": 42999,
    "image": "https://cdn.rebrickable.com/media/sets/10305-1/152495.jpg"
  },
  {
    "set": "10333",
    "name": "The Lord of the Rings: Barad-dûr",
    "price": 26399,
    "mrp": 43999,
    "image": "https://cdn.rebrickable.com/media/sets/10333-1/140959.jpg"
  },
  {
    "set": "10365",
    "name": "Captain Jack Sparrow's Pirate Ship",
    "price": 21899,
    "mrp": 36499,
    "image": "https://cdn.rebrickable.com/media/sets/10365-1/160290.jpg"
  },
  {
    "set": "10356",
    "name": "Star Trek: U.S.S. Enterprise NCC-1701-D",
    "price": 23639,
    "mrp": 39399,
    "image": "https://cdn.rebrickable.com/media/sets/10356-1/163036.jpg"
  }
];

export const DIWALI_SECTIONS: SaleSection[] = [
  {
    id: 'brick-rush', name: 'Brick Rush', status: 'Live until 11 Oct', priceNote: 'In-store price at LEGO Certified Stores',
    blurb: 'LEGO Certified Stores across India, in-store only, 1-11 October. Fifty sets, up to half price.',
    articleHref: '/news/lego-brick-rush-sale-every-in-store-deal-and-whether-it-beat', articleLabel: 'Read the full list of 50 deals',
    videoHref: 'https://www.youtube.com/watch?v=yAgbqd-OHWQ', videoLabel: 'Watch all 50 deals ranked', cards: BRICK_RUSH_CARDS,
  },
  {
    id: 'flipkart', name: 'Flipkart Big Billion Days', status: 'Prices as announced by Flipkart', priceNote: 'Price as announced by Flipkart',
    blurb: 'Early access 8 Oct for Plus, BLACK and Flipkart credit card members; everyone from 9 Oct. 44 LEGO sets, each with a verdict in the article.',
    articleHref: '/news/flipkart-big-billion-days-lego-44-sets-checked', articleLabel: 'Read the full list of 44 sets',
    videoHref: 'https://youtube.com/shorts/K-B98Tjkzc0', videoLabel: 'Watch the Short', cards: FLIPKART_CARDS,
  },
  {
    id: 'amazon', name: 'Amazon Great Indian Festival', status: 'Reported, unconfirmed', priceNote: 'Reported price, unconfirmed: confirm on sale day',
    blurb: 'Deals being reported for the sets we have seen. Nothing here is confirmed until the sale is live.',
    articleHref: null, articleLabel: 'Read the full list', videoHref: null, videoLabel: 'Watch the Short', cards: AMAZON_CARDS,
  },
];
