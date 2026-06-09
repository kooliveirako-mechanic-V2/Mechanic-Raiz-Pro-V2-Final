// Marcas e modelos mais comuns do mercado brasileiro
export interface VehicleBrand {
  name: string;
  type: "carro" | "moto" | "ambos";
  models: string[];
}

export const VEHICLE_BRANDS: VehicleBrand[] = [
  // === CARROS ===
  {
    name: "Fiat",
    type: "carro",
    models: ["Uno", "Palio", "Siena", "Strada", "Toro", "Mobi", "Argo", "Cronos", "Pulse", "Fastback", "Punto", "Bravo", "Linea", "Grand Siena", "Fiorino", "Doblò", "Ducato"],
  },
  {
    name: "Volkswagen",
    type: "carro",
    models: ["Gol", "Voyage", "Polo", "Virtus", "T-Cross", "Nivus", "Taos", "Saveiro", "Amarok", "Fox", "Up!", "Jetta", "Tiguan", "Golf", "Passat", "Fusca"],
  },
  {
    name: "Chevrolet",
    type: "carro",
    models: ["Onix", "Onix Plus", "Tracker", "S10", "Spin", "Cruze", "Montana", "Equinox", "Trailblazer", "Prisma", "Cobalt", "Celta", "Corsa", "Classic", "Astra", "Vectra"],
  },
  {
    name: "Ford",
    type: "carro",
    models: ["Ka", "Ka Sedan", "EcoSport", "Ranger", "Maverick", "Territory", "Bronco Sport", "Fiesta", "Focus", "Fusion", "Edge"],
  },
  {
    name: "Toyota",
    type: "carro",
    models: ["Corolla", "Corolla Cross", "Hilux", "SW4", "Yaris", "Etios", "RAV4", "Camry", "Land Cruiser Prado"],
  },
  {
    name: "Honda",
    type: "ambos",
    models: ["Civic", "City", "HR-V", "ZR-V", "CR-V", "Fit", "WR-V", "Accord"],
  },
  {
    name: "Hyundai",
    type: "carro",
    models: ["HB20", "HB20S", "Creta", "Tucson", "Santa Fe", "i30", "Azera", "IX35", "Venue"],
  },
  {
    name: "Renault",
    type: "carro",
    models: ["Kwid", "Sandero", "Logan", "Duster", "Oroch", "Captur", "Stepway", "Master", "Kangoo"],
  },
  {
    name: "Nissan",
    type: "carro",
    models: ["Kicks", "Versa", "Frontier", "Sentra", "March", "Leaf", "X-Trail"],
  },
  {
    name: "Jeep",
    type: "carro",
    models: ["Renegade", "Compass", "Commander", "Wrangler", "Gladiator"],
  },
  {
    name: "Mitsubishi",
    type: "carro",
    models: ["L200 Triton", "Pajero Sport", "Outlander", "Eclipse Cross", "ASX", "Lancer"],
  },
  {
    name: "Peugeot",
    type: "carro",
    models: ["208", "2008", "3008", "Partner", "Boxer", "207", "206", "307", "408"],
  },
  {
    name: "Citroën",
    type: "carro",
    models: ["C3", "C4 Cactus", "C3 Aircross", "Jumpy", "Berlingo", "C4", "C5"],
  },
  {
    name: "BMW",
    type: "carro",
    models: ["Série 1", "Série 2", "Série 3", "Série 5", "X1", "X3", "X5", "X6", "320i", "520i"],
  },
  {
    name: "Mercedes-Benz",
    type: "carro",
    models: ["Classe A", "Classe C", "Classe E", "GLA", "GLB", "GLC", "GLE", "Sprinter", "Vito"],
  },
  {
    name: "Audi",
    type: "carro",
    models: ["A3", "A4", "A5", "Q3", "Q5", "Q7", "Q8", "e-tron", "TT"],
  },
  {
    name: "Kia",
    type: "carro",
    models: ["Sportage", "Cerato", "Seltos", "Sorento", "Carnival", "Picanto", "Soul", "Stinger"],
  },
  {
    name: "Caoa Chery",
    type: "carro",
    models: ["Tiggo 3x", "Tiggo 5x", "Tiggo 7", "Tiggo 8", "Arrizo 6"],
  },
  {
    name: "RAM",
    type: "carro",
    models: ["Rampage", "1500", "2500", "3500"],
  },
  {
    name: "GWM",
    type: "carro",
    models: ["Haval H6", "Ora 03", "Haval Jolion"],
  },
  {
    name: "BYD",
    type: "carro",
    models: ["Dolphin", "Dolphin Mini", "Song Plus", "Yuan Plus", "Seal", "Han", "Tan", "King"],
  },
  // === MOTOS ===
  {
    name: "Honda Motos",
    type: "moto",
    models: ["CG 160", "Fan 160", "Titan 160", "CB 300", "CB 500F", "CB 500X", "CBR 650R", "XRE 190", "XRE 300", "Bros 160", "Pop 110i", "Biz 125", "PCX 160", "SH 150i", "Elite 125", "ADV 150", "CB 1000R", "Africa Twin"],
  },
  {
    name: "Yamaha",
    type: "moto",
    models: ["Factor 150", "Fazer 250", "MT-03", "MT-07", "MT-09", "XTZ 150 Crosser", "XTZ 250 Lander", "Ténéré 250", "Ténéré 700", "YBR 150", "NMAX 160", "NEO 125", "Fluo 125", "R3", "R1"],
  },
  {
    name: "Suzuki",
    type: "moto",
    models: ["GSX-S750", "V-Strom 650", "V-Strom 1050", "Intruder 125", "Burgman 125", "Hayabusa", "DR 160", "GSX-R1000"],
  },
  {
    name: "Kawasaki",
    type: "moto",
    models: ["Ninja 400", "Ninja 650", "Ninja ZX-6R", "Ninja ZX-10R", "Z400", "Z650", "Z900", "Versys 650", "Versys 1000", "Vulcan S"],
  },
  {
    name: "BMW Motorrad",
    type: "moto",
    models: ["G 310 GS", "G 310 R", "F 750 GS", "F 850 GS", "R 1250 GS", "S 1000 RR", "S 1000 XR"],
  },
  {
    name: "Harley-Davidson",
    type: "moto",
    models: ["Iron 883", "Sportster S", "Fat Boy", "Heritage Classic", "Road King", "Street Glide", "Pan America"],
  },
  {
    name: "Triumph",
    type: "moto",
    models: ["Tiger 900", "Tiger 1200", "Street Triple", "Speed Triple", "Trident 660", "Bonneville T120"],
  },
  {
    name: "Royal Enfield",
    type: "moto",
    models: ["Meteor 350", "Classic 350", "Himalayan", "Interceptor 650", "Continental GT 650"],
  },
  {
    name: "Shineray",
    type: "moto",
    models: ["Worker 150", "Jet 125", "Phoenix 50", "XY 200"],
  },
  {
    name: "Dafra",
    type: "moto",
    models: ["Apache 200", "NH 190", "Zig 50", "Citycom 300"],
  },
];

export function getBrandsForType(tipo: "carro" | "moto"): VehicleBrand[] {
  return VEHICLE_BRANDS.filter(b => b.type === tipo || b.type === "ambos");
}

export function getModelsForBrand(brandName: string, tipo: "carro" | "moto"): string[] {
  const brand = VEHICLE_BRANDS.find(b => b.name === brandName && (b.type === tipo || b.type === "ambos"));
  return brand?.models || [];
}
