import { Platform } from 'react-native';
import { FactorKey, RegionVersion, VegetationStage } from './types';
import {
  REGION_OPTIONS,
  VEGETATION_STAGE_OPTIONS_BY_REGION,
  defaultVegetationStageForRegion,
  normalizeVegetationStageForRegion
} from './vegetation';

export const DEFAULT_API_URL = Platform.select({
  ios: 'http://localhost:3000/v1',
  android: 'http://10.0.2.2:3000/v1',
  default: 'http://localhost:3000/v1'
});

export const HELP_BY_FACTOR: Record<FactorKey, string> = {
  A: "Diversite des essences autochtones. Le releve compte les genres autochtones observes dans le peuplement, d'apres la definition IBP.",
  B: "Structure verticale de la vegetation. On decrit le nombre de strates occupees (seuil 20% de recouvrement) et le couvert autochtone.",
  C: 'Bois morts sur pied de grosse dimension. On calcule un score avec BMg/BMm ramenes a l\'hectare sur la surface decrite.',
  D: 'Bois morts au sol de grosse dimension. On calcule un score avec BMg/BMm ramenes a l\'hectare sur la surface decrite.',
  E: 'Tres gros bois vivants. Le score depend des TGB/GB par hectare sur la surface prospectee.',
  F: 'Arbres vivants porteurs de dendromicrohabitats. Le score se base sur le nombre d\'arbres porteurs par hectare.',
  G: 'Milieux ouverts floriferes. Le score est derive du pourcentage de surface ouverte fleurie dans la zone decrite.',
  H: 'Continuite temporelle de l\'etat boise. Ce facteur classe la station en recent, partiel ou ancien.',
  I: 'Milieux aquatiques. On compte le nombre de types differents presents dans ou en bordure du peuplement.',
  J: 'Milieux rocheux. On compte le nombre de types differents presents dans ou en bordure du peuplement.'
};

export const FACTOR_INPUT_HINTS_BY_FACTOR: Record<FactorKey, string[]> = {
  A: [
    "Compter les genres autochtones distincts (pas les especes), sur arbres vivants (> 50 cm) et arbres morts.",
    'Saisir le nombre observe dans native_genus_count.',
    'Seuils IBP: subalpin 0/1/2/3+ => S0/S1/S2/S5 ; autres etages 0-1/2/3-4/5+ => S0/S1/S2/S5.'
  ],
  B: [
    'Compter les strates couvrant au moins 20% de la surface decrite (1 ligneux peut compter dans plusieurs strates).',
    'Renseigner strata_count puis covered_autochthonous_percent (0..100).',
    'Seuils IBP: 1 strate=S0, 2=S1, 3-4=S2, 5=S5 ; score plafonne a S2 si couvert autochtone < 50%.'
  ],
  C: [
    "Compter les bois morts sur pied >= 1 m: BMg (grosse dimension) et BMm (dimension moyenne), puis la surface en ha.",
    'Renseigner bmg_count, bmm_count, surface_ha (> 0).',
    'Seuils (par ha): BMg<1 et BMm<1=S0 ; BMg<1 et BMm>=1=S1 ; 1<=BMg<3=S2 ; BMg>=3=S5.'
  ],
  D: [
    'Compter les bois morts au sol >= 1 m (BMg/BMm), puis la surface prospectee en ha.',
    'Renseigner bmg_count, bmm_count, surface_ha (> 0).',
    'Seuils (par ha): BMg<1 et BMm<1=S0 ; BMg<1 et BMm>=1=S1 ; 1<=BMg<3=S2 ; BMg>=3=S5.'
  ],
  E: [
    'Compter TGB et GB vivants, puis la surface en ha.',
    'Renseigner tgb_count, gb_count, surface_ha (> 0).',
    'Seuils (par ha): TGB<1 et GB<1=S0 ; TGB<1 et GB>=1=S1 ; 1<=TGB<5=S2 ; TGB>=5=S5.'
  ],
  F: [
    "Compter les arbres vivants porteurs de dendromicrohabitats (typologie IBP, groupes de dmh).",
    'Renseigner trees_per_ha. En protocole detaille, le comptage est plafonne a 2 arbres/ha par groupe de dmh.',
    'Seuils IBP: <2=S0 ; [2,3[=S1 ; [3,8[=S2 ; >=8=S5.'
  ],
  G: [
    'Estimer la part de surface de milieux ouverts floriferes (trouees, lisiere, zones peu denses).',
    'Renseigner open_flowering_percent (0..100).',
    'Seuils IBP (implementation actuelle): 0%=S0 ; hors subalpin: ]0,1[% ou >5%=S2, [1,5]%=S5 ; subalpin: ]0,1[%=S2, >=1%=S5.'
  ],
  H: [
    "Qualifier la continuite boisee: recent / partiel / ancien (cartes et observations de terrain).",
    'Renseigner class_score avec 0 (recent), 2 (partiel) ou 5 (ancien).',
    'Seules ces trois valeurs sont acceptees par la validation.'
  ],
  I: [
    'Compter les types de milieux aquatiques differents (interieur ou bordure), naturels ou artificiels.',
    'Les milieux temporaires comptent seulement si l eau persiste assez pour une flore/faune specifique.',
    'Renseigner type_count ; seuils: 0 type=S0, 1 type=S2, 2 types et +=S5.'
  ],
  J: [
    'Compter les types de milieux rocheux differents (interieur ou bordure), surface cumulee significative.',
    'Ne pas compter les elements du lit mineur dans ce facteur (ils relevent du contexte aquatique).',
    'Renseigner type_count ; seuils: 0 type=S0, 1 type=S2, 2 types et +=S5.'
  ]
};

export {
  REGION_OPTIONS,
  VEGETATION_STAGE_OPTIONS_BY_REGION,
  defaultVegetationStageForRegion,
  normalizeVegetationStageForRegion
};

export const DEFAULT_SURVEY_FORM = {
  siteName: 'Foret de Rambouillet',
  regionVersion: 'ACA' as RegionVersion,
  vegetationStage: 'collineen' as VegetationStage,
  gpsLocation: {
    lat: '',
    lng: '',
    collected_at: ''
  },
  factorA: { native_genus_count: '' },
  factorB: { strata_count: '', covered_autochthonous_percent: '' },
  factorC: { bmg_count: '', bmm_count: '', surface_ha: '' },
  factorD: { bmg_count: '', bmm_count: '', surface_ha: '' },
  factorE: { tgb_count: '', gb_count: '', surface_ha: '' },
  factorF: { trees_per_ha: '' },
  factorG: { open_flowering_percent: '' },
  factorH: { class_score: '' },
  factorI: { type_count: '' },
  factorJ: { type_count: '' }
};
