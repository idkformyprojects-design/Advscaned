import type { CategoryId, Condition, Seller } from './types';

export interface CategoryMeta {
  id: CategoryId;
  name: string;
  plural: string;
  emoji: string;
  tint: string;
  keywords: string[];
  fields: {
    key: string;
    label: string;
    options?: string[];
    placeholder?: string;
    numeric?: boolean;
  }[];
}

export const CATEGORIES: CategoryMeta[] = [
  {
    id: 'cars',
    name: 'Car',
    plural: 'Cars',
    emoji: '🚗',
    tint: '#0EA5E9',
    keywords: ['car', 'sedan', 'suv', 'hatchback', 'honda', 'maruti', 'hyundai', 'toyota'],
    fields: [
      {
        key: 'brand',
        label: 'Brand',
        options: [
          'Maruti Suzuki',
          'Hyundai',
          'Honda',
          'Tata',
          'Toyota',
          'Kia',
          'Mahindra',
          'Other',
        ],
      },
      {
        key: 'year',
        label: 'Year',
        options: ['2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017', '2016', 'Older'],
      },
      { key: 'fuel', label: 'Fuel', options: ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'] },
      { key: 'transmission', label: 'Transmission', options: ['Manual', 'Automatic'] },
      { key: 'km', label: 'KM driven', placeholder: 'e.g. 42000', numeric: true },
      { key: 'owners', label: 'Owners', options: ['1st', '2nd', '3rd', '4th+'] },
    ],
  },
  {
    id: 'mobiles',
    name: 'Mobile',
    plural: 'Mobiles',
    emoji: '📱',
    tint: '#8B5CF6',
    keywords: ['iphone', 'samsung', 'phone', 'mobile', 'oneplus', 'redmi', 'pixel', 'oppo', 'vivo'],
    fields: [
      {
        key: 'brand',
        label: 'Brand',
        options: [
          'Apple',
          'Samsung',
          'OnePlus',
          'Xiaomi',
          'Realme',
          'Vivo',
          'Oppo',
          'Google',
          'Other',
        ],
      },
      {
        key: 'storage',
        label: 'Storage',
        options: ['32 GB', '64 GB', '128 GB', '256 GB', '512 GB', '1 TB'],
      },
      { key: 'ram', label: 'RAM', options: ['3 GB', '4 GB', '6 GB', '8 GB', '12 GB', '16 GB'] },
      { key: 'battery', label: 'Battery health', placeholder: 'e.g. 89%' },
      { key: 'accessories', label: 'Box & accessories', options: ['Yes', 'No'] },
    ],
  },
  {
    id: 'properties',
    name: 'Property',
    plural: 'Properties',
    emoji: '🏠',
    tint: '#F59E0B',
    keywords: ['flat', 'apartment', 'rent', 'house', 'villa', 'pg', 'plot', 'office', '2bhk'],
    fields: [
      {
        key: 'listingType',
        label: 'Listing type',
        options: ['For rent', 'For sale', 'PG / Hostel', 'Commercial'],
      },
      {
        key: 'bhk',
        label: 'Bedrooms',
        options: ['1 RK', '1 BHK', '2 BHK', '3 BHK', '4 BHK', '4+ BHK'],
      },
      { key: 'bathrooms', label: 'Bathrooms', options: ['1', '2', '3', '4+'] },
      {
        key: 'furnishing',
        label: 'Furnishing',
        options: ['Unfurnished', 'Semi-furnished', 'Fully furnished'],
      },
      { key: 'area', label: 'Built-up area (sqft)', placeholder: 'e.g. 950', numeric: true },
      { key: 'floor', label: 'Floor', placeholder: 'e.g. 4 of 12' },
    ],
  },
  {
    id: 'bikes',
    name: 'Bike',
    plural: 'Bikes & Scooters',
    emoji: '🏍️',
    tint: '#EF4444',
    keywords: [
      'bike',
      'scooter',
      'royal enfield',
      'activa',
      'pulsar',
      'bullet',
      'splendor',
      'cycle',
    ],
    fields: [
      {
        key: 'brand',
        label: 'Brand',
        options: ['Royal Enfield', 'Honda', 'TVS', 'Bajaj', 'Hero', 'Yamaha', 'KTM', 'Other'],
      },
      {
        key: 'year',
        label: 'Year',
        options: ['2024', '2023', '2022', '2021', '2020', '2019', '2018', 'Older'],
      },
      { key: 'km', label: 'KM driven', placeholder: 'e.g. 18000', numeric: true },
      { key: 'owners', label: 'Owners', options: ['1st', '2nd', '3rd', '4th+'] },
    ],
  },
  {
    id: 'electronics',
    name: 'Electronics',
    plural: 'Electronics',
    emoji: '💻',
    tint: '#2563EB',
    keywords: [
      'laptop',
      'macbook',
      'tv',
      'playstation',
      'ps5',
      'camera',
      'fridge',
      'ac',
      'speaker',
    ],
    fields: [
      {
        key: 'brand',
        label: 'Brand',
        options: ['Apple', 'Samsung', 'Sony', 'LG', 'Dell', 'HP', 'Lenovo', 'Other'],
      },
      { key: 'model', label: 'Model', placeholder: 'e.g. MacBook Air M1' },
      {
        key: 'warranty',
        label: 'Warranty left',
        options: ['None', 'Under 3 months', '3–12 months', '1+ year'],
      },
    ],
  },
  {
    id: 'furniture',
    name: 'Furniture',
    plural: 'Furniture',
    emoji: '🛋️',
    tint: '#A16207',
    keywords: ['sofa', 'bed', 'table', 'chair', 'wardrobe', 'dining', 'mattress', 'desk'],
    fields: [
      {
        key: 'type',
        label: 'Type',
        options: ['Sofa', 'Bed', 'Dining set', 'Wardrobe', 'Table', 'Chair', 'Other'],
      },
      {
        key: 'material',
        label: 'Material',
        options: ['Wood', 'Sheesham', 'Metal', 'Upholstered', 'Engineered wood'],
      },
    ],
  },
  {
    id: 'fashion',
    name: 'Fashion',
    plural: 'Fashion',
    emoji: '👗',
    tint: '#DB2777',
    keywords: ['shoes', 'dress', 'watch', 'bag', 'sneakers', 'jacket', 'clothing'],
    fields: [
      {
        key: 'type',
        label: 'Type',
        options: ['Clothing', 'Footwear', 'Watches', 'Bags', 'Accessories'],
      },
      { key: 'brand', label: 'Brand', placeholder: 'e.g. Nike' },
      { key: 'size', label: 'Size', placeholder: 'e.g. M / 9 UK' },
    ],
  },
  {
    id: 'jobs',
    name: 'Jobs',
    plural: 'Jobs',
    emoji: '💼',
    tint: '#0891B2',
    keywords: ['job', 'hiring', 'salary', 'internship', 'work from home', 'developer', 'sales'],
    fields: [
      {
        key: 'jobType',
        label: 'Job type',
        options: ['Full-time', 'Part-time', 'Internship', 'Contract', 'Work from home'],
      },
      { key: 'company', label: 'Company', placeholder: 'e.g. Nexus Labs' },
      {
        key: 'experience',
        label: 'Experience',
        options: ['Fresher', '0–2 years', '2–5 years', '5+ years'],
      },
    ],
  },
  {
    id: 'pets',
    name: 'Pets',
    plural: 'Pets',
    emoji: '🐾',
    tint: '#16A34A',
    keywords: ['dog', 'puppy', 'cat', 'kitten', 'pet', 'golden retriever', 'labrador'],
    fields: [
      { key: 'species', label: 'Species', options: ['Dog', 'Cat', 'Bird', 'Fish', 'Other'] },
      { key: 'breed', label: 'Breed', placeholder: 'e.g. Golden Retriever' },
      { key: 'age', label: 'Age', placeholder: 'e.g. 3 months' },
      { key: 'vaccinated', label: 'Vaccinated', options: ['Yes', 'No'] },
    ],
  },
  {
    id: 'services',
    name: 'Services',
    plural: 'Services',
    emoji: '🛠️',
    tint: '#7C3AED',
    keywords: ['plumber', 'electrician', 'tutor', 'repair', 'cleaning', 'carpenter', 'service'],
    fields: [
      {
        key: 'serviceType',
        label: 'Service type',
        options: ['Home repair', 'Tutoring', 'Beauty', 'Cleaning', 'Event', 'Other'],
      },
      { key: 'availability', label: 'Availability', options: ['Weekdays', 'Weekends', 'Anytime'] },
    ],
  },
  {
    id: 'sports',
    name: 'Sports',
    plural: 'Sports & Hobby',
    emoji: '🚴',
    tint: '#EA580C',
    keywords: ['cycle', 'bicycle', 'gym', 'dumbbell', 'guitar', 'treadmill', 'cricket'],
    fields: [
      {
        key: 'type',
        label: 'Type',
        options: ['Bicycle', 'Gym equipment', 'Musical instrument', 'Outdoor', 'Other'],
      },
      { key: 'brand', label: 'Brand', placeholder: 'e.g. Giant' },
    ],
  },
  {
    id: 'books',
    name: 'Books',
    plural: 'Books & Study',
    emoji: '📚',
    tint: '#4F46E5',
    keywords: ['book', 'novel', 'textbook', 'exam', 'notes', 'kindle'],
    fields: [
      {
        key: 'genre',
        label: 'Genre',
        options: ['Academic', 'Fiction', 'Non-fiction', 'Comics', 'Entrance exams'],
      },
      { key: 'language', label: 'Language', options: ['English', 'Hindi', 'Bengali', 'Other'] },
    ],
  },
];

export const categoryById = (id?: CategoryId | null) => CATEGORIES.find((c) => c.id === id);

export const CONDITIONS: { id: Condition; label: string }[] = [
  { id: 'new', label: 'Brand new' },
  { id: 'like-new', label: 'Like new' },
  { id: 'good', label: 'Good' },
  { id: 'fair', label: 'Fair' },
];

export const conditionLabel = (c: Condition) => CONDITIONS.find((x) => x.id === c)?.label ?? 'Good';

export const AREAS = [
  'Salt Lake',
  'New Town',
  'Ballygunge',
  'Park Street',
  'Gariahat',
  'Behala',
  'Howrah',
  'Garia',
  'Lake Town',
  'Dum Dum',
  'Alipore',
  'Jadavpur',
  'Rajarhat',
  'Bhowanipore',
];

export const SELLERS: Seller[] = [
  {
    id: 'u1',
    name: 'Rohan Mehta',
    phone: '+91 98300 11221',
    avatarColor: '#0AA98C',
    rating: 4.8,
    reviews: 34,
    joined: '2021',
    verified: true,
    responseRate: 96,
    responseTime: 'within 10 mins',
    bio: 'Car enthusiast. All my cars are single-owner with full service history.',
  },
  {
    id: 'u2',
    name: 'Priya Nair',
    phone: '+91 98311 44556',
    avatarColor: '#8B5CF6',
    rating: 4.9,
    reviews: 61,
    joined: '2019',
    verified: true,
    responseRate: 98,
    responseTime: 'within 5 mins',
    bio: 'Selling gently-used gadgets after upgrading. Box + bill for everything.',
  },
  {
    id: 'u3',
    name: 'Ankit Sharma',
    phone: '+91 99030 77889',
    avatarColor: '#F59E0B',
    rating: 4.5,
    reviews: 12,
    joined: '2023',
    verified: true,
    responseRate: 88,
    responseTime: 'within an hour',
  },
  {
    id: 'u4',
    name: 'Meera Iyer',
    phone: '+91 90070 22558',
    avatarColor: '#DB2777',
    rating: 4.7,
    reviews: 27,
    joined: '2020',
    verified: true,
    responseRate: 92,
    responseTime: 'within 30 mins',
    bio: 'Interior stylist. Furniture from my staging projects, barely used.',
  },
  {
    id: 'u5',
    name: 'Sandeep Ghosh',
    phone: '+91 98361 90876',
    avatarColor: '#2563EB',
    rating: 4.4,
    reviews: 9,
    joined: '2022',
    verified: false,
    responseRate: 79,
    responseTime: 'within a day',
  },
];

/** Sellers loaded from the API (real accounts), consulted before the demo sellers. */
const remoteSellers = new Map<string, Seller>();
export function registerSellers(list: Seller[]) {
  list.forEach((s) => remoteSellers.set(s.id, s));
}

const UNKNOWN_SELLER: Seller = {
  id: 'unknown',
  name: 'Bazaar user',
  phone: '',
  avatarColor: '#64748B',
  rating: 0,
  reviews: 0,
  joined: String(new Date().getFullYear()),
  verified: false,
  responseRate: 0,
  responseTime: 'soon',
};

export const sellerById = (id: string): Seller =>
  remoteSellers.get(id) ??
  SELLERS.find((s) => s.id === id) ??
  (remoteSellers.size ? { ...UNKNOWN_SELLER, id } : SELLERS[0]);
