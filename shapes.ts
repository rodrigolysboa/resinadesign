export interface SheetElement {
  id: string;
  type: 'shape' | 'text' | 'text-mask';
  name: string;
  x: number; // in mm
  y: number; // in mm
  width: number; // in mm
  height: number; // in mm
  rotation: number; // in degrees
  isLocked: boolean;
  zIndex: number;
  
  // Design attributes
  fillColor: string;
  strokeColor: string;
  strokeWidth: number; // in mm
  ringHole: boolean; // overlay chain hole structure
  isMirroredH: boolean;
  isMirroredV: boolean;

  // Masking
  shapeType?: string; 
  customMaskSrc?: string; // Image to frame mask source (base64)
  
  // Image inside the mask
  imageSrc?: string;
  imageScale: number; 
  imageX: number; // in mm or percentage
  imageY: number; // in mm or percentage
  imageRotation: number;
  imageFlipH: boolean;
  imageFlipV: boolean;

  // For Text or Text Mask elements
  text?: string;
  fontFamily?: string;
  fontSize: number; // in mm
  textColor?: string;
  textBold?: boolean;
  textItalic?: boolean;
  textAlignment?: 'left' | 'center' | 'right';
  isCurved?: boolean;
  curveRadius?: number; // degree of curve
  curveDirection?: 'up' | 'down';
  letterSpacing?: number; // letter spacing
}

export interface ProjectSheet {
  id: string;
  name: string;
  elements: SheetElement[];
}

export interface Project {
  id: string;
  userEmail: string;
  name: string;
  updatedAt: string;
  elements: SheetElement[]; // For legacy code
  sheets?: ProjectSheet[]; // Multi-sheets
  activeSheetId?: string; // The currently active sheet id
}

export const CATEGORIES = [
  { id: 'letras', name: 'Letras (A-Z)' },
  { id: 'numeros', name: 'Números (0-9)' },
  { id: 'coracao', name: 'Coração' },
  { id: 'formas_geometricas', name: 'Formas Geométricas' },
  { id: 'infantil', name: 'Infantil' },
  { id: 'times', name: 'Esportes/Times' },
  { id: 'pets', name: 'Pets' },
  { id: 'datas', name: 'Datas Especiais' },
  { id: 'canetas', name: 'Canetas' }
];

export const SHAPE_PATHS: Record<string, string> = {
  circle: '<circle cx="50" cy="50" r="46" />',
  oval: '<ellipse cx="50" cy="50" rx="46" ry="32" />',
  'oval-largo': '<ellipse cx="50" cy="50" rx="46" ry="40" />',
  'heart-classic': '<path d="M 50 18 C 35 0, 5 10, 5 45 C 5 72, 40 88, 50 96 C 60 88, 95 72, 95 45 C 95 10, 65 0, 50 18 Z" />',
  'heart-stretched': '<path d="M 50 12 C 32 -7, 2 2, 2 40 C 2 73, 38 88, 50 98 C 62 88, 98 73, 98 40 C 98 2, 68 -7, 50 12 Z" />',
  'heart-faceted': '<polygon points="50,15 72,3 95,25 95,50 50,96 5,50 5,25 28,3" />',
  'rect-rounded': '<rect x="4" y="4" width="92" height="92" rx="12" ry="12" />',
  'rect-tag': '<path d="M 12 4 L 88 4 A 8 8 0 0 1 96 12 L 96 88 A 8 8 0 0 1 88 96 L 12 96 A 8 8 0 0 1 4 88 L 4 12 A 8 8 0 0 1 12 4 Z M 50 16 A 4 4 0 1 0 50 24 A 4 4 0 1 0 50 16" fill-rule="evenodd" />',
  hexagon: '<polygon points="50,2 93,25 93,75 50,98 7,75 7,25" />',
  star: '<path d="M 50 2 L 64 35 L 98 38 L 74 62 L 81 96 L 50 80 L 19 96 L 26 62 L 2 38 L 36 35 Z" />',
  cloud: '<path d="M 30 70 C 18 70 8 60 8 48 C 8 36 20 28 35 32 C 40 18 60 18 68 30 C 78 22 92 30 92 42 C 96 50 94 68 82 70 Z" />',
  bear: '<path d="M 30,30 C 24,30 20,24 20,18 C 20,12 26,8 32,8 C 36,8 40,12 40,16 C 46,12 54,12 60,16 C 60,12 64,8 68,8 C 74,8 80,12 80,18 C 80,24 76,30 70,30 C 74,40 76,55 74,70 C 70,88 62,94 50,94 C 38,94 30,88 26,70 C 24,55 26,40 30,30 Z" />',
  shield: '<path d="M 10,10 L 90,10 C 90,10 90,56 50,95 C 10,56 10,10 10,10 Z" />',
  'shield-classic': '<path d="M 15 5 L 85 5 Q 85 45 50 95 Q 15 45 15 5 Z" />',
  paw: '<path d="M 50,55 C 38,55 30,64 33,74 C 36,84 45,92 50,92 C 55,92 64,84 67,74 C 70,64 62,55 50,55 M 30,42 C 23,42 18,48 20,54 C 22,60 30,62 35,56 C 40,50 37,42 30,42 M 70,42 C 63,42 60,50 65,56 C 70,62 78,60 80,54 C 82,48 77,42 70,42 M 41,20 C 35,20 31,26 34,31 C 37,36 44,36 47,31 C 50,26 46,20 41,20 M 59,20 C 53,20 49,26 52,31 C 55,36 62,36 65,31 C 68,26 64,20 59,20 Z" />',
  bone: '<path d="M 28 40 C 20 28, 8 36, 12 45 C 4 54, 14 62, 28 52 L 72 52 C 86 62, 96 54, 88 45 C 92 36, 80 28, 72 40 Z" />',
  clover: '<path d="M50,45 C45,35 30,35 35,48 C25,43 15,55 28,60 C23,70 38,70 45,60 L45,90 L55,90 L55,60 C62,70 77,70 72,60 C85,55 75,43 65,48 C70,35 55,35 50,45 Z" />',
  'christmas-tree': '<polygon points="50,5 90,85 10,85" />', // simplified fallback or beautiful levels
  'pen-rect': '<rect x="35" y="4" width="30" height="92" rx="4" ry="4" />',
  'pen-tapered': '<polygon points="38,4 62,4 54,96 46,96" />',
  triangle: '<polygon points="50,6 94,88 6,88" />'
};

export const MOULDS_BY_CATEGORY: Record<string, { id: string; name: string; iconShape: string; defaultWidth: number; defaultHeight: number }[]> = {
  formas_geometricas: [
    { id: 'circle', name: 'Círculo 45mm', iconShape: 'circle', defaultWidth: 45, defaultHeight: 45 },
    { id: 'circle-38', name: 'Círculo 38mm', iconShape: 'circle', defaultWidth: 38, defaultHeight: 38 },
    { id: 'circle-58', name: 'Círculo 58mm', iconShape: 'circle', defaultWidth: 58, defaultHeight: 58 },
    { id: 'oval', name: 'Oval clássico', iconShape: 'oval', defaultWidth: 40, defaultHeight: 30 },
    { id: 'oval-largo', name: 'Oval Largo', iconShape: 'oval-largo', defaultWidth: 48, defaultHeight: 40 },
    { id: 'rect-rounded', name: 'Quadrado Curvo', iconShape: 'rect-rounded', defaultWidth: 40, defaultHeight: 40 },
    { id: 'rect-tag', name: 'Tag de Resina', iconShape: 'rect-tag', defaultWidth: 35, defaultHeight: 50 },
    { id: 'hexagon', name: 'Hexágono', iconShape: 'hexagon', defaultWidth: 42, defaultHeight: 42 },
    { id: 'triangle', name: 'Triângulo', iconShape: 'triangle', defaultWidth: 40, defaultHeight: 40 }
  ],
  coracao: [
    { id: 'heart-classic', name: 'Coração clássico', iconShape: 'heart-classic', defaultWidth: 45, defaultHeight: 40 },
    { id: 'heart-stretched', name: 'Coração Alongado', iconShape: 'heart-stretched', defaultWidth: 40, defaultHeight: 50 },
    { id: 'heart-faceted', name: 'Coração Facetado', iconShape: 'heart-faceted', defaultWidth: 45, defaultHeight: 45 }
  ],
  letras: Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').map(l => ({
    id: `letter-${l}`,
    name: `Letra ${l}`,
    iconShape: `text:${l}`,
    defaultWidth: 40,
    defaultHeight: 45
  })),
  numeros: Array.from('0123456789').map(n => ({
    id: `number-${n}`,
    name: `Número ${n}`,
    iconShape: `text:${n}`,
    defaultWidth: 35,
    defaultHeight: 45
  })),
  infantil: [
    { id: 'star', name: 'Estrela Guia', iconShape: 'star', defaultWidth: 45, defaultHeight: 45 },
    { id: 'cloud', name: 'Nuvem Mágica', iconShape: 'cloud', defaultWidth: 50, defaultHeight: 35 },
    { id: 'bear', name: 'Ursinho Chaveiro', iconShape: 'bear', defaultWidth: 38, defaultHeight: 45 }
  ],
  times: [
    { id: 'shield', name: 'Escudo Campeão', iconShape: 'shield', defaultWidth: 40, defaultHeight: 48 },
    { id: 'shield-classic', name: 'Escudo Clássico', iconShape: 'shield-classic', defaultWidth: 40, defaultHeight: 48 }
  ],
  pets: [
    { id: 'paw', name: 'Patinha Pet', iconShape: 'paw', defaultWidth: 42, defaultHeight: 40 },
    { id: 'bone', name: 'Ossinho Pet', iconShape: 'bone', defaultWidth: 50, defaultHeight: 30 }
  ],
  datas: [
    { id: 'clover', name: 'Trevo da Sorte', iconShape: 'clover', defaultWidth: 42, defaultHeight: 42 },
    { id: 'christmas-tree', name: 'Pinheiro Natal', iconShape: 'christmas-tree', defaultWidth: 40, defaultHeight: 50 }
  ],
  canetas: [
    { id: 'pen-rect', name: 'Caneta Reta', iconShape: 'pen-rect', defaultWidth: 12, defaultHeight: 90 },
    { id: 'pen-tapered', name: 'Caneta Cônica', iconShape: 'pen-tapered', defaultWidth: 15, defaultHeight: 95 }
  ]
};

// Font styles to choose in properties panel
export const GOOGLE_FONTS = [
  'Arial Black',
  'Inter',
  'Outfit',
  'Space Grotesk',
  'Playfair Display',
  'Impact',
  'Comic Sans MS',
  'Rubik Mono One',
  'Passion One',
  'Alfa Slab One',
  'Secular One',
  'Bungee',
  'Cinzel Decorative',
  'Chewy',
  'Spicy Rice',
  'Lobster',
  'Limelight',
  'Pacifico',
  'Fredoka',
  'Permanent Marker',
  'Righteous',
  'Carter One',
  'Ultra',
  'Creepster',
  'Special Elite',
  'Monoton',
  'Great Vibes',
  'Satisfy',
  'Bangers',
  'Playball',
  'Lobster Two',
  'Courier New',
  'Georgia'
];

export function generateAlphabetSheetElements(): SheetElement[] {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const elements: SheetElement[] = [];
  
  for (let i = 0; i < letters.length; i++) {
    const char = letters[i];
    const col = i % 5;
    const row = Math.floor(i / 5);
    
    // Grid coordinates on A4
    const x = 12 + col * 37;
    const y = 12 + row * 46;
    
    elements.push({
      id: `alphabet-char-${char}-${Date.now()}-${i}`,
      type: 'text-mask',
      name: `Letra ${char}`,
      x,
      y,
      width: 32,
      height: 40, // 4cm height
      rotation: 0,
      isLocked: false,
      zIndex: i + 1,
      fillColor: '#ffffff', // standard empty white fill
      strokeColor: '#cbd5e1', // very thin light gray border default for view
      strokeWidth: 0.5,
      ringHole: true,
      isMirroredH: false,
      isMirroredV: false,
      text: char,
      fontFamily: 'Arial Black',
      fontSize: 28, // yields approx 40mm inside 32x40 frame
      imageScale: 1.2,
      imageX: 0,
      imageY: 0,
      imageRotation: 0,
      imageFlipH: false,
      imageFlipV: false
    });
  }
  
  return elements;
}
