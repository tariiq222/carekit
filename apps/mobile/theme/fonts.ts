export const fontAssets = {
  Handicrafts_400Regular: require('../assets/fonts/TheYearofHandicraftsTTF-Reg.ttf'),
  Handicrafts_500Medium: require('../assets/fonts/TheYearofHandicraftsTTF-Med.ttf'),
  Handicrafts_600SemiBold: require('../assets/fonts/TheYearofHandicraftsTTF-SemBd.ttf'),
  Handicrafts_700Bold: require('../assets/fonts/TheYearofHandicraftsTTF-Bold.ttf'),
  Handicrafts_900Black: require('../assets/fonts/TheYearofHandicraftsTTF-Black.ttf'),
};

type Weight = '300' | '400' | '500' | '600' | '700' | '900';

const weightMap: Record<Weight, string> = {
  '300': 'Handicrafts_400Regular',
  '400': 'Handicrafts_400Regular',
  '500': 'Handicrafts_500Medium',
  '600': 'Handicrafts_600SemiBold',
  '700': 'Handicrafts_700Bold',
  '900': 'Handicrafts_900Black',
};

export function getFontName(_language: string, weight: string = '400'): string {
  const w = (weight in weightMap ? weight : '400') as Weight;
  return weightMap[w];
}
