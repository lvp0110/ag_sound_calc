interface Service {
  name: string;
  price: number;
  count: number;
  unit: string;
}

interface Construction {
  calc_params: CalcParams;

  materials: Material[];
  montage: Service[];
}

interface Material {
  articul?: string;
  name: string;
  count: number;
  unit: string;
  pricePerSquareMeter?: number;
  pricePerUnit?: number;
}

interface Offer {
  logoUrl: string;
  region: string;
  markupPercent: number;
  discountPercent: number;
  constructions: Construction[];
  services: Service[];
}

interface CalcParams {
  AddCeilShift: number;
  Area: number;
  Code: string;
  LenX: number;
  LenY: number;
  LenZ: number;
  Openings: any[];
  Perimeter: number;
  dframe: boolean;
  step: number;
}
