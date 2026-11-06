import { makeMutable } from 'react-native-reanimated';

/** 0 = light chrome, 1 = dark chrome. Today sets it from the sky; the tab bar fades with it. */
export const todayChromeDarkness = makeMutable(0);
