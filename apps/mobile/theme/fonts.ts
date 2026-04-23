import {
  IBMPlexSansArabic_300Light,
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import {
  IBMPlexSans_300Light,
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans';

export const fontAssets = {
  IBMPlexSansArabic_300Light,
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
  IBMPlexSans_300Light,
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
};

type Weight = '300' | '400' | '500' | '600' | '700';

const arabicMap: Record<Weight, string> = {
  '300': 'IBMPlexSansArabic_300Light',
  '400': 'IBMPlexSansArabic_400Regular',
  '500': 'IBMPlexSansArabic_500Medium',
  '600': 'IBMPlexSansArabic_600SemiBold',
  '700': 'IBMPlexSansArabic_700Bold',
};

const latinMap: Record<Weight, string> = {
  '300': 'IBMPlexSans_300Light',
  '400': 'IBMPlexSans_400Regular',
  '500': 'IBMPlexSans_500Medium',
  '600': 'IBMPlexSans_600SemiBold',
  '700': 'IBMPlexSans_700Bold',
};

export function getFontName(language: string, weight: string = '400'): string {
  const w = (weight in arabicMap ? weight : '400') as Weight;
  return language === 'ar' ? arabicMap[w] : latinMap[w];
}
